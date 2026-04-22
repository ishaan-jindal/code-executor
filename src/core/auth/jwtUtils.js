import jwt from "jsonwebtoken";
import config from "../../config/index.js";

/**
 * Generate access token (short-lived)
 */
export function generateAccessToken(user) {
  const payload = {
    sub: user.id,
    username: user.username,
    email: user.email,
    tier: user.tier,
    rateLimit: user.rateLimit,
    role: user.role || "user",
    type: "access",
  };

  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

/**
 * Generate refresh token (long-lived)
 */
export function generateRefreshToken(user) {
  const payload = {
    sub: user.id,
    type: "refresh",
  };

  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.refreshTokenExpiresIn,
  });
}

/**
 * Verify and decode token
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      throw new Error("Token expired");
    }
    if (err.name === "JsonWebTokenError") {
      throw new Error("Invalid token");
    }
    throw err;
  }
}

/**
 * Decode token without verification (for debugging)
 */
export function decodeToken(token) {
  return jwt.decode(token);
}
