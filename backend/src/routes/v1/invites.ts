import type { FastifyInstance } from 'fastify';

import { HttpError } from '../../lib/errors.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { inviteCreateSchema } from '../../lib/validators.js';
import { inviteMember, listInvites } from '../../services/membership.js';
import type { MemberRole } from '../../db/schema.js';

export default async function inviteRoutes(app: FastifyInstance): Promise<void> {
  /* ------------------- Create an invite ------------------- */

  // Secretary or Chairperson may invite regular members; pre-assigning core
  // roles (Treasurer/Secretary) is reserved for the Chairperson.
  app.post('/invites', { preHandler: [requireAuth(), requirePermission('member.invite')] }, async (req, reply) => {
    const body = inviteCreateSchema.parse(req.body ?? {});
    const auth = req.auth!;

    if ((body.role === 'treasurer' || body.role === 'secretary') && auth.role !== 'chairperson') {
      throw HttpError.forbidden('Only the Chairperson can invite core committee roles');
    }

    const result = await inviteMember({
      chamaId: auth.chamaId,
      actorMemberId: auth.sub,
      phone: body.phone,
      role: body.role as MemberRole,
    });

    return reply.code(201).send({
      invite: { id: result.inviteId, devLink: result.devLink },
      message: `Invite sent to ${body.phone}`,
    });
  });

  /* ------------------- List invites (Chairperson) ------------------- */

  app.get('/invites', { preHandler: [requireAuth(), requirePermission('invite.list')] }, async (req, reply) => {
    const auth = req.auth!;
    const invites = await listInvites(auth.chamaId);
    return reply.code(200).send({ invites });
  });
}
