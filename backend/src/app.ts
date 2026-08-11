import path from 'node:path';

import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';

import { env } from './env.js';
import { errorHandler } from './lib/errors.js';
import { attachAuth } from './middleware/auth.js';
import v1Routes from './routes/v1/index.js';

/** Build the Fastify application (used by the server and by tests). */
export async function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV === 'production',
    bodyLimit: 20 * 1024 * 1024,
  });

  await app.register(cors, {
    origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    credentials: true,
  });

  await app.register(multipart, {
    limits: { fileSize: 20 * 1024 * 1024, files: 6, fields: 10 },
  });

  // Local-disk uploads are served directly in dev; in S3 mode files are
  // served from object storage (production would put a CDN in front).
  if (!env.S3_ENDPOINT) {
    await app.register(fastifyStatic, {
      root: path.resolve(process.cwd(), env.UPLOAD_DIR),
      prefix: '/uploads/',
      decorateReply: false,
    });
  }

  app.setErrorHandler(errorHandler);
  app.addHook('onRequest', attachAuth);

  app.get('/health', async () => ({ ok: true, service: 'mraru-api', time: new Date().toISOString() }));

  await app.register(v1Routes, { prefix: '/api/v1' });

  return app;
}
