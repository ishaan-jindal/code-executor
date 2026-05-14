import crypto from "crypto";

/**
 * Shared cryptographic utilities used by auth modules.
 * Eliminates duplication between refreshTokenStore and tokenBlacklist.
 */

/**
 * Hash a token using SHA-256.
 * Used for securely storing tokens and API keys.
 *
 * @param {string} value - The raw token/key to hash
 * @returns {string} Hex-encoded SHA-256 hash
 */
export function hashToken(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}
