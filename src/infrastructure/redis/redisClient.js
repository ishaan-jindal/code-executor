import Redis from "ioredis";

export const redis = new Redis({
  host: "127.0.0.1",
  port: 6379,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

export const redisBlocking = new Redis({
  host: "127.0.0.1",
  port: 6379,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

redis.on("connect", () => {
  console.log("[REDIS] connected");
});

redis.on("error", (err) => {
  console.error("[REDIS] error", err.message);
});

redisBlocking.on("connect", () => {
  console.log("[REDIS-BLOCKING] connected");
});

redisBlocking.on("error", (err) => {
  console.error("[REDIS-BLOCKING] error", err.message);
});

/**
 * Get the main Redis client instance
 * @returns {Redis} Redis client
 */
export function getRedis() {
  return redis;
}

/**
 * Get the blocking Redis client instance (for BLPOP operations)
 * @returns {Redis} Blocking Redis client
 */
export function getRedisBlocking() {
  return redisBlocking;
}
