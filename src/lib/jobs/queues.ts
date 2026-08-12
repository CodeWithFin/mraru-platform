import { Queue } from "bullmq";
import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

let redisConnection: Redis | null = null;
let kycWebhookQueue: Queue | null = null;
let smsNotificationQueue: Queue | null = null;
let idleNudgeQueue: Queue | null = null;

// Initialize connection safely
try {
  if (process.env.REDIS_URL || process.env.NODE_ENV === "production") {
    redisConnection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
    kycWebhookQueue = new Queue("kyc-webhooks", { connection: redisConnection });
    smsNotificationQueue = new Queue("sms-notifications", { connection: redisConnection });
    idleNudgeQueue = new Queue("idle-nudges", { connection: redisConnection });
  }
} catch (e) {
  console.warn("Redis connection unavailable, falling back to synchronous execution queue.");
}

// Memory queue fallback for local dev
const inMemoryJobs: Record<string, any[]> = {
  "kyc-webhooks": [],
  "sms-notifications": [],
  "idle-nudges": [],
};

export async function addJob(queueName: "kyc-webhooks" | "sms-notifications" | "idle-nudges", jobName: string, data: any, opts?: any) {
  if (queueName === "kyc-webhooks" && kycWebhookQueue) {
    return await kycWebhookQueue.add(jobName, data, opts);
  }
  if (queueName === "sms-notifications" && smsNotificationQueue) {
    return await smsNotificationQueue.add(jobName, data, opts);
  }
  if (queueName === "idle-nudges" && idleNudgeQueue) {
    return await idleNudgeQueue.add(jobName, data, opts);
  }

  // Fallback execution
  const jobId = opts?.jobId || `job_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  inMemoryJobs[queueName].push({ jobId, jobName, data, opts, addedAt: new Date() });
  console.log(`[JOB QUEUED - ${queueName}] ${jobName} (id: ${jobId})`);
  return { id: jobId };
}

export function getInMemoryJobs() {
  return inMemoryJobs;
}
