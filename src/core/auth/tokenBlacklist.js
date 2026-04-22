import { redis } from "../../infrastructure/redis/redisClient.js";
import { hashToken } from "../../utils/crypto.js";
import { parseTimeToSeconds } from "../../config/index.js";

/**
 * Token Blacklist - Revoke all tokens for a user by timestamp
 */

/**
 * Revoke all tokens for a specific user
 * @param {string} userId - User ID whose tokens to revoke
 */
export async function revokeAllUserTokens(userId) {
  const timestamp = Math.floor(Date.now() / 1000);
  const ttl = parseTimeToSeconds(process.env.REFRESH_TOKEN_EXPIRES_IN || "7d");

  // Store logout timestamp - any token issued before this is invalid
  await redis.set(`user:${userId}:logout_ts`, timestamp.toString(), "EX", ttl);
}

/**
 * Check if a token was issued before user's last logout
 * @param {string} userId - User ID from token
 * @param {number} tokenIssuedAt - Token iat claim (issued at timestamp)
 * @returns {Promise<boolean>} True if token is invalidated
 */
export async function isTokenRevokedForUser(userId, tokenIssuedAt) {
  const logoutTs = await redis.get(`user:${userId}:logout_ts`);
  if (!logoutTs) return false;

  const logoutTimestamp = parseInt(logoutTs, 10);
  return tokenIssuedAt < logoutTimestamp;
}

/**
 * Revoke (blacklist) a refresh token (legacy - for individual token revocation)
 * @param {string} token - The refresh token to revoke
 * @param {number} expiresIn - Token expiration time in seconds
 */
export async function revokeToken(token, expiresIn) {
  const tokenHash = hashToken(token);
  const ttl =
    expiresIn ||
    parseTimeToSeconds(process.env.REFRESH_TOKEN_EXPIRES_IN || "7d");

  // Store in blacklist with TTL matching token expiration
  await redis.set(`blacklist:token:${tokenHash}`, "1", "EX", ttl);
}

/**
 * Check if a token is blacklisted (legacy - for individual token checking)
 * @param {string} token - The token to check
 * @returns {Promise<boolean>} True if blacklisted
 */
export async function isTokenBlacklisted(token) {
  const tokenHash = hashToken(token);
  const exists = await redis.exists(`blacklist:token:${tokenHash}`);
  return exists === 1;
}
