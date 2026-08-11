import type { FastifyInstance } from 'fastify';

import authRoutes from './auth.js';
import chamaRoutes from './chamas.js';
import constitutionRoutes from './constitutions.js';
import inviteRoutes from './invites.js';
import memberRoutes from './members.js';
import uploadRoutes from './uploads.js';

export default async function v1Routes(app: FastifyInstance): Promise<void> {
  await app.register(authRoutes);
  await app.register(chamaRoutes);
  await app.register(memberRoutes);
  await app.register(constitutionRoutes);
  await app.register(inviteRoutes);
  await app.register(uploadRoutes);
}
