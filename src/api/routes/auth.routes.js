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

export default router;
