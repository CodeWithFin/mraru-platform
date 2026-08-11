import { buildApp } from './app.js';
import { env } from './env.js';
import { closeRedis, startSmsWorker } from './services/queue.js';

async function main() {
  const app = await buildApp();

  const worker = await startSmsWorker();
  if (worker) {
    console.log('[queue] SMS worker started');
  } else {
    console.log('[queue] REDIS_URL not set — SMS will be sent inline (dev fallback)');
  }

  const shutdown = async () => {
    app.log.info('Shutting down…');
    await app.close();
    await worker?.close();
    await closeRedis();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await app.listen({ port: env.PORT, host: '0.0.0.0' });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
