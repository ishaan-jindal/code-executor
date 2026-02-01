import { getRedis } from "../infrastructure/redis/redisClient.js";
import { ApiError } from "../utils/apiError.js";
import { info, warn } from "../infrastructure/logs/logger.js";

/**
 * Rate limiter using sliding window algorithm with Redis
 * 
 * Limits based on user's rateLimit from JWT (requests per minute)
 * Key format: ratelimit:{userId}:{minute}
 * 
 * @returns {Function} Express middleware
 */
export function rateLimitByUser() {
  return async (req, res, next) => {
    try {
      // Skip if no authenticated user (should not happen if used after authMiddleware)
      if (!req.user || !req.user.id) {
        return next();
      }

      const userId = req.user.id;
      const rateLimit = req.user.rateLimit || 10; // Default to 10 req/min
      const now = Date.now();
      const currentMinute = Math.floor(now / 60000); // Round down to minute
      
      const redis = getRedis();
      const key = `ratelimit:${userId}:${currentMinute}`;
      
      // Increment request count for this minute
      const count = await redis.incr(key);
      
      // Set expiry on first request of the minute (2 minutes to be safe)
      if (count === 1) {
        await redis.expire(key, 120);
      }
      
      // Check if limit exceeded
      if (count > rateLimit) {
        const resetTime = (currentMinute + 1) * 60000; // Next minute
        const retryAfter = Math.ceil((resetTime - now) / 1000); // Seconds until reset
        
        warn(`rate limit exceeded`, { 
          userId, 
          count, 
          limit: rateLimit,
          tier: req.user.tier 
        });
        
        // Set rate limit headers
        res.set({
          "X-RateLimit-Limit": rateLimit.toString(),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": resetTime.toString(),
          "Retry-After": retryAfter.toString()
        });
        
        throw new ApiError(
          429,
          `Rate limit exceeded. Maximum ${rateLimit} requests per minute for ${req.user.tier} tier.`,
          "RATE_LIMIT_EXCEEDED"
        );
      }
      
      // Set rate limit headers for successful requests
      const remaining = Math.max(0, rateLimit - count);
      const resetTime = (currentMinute + 1) * 60000;
      
      res.set({
        "X-RateLimit-Limit": rateLimit.toString(),
        "X-RateLimit-Remaining": remaining.toString(),
        "X-RateLimit-Reset": resetTime.toString()
      });
      
      info(`rate limit check passed`, { 
        userId, 
        count, 
        limit: rateLimit,
        remaining 
      });
      
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Check rate limit without incrementing (useful for GET requests)
 * 
 * @returns {Function} Express middleware
 */
export function checkRateLimit() {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return next();
      }

      const userId = req.user.id;
      const rateLimit = req.user.rateLimit || 10;
      const now = Date.now();
      const currentMinute = Math.floor(now / 60000);
      
      const redis = getRedis();
      const key = `ratelimit:${userId}:${currentMinute}`;
      
      // Get current count without incrementing
      const countStr = await redis.get(key);
      const count = countStr ? parseInt(countStr, 10) : 0;
      
      const remaining = Math.max(0, rateLimit - count);
      const resetTime = (currentMinute + 1) * 60000;
      
      res.set({
        "X-RateLimit-Limit": rateLimit.toString(),
        "X-RateLimit-Remaining": remaining.toString(),
        "X-RateLimit-Reset": resetTime.toString()
      });
      
      next();
    } catch (err) {
      next(err);
    }
  };
}
