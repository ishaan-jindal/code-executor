import { redis } from "../../infrastructure/redis/redisClient.ts";
import crypto from "crypto";
import { hashToken } from "../../utils/crypto.ts";
import { parseTimeToSeconds } from "../../config/index.ts";

/**
 * Refresh Token Store - Manage refresh tokens in Redis
 * Tokens are stored hashed and tied to user/device
 */

/**
 * Store a refresh token
 * @param {string} token - The refresh token
 * @param {string} userId - User ID
 * @param {string} deviceInfo - Optional device identifier (e.g., user agent hash)
 */
export async function storeRefreshToken(token, userId, deviceInfo = "default") {
  const tokenHash = hashToken(token);
  const ttl = parseTimeToSeconds(process.env.REFRESH_TOKEN_EXPIRES_IN || "7d");

  const tokenData = {
    userId,
    deviceInfo,
    createdAt: Date.now(),
  };

  // Store token data with TTL
  await redis.set(
    `refresh_token:${tokenHash}`,
    JSON.stringify(tokenData),
    "EX",
    ttl
  );

  // Also add to user's token set for "logout all" functionality
  await redis.sadd(`user:${userId}:refresh_tokens`, tokenHash);
  await redis.expire(`user:${userId}:refresh_tokens`, ttl);
}

/**
 * Validate a refresh token exists and is active
 * @param {string} token - The refresh token to validate
 * @returns {Promise<object|null>} Token data or null if invalid
 */
export async function validateRefreshToken(token) {
  const tokenHash = hashToken(token);
  const data = await redis.get(`refresh_token:${tokenHash}`);

  if (!data) return null;

  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Revoke a specific refresh token (single device logout)
 * @param {string} token - The refresh token to revoke
 */
export async function revokeRefreshToken(token) {
  const tokenHash = hashToken(token);

  // Get token data to find user ID
  const data = await redis.get(`refresh_token:${tokenHash}`);
  if (data) {
    const tokenData = JSON.parse(data);
    // Remove from user's token set
    await redis.srem(`user:${tokenData.userId}:refresh_tokens`, tokenHash);
  }

  // Delete the token
  await redis.del(`refresh_token:${tokenHash}`);
}

/**
 * Revoke all refresh tokens for a user (all devices logout)
 * @param {string} userId - User ID whose tokens to revoke
 */
export async function revokeAllUserRefreshTokens(userId) {
  // Get all token hashes for this user
  const tokenHashes = await redis.smembers(`user:${userId}:refresh_tokens`);

  if (tokenHashes.length === 0) return;

  // Delete all tokens
  const deletePromises = tokenHashes.map((hash) =>
    redis.del(`refresh_token:${hash}`)
  );
  await Promise.all(deletePromises);

  // Clear the user's token set
  await redis.del(`user:${userId}:refresh_tokens`);
}

/**
 * Get device info from request (simple hash of user agent)
 * @param {object} req - Express request object
 * @returns {string} Device identifier
 */
export function getDeviceInfo(req) {
  const userAgent = req.headers["user-agent"] || "unknown";
  return crypto
    .createHash("md5")
    .update(userAgent)
    .digest("hex")
    .substring(0, 16);
}
