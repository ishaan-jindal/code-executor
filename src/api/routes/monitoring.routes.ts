import express from "express";
import { redis } from "../../infrastructure/redis/redisClient.ts";
import { metrics } from "../../infrastructure/metrics/metricsCollector.ts";

const router = express.Router();

/**
 * Prometheus Metrics Endpoint
 * GET /metrics
 */
router.get("/metrics", (req, res) => {
  res.setHeader("Content-Type", "text/plain; version=0.0.4");
  metrics.updateSystemMetrics();
  res.send(metrics.getPrometheusMetrics());
});

/**
 * Real-time Status Endpoint
 * GET /status
 */
router.get("/status", async (req, res) => {
  try {
    metrics.updateSystemMetrics();
    metrics.recordRedisCheck(true);
    await redis.ping();
    
    res.json(metrics.getMetricsSummary());
  } catch (err) {
    metrics.recordRedisCheck(false);
    res.status(503).json({
      error: "Cannot connect to Redis",
      message: err.message,
    });
  }
});

export default router;
