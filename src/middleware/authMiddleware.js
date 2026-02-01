import { verifyToken } from "../core/auth/jwtUtils.js";
import { getUserById } from "../core/auth/userStore.js";
import { validateApiKey } from "../core/auth/apiKeyStore.js";
import { ApiError } from "../utils/apiError.js";

/**
 * Hybrid Authentication Middleware
 * Supports both JWT tokens (Authorization: Bearer) and API keys (X-API-Key)
 * Validates credentials and attaches user to request
 */
export async function authenticateJWT(req, res, next) {
  try {
    // Try API Key first (X-API-Key header)
    const apiKey = req.headers["x-api-key"];
    if (apiKey) {
      const user = await validateApiKey(apiKey);
      if (!user) {
        throw new ApiError(401, "Invalid API key");
      }
      
      // Attach user to request (same format as JWT)
      req.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        tier: user.tier,
        rateLimit: user.rateLimit,
        role: user.role || "user",
        authMethod: "apikey",
      };
      
      return next();
    }

    // Fall back to JWT token (Authorization: Bearer)
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      throw new ApiError(401, "No authorization credentials provided. Use Authorization: Bearer <token> or X-API-Key: <key>");
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
      role: user.role || "user",
      authMethod: "jwt",
    };
    
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Optional Authentication
 * Supports both JWT and API keys but doesn't fail if missing
 * Attaches user if valid credentials provided
 */
export async function optionalAuth(req, res, next) {
  try {
    // Try API Key first
    const apiKey = req.headers["x-api-key"];
    if (apiKey) {
      const user = await validateApiKey(apiKey);
      if (user) {
        req.user = {
          id: user.id,
          username: user.username,
          email: user.email,
          tier: user.tier,
          rateLimit: user.rateLimit,
          role: user.role || "user",
          authMethod: "apikey",
        };
      }
      return next();
    }

    // Try JWT token
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
            role: user.role || "user",
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
