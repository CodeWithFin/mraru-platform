import type { FastifyInstance } from 'fastify';

import { HttpError } from '../../lib/errors.js';
import { assertOtpGrantValid } from '../../services/otp.service.js';
import { storeConstitutionDocument } from '../../services/storage.js';

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const EXT_BY_MIME: Record<string, string> = { 'application/pdf': '.pdf' };

/**
 * Constitution upload used *before* a chama exists (Path A step 4). It is
 * gated by a verified OTP grant (X-Otp-Grant header) for the founder's phone,
 * so anonymous disk writes are impossible — the phone must have completed OTP.
 */
export default async function uploadRoutes(app: FastifyInstance): Promise<void> {
  app.post('/uploads/constitution', async (req, reply) => {
    const grant = String(req.headers['x-otp-grant'] ?? '');
    if (!grant) throw HttpError.unauthorized('Missing OTP grant');
    const claims = await assertOtpGrantValid(grant, { purpose: 'signup' }).catch(() => {
      throw HttpError.unauthorized('Invalid or expired OTP grant');
    });

    let fileUrl: string | null = null;
    const parts = req.parts();
    for await (const part of parts) {
      if (part.type !== 'file') continue;
      const data = await part.toBuffer();
      if (data.length === 0 || data.length > MAX_FILE_BYTES) {
        throw HttpError.badRequest('File exceeds the 20 MB limit or is empty');
      }
      const ext = EXT_BY_MIME[part.mimetype ?? ''] ?? '.pdf';
      const stored = await storeConstitutionDocument(`pending-${claims.phone.replace(/\D/g, '')}`, ext, data, part.mimetype ?? 'application/pdf');
      fileUrl = stored.url;
    }

    if (!fileUrl) throw HttpError.badRequest('No file received');
    return reply.code(200).send({ fileUrl });
  });
}
