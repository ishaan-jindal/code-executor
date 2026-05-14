import { Redis } from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const redis = new Redis(redisUrl, {
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
});

export const redisBlocking = new Redis(redisUrl, {
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
});

redis.on("connect", () => {
  console.log("[REDIS] connected");
});

redis.on("error", (err: Error) => {
  console.error("[REDIS] error", err.message);
});

redisBlocking.on("connect", () => {
  console.log("[REDIS-BLOCKING] connected");
});

redisBlocking.on("error", (err: Error) => {
  console.error("[REDIS-BLOCKING] error", err.message);
});

/**
 * Get the main Redis client instance
 * @returns {Redis} Redis client
 */
export function getRedis(): Redis {
  return redis;
}

/**
 * Get the blocking Redis client instance (for BLPOP operations)
 * @returns {Redis} Blocking Redis client
 */
export function getRedisBlocking(): Redis {
  return redisBlocking;
}
