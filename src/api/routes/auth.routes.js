import express from "express";
import { ApiError } from "../../utils/apiError.js";
import { ApiResponse } from "../../utils/apiResponse.js";
import {
  createUser,
  getUserByUsername,
  getUserByEmail,
  getUserById,
  validatePassword,
} from "../../core/auth/userStore.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
} from "../../core/auth/jwtUtils.js";
import {
  generateApiKey,
  listApiKeys,
  revokeApiKey,
} from "../../core/auth/apiKeyStore.js";
import { 
  storeRefreshToken, 
  revokeRefreshToken, 
  revokeAllUserRefreshTokens,
  validateRefreshToken,
  getDeviceInfo 
} from "../../core/auth/refreshTokenStore.js";
import { authenticateJWT } from "../../middleware/authMiddleware.js";

const router = express.Router();

/**
 * Register New User
 * POST /auth/register
 */
router.post("/register", async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    
    // Validation
    if (!username || !email || !password) {
      throw new ApiError(400, "Username, email, and password are required");
    }
    
    if (username.length < 3) {
      throw new ApiError(400, "Username must be at least 3 characters");
    }
    
    if (password.length < 8) {
      throw new ApiError(400, "Password must be at least 8 characters");
    }
    
    if (!email.includes("@")) {
      throw new ApiError(400, "Invalid email format");
    }
    
    // Create user
    const user = await createUser({ username, email, password, tier: "free" });
    
    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    
    // Store refresh token in database
    const deviceInfo = getDeviceInfo(req);
    await storeRefreshToken(refreshToken, user.id, deviceInfo);
    
    return res.status(201).json({
      success: true,
      data: {
        user,
        accessToken,
        refreshToken,
      },
    });
  } catch (err) {
    if (err.message.includes("already exists")) {
      return next(new ApiError(409, err.message));
    }
    next(err);
  }
});

/**
 * Login User
 * POST /auth/login
 */
router.post("/login", async (req, res, next) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      throw new ApiError(400, "Username and password are required");
    }
    
    // Get user (try username first, then email)
    let user = await getUserByUsername(username);
    if (!user) {
      user = await getUserByEmail(username);
    }
    
    if (!user) {
      throw new ApiError(401, "Invalid credentials");
    }
    
    // Validate password
    const isValid = await validatePassword(user, password);
    if (!isValid) {
      throw new ApiError(401, "Invalid credentials");
    }
    
    // Remove password hash from response
    const { passwordHash, ...safeUser } = user;
    
    // Generate tokens
    const accessToken = generateAccessToken(safeUser);
    const refreshToken = generateRefreshToken(safeUser);
    
    // Store refresh token in database
    const deviceInfo = getDeviceInfo(req);
    await storeRefreshToken(refreshToken, safeUser.id, deviceInfo);
    
    return res.json({
      success: true,
      data: {
        user: safeUser,
        accessToken,
        refreshToken,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Refresh Access Token
 * POST /auth/refresh
 */
router.post("/refresh", async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      throw new ApiError(400, "Refresh token is required");
    }
    
    // Verify refresh token
    let decoded;
    try {
      decoded = verifyToken(refreshToken);
    } catch (err) {
      if (err.message === "Token expired") {
        throw new ApiError(401, "Refresh token expired");
      }
      throw new ApiError(401, "Invalid refresh token");
    }
    
    // Check token type
    if (decoded.type !== "refresh") {
      throw new ApiError(401, "Invalid token type");
    }
    
    // Check if refresh token exists in database (not revoked)
    const tokenData = await validateRefreshToken(refreshToken);
    if (!tokenData) {
      throw new ApiError(401, "Refresh token has been revoked or is invalid");
    }
    
    // Get user
    const user = await getUserById(decoded.sub);
    if (!user) {
      throw new ApiError(401, "User not found");
    }
    
    const { passwordHash, ...safeUser } = user;
    
    // Generate new access token
    const accessToken = generateAccessToken(safeUser);
    
    return res.json({
      success: true,
      data: {
        accessToken,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Logout User (Current Device)
 * POST /auth/logout
 * Revokes only the current refresh token (single device logout)
 */
router.post("/logout", async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      throw new ApiError(400, "Refresh token is required");
    }
    
    // Revoke this specific refresh token
    await revokeRefreshToken(refreshToken);
    
    return res.json({
      success: true,
      data: {
        message: "Logged out successfully",
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Logout All Devices
 * POST /auth/logout-all
 * Revokes ALL refresh tokens for the authenticated user (all sessions)
 */
router.post("/logout-all", authenticateJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Revoke all refresh tokens for this user
    await revokeAllUserRefreshTokens(userId);
    
    return res.json({
      success: true,
      data: {
        message: "Logged out from all devices successfully",
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Get Current User Info
 * GET /auth/me
 * Requires: Authentication
 */
router.get("/me", async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new ApiError(401, "No authorization token provided");
    }
    
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    
    if (decoded.type !== "access") {
      throw new ApiError(401, "Invalid token type");
    }
    
    const user = await getUserById(decoded.sub);
    if (!user) {
      throw new ApiError(404, "User not found");
    }
    
    const { passwordHash, ...safeUser } = user;
    
    return res.json({
      success: true,
      data: safeUser,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Generate API Key
 * POST /auth/api-keys
 * Requires: Authentication (JWT)
 */
router.post("/api-keys", authenticateJWT, async (req, res, next) => {
  try {
    const { name } = req.body;
    const userId = req.user.id;

    if (!name || name.trim().length === 0) {
      throw new ApiError(400, "API key name is required");
    }

    if (name.length > 100) {
      throw new ApiError(400, "API key name must be 100 characters or less");
    }

    const apiKeyData = await generateApiKey(userId, name.trim());

    return res.status(201).json({
      success: true,
      data: {
        key: apiKeyData.key, // Only time the raw key is shown
        keyId: apiKeyData.keyId,
        name: apiKeyData.name,
        createdAt: apiKeyData.createdAt,
        warning: "Save this key securely. You won't be able to see it again.",
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * List API Keys
 * GET /auth/api-keys
 * Requires: Authentication (JWT)
 */
router.get("/api-keys", authenticateJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const keys = await listApiKeys(userId);

    return res.json({
      success: true,
      data: {
        keys,
        count: keys.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Revoke API Key
 * DELETE /auth/api-keys/:keyId
 * Requires: Authentication (JWT)
 */
router.delete("/api-keys/:keyId", authenticateJWT, async (req, res, next) => {
  try {
    const { keyId } = req.params;
    const userId = req.user.id;

    if (!keyId) {
      throw new ApiError(400, "Key ID is required");
    }

    const revoked = await revokeApiKey(userId, keyId);

    if (!revoked) {
      throw new ApiError(404, "API key not found");
    }

    return res.json({
      success: true,
      data: {
        message: "API key revoked successfully",
        keyId,
      },
    });
  } catch (err) {
    if (err.message.includes("Unauthorized")) {
      return next(new ApiError(403, "Cannot revoke API key that doesn't belong to you"));
    }
    next(err);
  }
});

export default router;
