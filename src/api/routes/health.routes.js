import express from "express";
import { redis } from "../../infrastructure/redis/redisClient.js";

const router = express.Router();

/**
 * Health Check Endpoint
 * GET /health
 */
router.get("/health", async (req, res) => {
  try {
    // Quick Redis connectivity check
    await redis.ping();
    
    return res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (err) {
    return res.status(503).json({
      status: "unhealthy",
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
