import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';

import { withTenant } from '../../db/client.js';
import { kycDocuments, members } from '../../db/schema.js';
import { HttpError } from '../../lib/errors.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { approveMemberSchema, rejectMemberSchema, uuidSchema } from '../../lib/validators.js';
import { approveMember, listPendingMembers, rejectMember } from '../../services/membership.js';
import { writeAudit } from '../../lib/audit.js';
import { storeKycDocument } from '../../services/storage.js';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB per document

const KIND_BY_FIELD: Record<string, 'national_id_front' | 'national_id_back' | 'passport_photo'> = {
  front: 'national_id_front',
  back: 'national_id_back',
  passport: 'passport_photo',
};

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

export default async function memberRoutes(app: FastifyInstance): Promise<void> {
  /* ------------------- KYC document upload (self) ------------------- */

  app.post(
    '/members/:id/kyc',
    { preHandler: [requireAuth()] },
    async (req, reply) => {
      const params = req.params as { id: string };
      uuidSchema.parse(params.id);
      const auth = req.auth!;

      if (auth.sub !== params.id) {
        throw HttpError.forbidden('You can only upload your own documents');
      }
      if (auth.status === 'rejected' || auth.status === 'exited') {
        throw HttpError.forbidden('Your account cannot upload documents');
      }

      const stored: { kind: string; url: string }[] = [];
      const parts = req.parts();

      for await (const part of parts) {
        if (part.type !== 'file') continue; // plain fields are auto-consumed
        const kind = KIND_BY_FIELD[part.fieldname];
        if (!kind) continue;
        const data = await part.toBuffer();

        if (data.length === 0 || data.length > MAX_FILE_BYTES) {
          throw HttpError.badRequest(`File ${part.fieldname} exceeds the 10 MB limit or is empty`);
        }
        const ext = EXT_BY_MIME[part.mimetype ?? ''] ?? '.bin';
        const storedFile = await storeKycDocument(
          auth.chamaId,
          auth.sub,
          kind,
          ext,
          data,
          part.mimetype ?? 'application/octet-stream',
        );

        await withTenant(auth.chamaId, async (tx) => {
          await tx.insert(kycDocuments).values({
            chamaId: auth.chamaId,
            memberId: auth.sub,
            kind,
            fileUrl: storedFile.url,
            mimeType: part.mimetype ?? null,
          });
          await writeAudit(tx, {
            chamaId: auth.chamaId,
            actorMemberId: auth.sub,
            action: 'kyc.document_uploaded',
            entityType: 'kyc_document',
            entityId: storedFile.key,
            afterState: { kind, url: storedFile.url },
          });
        });

        stored.push({ kind, url: storedFile.url });
      }

      if (stored.length === 0) {
        throw HttpError.badRequest('No documents received — send fields named front, back and/or passport');
      }

      // Re-flag KYC as pending for review.
      await withTenant(auth.chamaId, async (tx) => {
        await tx
          .update(members)
          .set({ kycStatus: 'pending' })
          .where(eq(members.id, auth.sub));
      });

      return reply.code(200).send({ documents: stored });
    },
  );

  /* ------------------- Pending approvals queue ------------------- */

  app.get(
    '/members/pending',
    { preHandler: [requirePermission('member.approve')] },
    async (req, reply) => {
      const auth = req.auth!;
      const pending = await listPendingMembers(auth.chamaId);
      return reply.code(200).send({ members: pending });
    },
  );

  /* ------------------- Approve / reject ------------------- */

  app.post(
    '/members/:id/approve',
    { preHandler: [requirePermission('member.approve')] },
    async (req, reply) => {
      const params = req.params as { id: string };
      uuidSchema.parse(params.id);
      approveMemberSchema.parse(req.body ?? {});

      await approveMember(req.auth!.chamaId, req.auth!.sub, params.id);
      return reply.code(200).send({ message: 'Member approved' });
    },
  );

  app.post(
    '/members/:id/reject',
    { preHandler: [requirePermission('member.reject')] },
    async (req, reply) => {
      const params = req.params as { id: string };
      uuidSchema.parse(params.id);
      const body = rejectMemberSchema.parse(req.body ?? {});

      await rejectMember(req.auth!.chamaId, req.auth!.sub, params.id, body.reason);
      return reply.code(200).send({ message: 'Application rejected' });
    },
  );
}
