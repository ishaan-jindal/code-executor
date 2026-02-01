import { verifyToken } from "../core/auth/jwtUtils.js";
import { getUserById } from "../core/auth/userStore.js";
import { ApiError } from "../utils/apiError.js";

/**
 * JWT Authentication Middleware
 * Validates JWT token and attaches user to request
 */
export async function authenticateJWT(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      throw new ApiError(401, "No authorization header provided");
    }
    
    if (!authHeader.startsWith("Bearer ")) {
      throw new ApiError(401, "Invalid authorization format. Use: Bearer <token>");
    }
    
    const token = authHeader.substring(7); // Remove "Bearer " prefix
    
    if (!token) {
      throw new ApiError(401, "No token provided");
    }
    
    // Verify token
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      if (err.message === "Token expired") {
        throw new ApiError(401, "Token expired");
      }
      throw new ApiError(401, "Invalid token");
    }
    
    // Check token type
    if (decoded.type !== "access") {
      throw new ApiError(401, "Invalid token type");
    }
    
    // Get user from database
    const user = await getUserById(decoded.sub);
    if (!user) {
      throw new ApiError(401, "User not found");
    }
    
    // Attach user to request
    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      tier: user.tier,
      rateLimit: user.rateLimit,
    };
    
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Optional JWT Authentication
 * Attaches user if valid token provided, but doesn't fail if missing
 */
export async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next();
    }
    
    const token = authHeader.substring(7);
    if (!token) {
      return next();
    }
    
    try {
      const decoded = verifyToken(token);
      
      if (decoded.type === "access") {
        const user = await getUserById(decoded.sub);
        if (user) {
          req.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            tier: user.tier,
            rateLimit: user.rateLimit,
          };
        }
      }
    } catch (err) {
      // Silently fail for optional auth
    }
    
    next();
  } catch (err) {
    next(err);
  }
}
