import { closeRedis, startSmsWorker } from './services/queue.js';

async function main() {
  const worker = await startSmsWorker();
  if (!worker) {
    console.log('REDIS_URL not set — inline SMS mode, no worker needed.');
    process.exit(0);
  }
  console.log('SMS worker started');
  const shutdown = async () => {
    await worker.close();
    await closeRedis();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
