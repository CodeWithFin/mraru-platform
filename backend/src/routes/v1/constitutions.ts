import type { FastifyInstance } from 'fastify';
import { and, desc, eq } from 'drizzle-orm';

import { withTenant } from '../../db/client.js';
import { constitutionAcceptances, constitutions, members } from '../../db/schema.js';
import { writeAudit } from '../../lib/audit.js';
import { HttpError } from '../../lib/errors.js';
import { requireAnyMember, requirePermission } from '../../middleware/auth.js';
import { constitutionAcceptSchema, constitutionAmendSchema, uuidSchema } from '../../lib/validators.js';
import { storeConstitutionDocument } from '../../services/storage.js';

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB
const EXT_BY_MIME: Record<string, string> = { 'application/pdf': '.pdf' };

export default async function constitutionRoutes(app: FastifyInstance): Promise<void> {
  /* ------------------- Current constitution ------------------- */

  // Any member — including pending-review members who must accept it to finish joining.
  app.get(
    '/constitutions/current',
    { preHandler: [requireAnyMember()] },
    async (req, reply) => {
      const auth = req.auth!;
      const result = await withTenant(auth.chamaId, async (tx) => {
        const current = await tx.query.constitutions.findFirst({
          where: eq(constitutions.chamaId, auth.chamaId),
          orderBy: desc(constitutions.version),
          with: { chama: true },
        });
        if (!current) throw HttpError.notFound('This chama has no constitution yet');

        const acceptance = await tx.query.constitutionAcceptances.findFirst({
          where: and(
            eq(constitutionAcceptances.memberId, auth.sub),
            eq(constitutionAcceptances.constitutionId, current.id),
          ),
        });
        return { current, acceptedByMe: Boolean(acceptance), acceptedAt: acceptance?.acceptedAt ?? null };
      });

      return reply.code(200).send({
        constitution: {
          id: result.current.id,
          version: result.current.version,
          content: result.current.content,
          fileUrl: result.current.fileUrl,
          createdAt: result.current.createdAt,
        },
        chamaName: result.current.chama.name,
        acceptedByMe: result.acceptedByMe,
        acceptedAt: result.acceptedAt,
      });
    },
  );

  /* ------------------- Accept (logged for audit) ------------------- */

  app.post(
    '/constitutions/:id/accept',
    { preHandler: [requireAnyMember()] },
    async (req, reply) => {
      const params = req.params as { id: string };
      uuidSchema.parse(params.id);
      constitutionAcceptSchema.parse(req.body ?? {});
      const auth = req.auth!;

      await withTenant(auth.chamaId, async (tx) => {
        const constitution = await tx.query.constitutions.findFirst({
          where: and(eq(constitutions.id, params.id), eq(constitutions.chamaId, auth.chamaId)),
        });
        if (!constitution) throw HttpError.notFound('Constitution not found');

        await tx
          .insert(constitutionAcceptances)
          .values({ memberId: auth.sub, constitutionId: constitution.id })
          .onConflictDoNothing();

        await writeAudit(tx, {
          chamaId: auth.chamaId,
          actorMemberId: auth.sub,
          action: 'constitution.accepted',
          entityType: 'constitution',
          entityId: constitution.id,
          afterState: { version: constitution.version },
        });
      });

      return reply.code(200).send({ message: 'Constitution accepted' });
    },
  );

  /* ------------------- Amendment (Chairperson only) ------------------- */

  // Creates version N+1 — existing versions are never overwritten.
  app.post(
    '/constitutions',
    { preHandler: [requirePermission('constitution.create')] },
    async (req, reply) => {
      const auth = req.auth!;
      const body = constitutionAmendSchema.parse(req.body ?? {});

      const result = await withTenant(auth.chamaId, async (tx) => {
        const latest = await tx.query.constitutions.findFirst({
          where: eq(constitutions.chamaId, auth.chamaId),
          orderBy: desc(constitutions.version),
        });
        const nextVersion = (latest?.version ?? 0) + 1;

        const [row] = (await tx
          .insert(constitutions)
          .values({
            chamaId: auth.chamaId,
            version: nextVersion,
            content: body.content ?? 'Constitution provided as an uploaded document — see attached file.',
            fileUrl: body.fileUrl ?? null,
            createdByMemberId: auth.sub,
          })
          .returning()) as [typeof constitutions.$inferSelect];

        await writeAudit(tx, {
          chamaId: auth.chamaId,
          actorMemberId: auth.sub,
          action: 'constitution.amended',
          entityType: 'constitution',
          entityId: row.id,
          beforeState: { version: latest?.version ?? null },
          afterState: { version: nextVersion },
        });
        return row;
      });

      return reply.code(201).send({ constitution: result });
    },
  );

  /* ------------------- Upload a constitution file (Chairperson) ------------------- */

  app.post(
    '/constitutions/upload',
    { preHandler: [requirePermission('constitution.create')] },
    async (req, reply) => {
      const auth = req.auth!;
      let fileUrl: string | null = null;

      const parts = req.parts();
      for await (const part of parts) {
        if (part.type !== 'file') continue;
        const data = await part.toBuffer();
        if (data.length === 0 || data.length > MAX_FILE_BYTES) {
          throw HttpError.badRequest('File exceeds the 20 MB limit or is empty');
        }
        const ext = EXT_BY_MIME[part.mimetype ?? ''] ?? '.pdf';
        const stored = await storeConstitutionDocument(
          auth.chamaId,
          ext,
          data,
          part.mimetype ?? 'application/pdf',
        );
        fileUrl = stored.url;
      }

      if (!fileUrl) throw HttpError.badRequest('No file received');
      return reply.code(200).send({ fileUrl });
    },
  );
}
