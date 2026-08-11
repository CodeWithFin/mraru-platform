import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';

import { chamas } from '../../db/schema.js';
import { HttpError } from '../../lib/errors.js';
import { createChamaSchema, joinChamaSchema } from '../../lib/validators.js';
import { createChamaAndFounder, joinChama } from '../../services/onboarding.js';
import { resolveJoinTarget } from '../../services/membership.js';

export default async function chamaRoutes(app: FastifyInstance): Promise<void> {
  /* ------------------- Path A: create chama + founder ------------------- */

  app.post('/chamas', async (req, reply) => {
    const body = createChamaSchema.parse(req.body);
    const result = await createChamaAndFounder(body);
    return reply.code(201).send(result);
  });

  /* ------------------- Path B: join an existing chama ------------------- */

  app.post('/chamas/:slug/join', async (req, reply) => {
    const params = req.params as { slug: string };
    const body = joinChamaSchema.parse(req.body);
    const result = await joinChama({ slug: params.slug, ...body });
    return reply.code(201).send(result);
  });

  /* ---- Public prefill: name + validity of a join code / invite link ---- */

  app.get('/chamas/:slug/join-info', async (req, reply) => {
    const params = req.params as { slug: string };
    const code = (req.query as { code?: string }).code ?? '';
    const target = await resolveJoinTarget(params.slug, code);
    if (!target) throw HttpError.notFound('Chama not found');
    return reply.code(200).send({
      chama: target.chama,
      inviteRole: target.inviteRole,
      valid: target.valid,
    });
  });
}
