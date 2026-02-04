import { redis } from "../../infrastructure/redis/redisClient.js";

const JOB_TTL_SECONDS = Number(process.env.JOB_TTL_SECONDS || 86400); // default: 24h

// Store job JSON to preserve types and schema
export async function createJob(job) {
  await redis.set(`job:${job.id}`, JSON.stringify(job), "EX", JOB_TTL_SECONDS);
}

export async function getJob(id) {
  const data = await redis.get(`job:${id}`);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch (e) {
    // fallback: return raw string
    return data;
  }
}

export async function updateJob(id, updates) {
  const current = await getJob(id);
  if (!current) {
    // Job was deleted, don't update
    return;
  }
  const merged = Object.assign({}, typeof current === "object" ? current : {}, updates);
  await redis.set(`job:${id}`, JSON.stringify(merged), "KEEPTTL");
}