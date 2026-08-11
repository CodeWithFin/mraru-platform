import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';

import { env } from '../env.js';
import { smsProvider, type SmsMessage } from './sms/index.js';

let redis: Redis | null = null;

/** Returns a shared ioredis connection, or null when REDIS_URL is unset. */
export function getRedis(): Redis | null {
  if (!env.REDIS_URL) return null;
  if (!redis) {
    redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  }
  return redis;
}

let smsQueue: Queue<SmsMessage> | null = null;

export function getSmsQueue(): Queue<SmsMessage> | null {
  const conn = getRedis();
  if (!conn) return null;
  if (!smsQueue) {
    smsQueue = new Queue<SmsMessage>('mraru-sms', {
      connection: conn,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2_000 },
        removeOnComplete: 1_000,
        removeOnFail: 1_000,
      },
    });
  }
  return smsQueue;
}

/**
 * Enqueue an SMS. Without Redis this falls back to sending inline, so the
 * whole platform still works with no external services in dev.
 */
export async function enqueueSms(message: SmsMessage): Promise<void> {
  const queue = getSmsQueue();
  if (!queue) {
    await smsProvider.send(message);
    return;
  }
  await queue.add('send-sms', message);
}

/** Start the BullMQ worker. Returns null when Redis is unavailable. */
export async function startSmsWorker(): Promise<Worker<SmsMessage> | null> {
  const conn = getRedis();
  if (!conn) return null;

  const worker = new Worker<SmsMessage>(
    'mraru-sms',
    async (job) => {
      await smsProvider.send(job.data);
    },
    { connection: conn, concurrency: 5 },
  );

  worker.on('failed', (job, err) => {
    console.error(`[queue] SMS job ${job?.id} failed:`, err.message);
  });

  return worker;
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
