import { redis } from "../../infrastructure/redis/redisClient.js";
import config from "../../config/index.js";

const JOB_TTL_SECONDS = config.jobTtlSeconds;

// Store job JSON to preserve types and schema
export async function createJob(job) {
  await redis.set(`job:${job.id}`, JSON.stringify(job), "EX", JOB_TTL_SECONDS);
}

export async function getJob(id) {
  const data = await redis.get(`job:${id}`);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
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
  const merged = Object.assign(
    {},
    typeof current === "object" ? current : {},
    updates
  );
  await redis.set(`job:${id}`, JSON.stringify(merged), "KEEPTTL");
}

export async function addJobToUserIndex(userId, jobId) {
  const key = `user:${userId}:jobs`;
  await redis.lpush(key, jobId);
  await redis.expire(key, JOB_TTL_SECONDS);
}

export async function getUserJobIds(userId, offset = 0, limit = 50) {
  const key = `user:${userId}:jobs`;
  // LRANGE is 0-indexed, newest first since we lpush
  return redis.lrange(key, offset, offset + limit - 1);
}

export async function getUserJobCount(userId) {
  return redis.llen(`user:${userId}:jobs`);
}
