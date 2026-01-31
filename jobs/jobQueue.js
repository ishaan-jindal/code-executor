import { redis, redisBlocking } from "../redis/redisClient.js";

const QUEUE_KEY = "jobs:queue";

export async function enqueueJob(jobId) {
  await redis.rpush(QUEUE_KEY, jobId);
}

export async function dequeueJob() {
  const result = await redisBlocking.blpop(QUEUE_KEY, 0);
  if (!result || !result[1]) {
    return null;
  }
  return result[1];
}
