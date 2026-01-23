import { redis } from "../redis/redisClient.js";

export async function createJob(job) {
  await redis.hset(`job:${job.id}`, job);
}

export async function getJob(id) {
  const data = await redis.hgetall(`job:${id}`);
  return Object.keys(data).length ? data : null;
}

export async function updateJob(id, updates) {
  await redis.hset(`job:${id}`, updates);
}
