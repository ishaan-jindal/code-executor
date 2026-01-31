import express from "express";
import bodyParser from "body-parser";
import crypto from "crypto";

import { requestLogger } from "./logs/requestLogger.js";
import { info, error as logError } from "./logs/logger.js";
import { ApiError } from "./utils/apiError.js";
import { ApiResponse } from "./utils/apiResponse.js";
import { redis } from "./redis/redisClient.js";
import { metrics } from "./metrics/metricsCollector.js";

import { createJob, getJob } from "./jobs/jobStore.js";
import { enqueueJob } from "./jobs/jobQueue.js";
import { JobStatus } from "./jobs/jobTypes.js";

import { startWorker } from "./workers/executorWorker.js";

const app = express();

app.use(requestLogger);
app.use(bodyParser.json({ limit: "100kb" }));

// --------------------
// HEALTH CHECK
// --------------------
app.get("/health", async (req, res) => {
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

// --------------------
// SUBMIT
// --------------------
app.post("/submit", async (req, res, next) => {
  try {
    const { language, code, stdin } = req.body;
    const reqId = req.requestId;

    if (!language || !code) {
      throw new ApiError(400, "Missing language or code");
    }

    info(`submission received`, { reqId });
    info(`code size ${code.length} bytes`, { reqId });

    if (code.length > 100_000) {
      throw new ApiError(413, "Code too large");
    }

    const jobId = crypto.randomUUID();

    await createJob({
      id: jobId,
      language,
      code,
      stdin: stdin ?? "",
      status: JobStatus.QUEUED,
      created_at: Date.now(),
    });

    await enqueueJob(jobId);

    info(`job queued`, { reqId, jobId });

    // Record metrics
    metrics.recordSubmission(language);

    return res.status(201).json(
      ApiResponse.jobResponse({ id: jobId, status: JobStatus.QUEUED })
    );
  } catch (err) {
    next(err);
  }
});

// --------------------
// RESULT (polling)
// --------------------
app.get("/result/:id", async (req, res, next) => {
  try {
    const jobId = req.params.id;
    const job = await getJob(jobId);

    if (!job) {
      return res.status(404).json(
        ApiResponse.error("Job not found", "JOB_NOT_FOUND")
      );
    }

    const includeOutput =
      job.status !== JobStatus.QUEUED && job.status !== JobStatus.RUNNING;

    return res.json(ApiResponse.jobResponse(job, includeOutput));
  } catch (err) {
    next(err);
  }
});

// --------------------
// METRICS (Prometheus)
// --------------------
app.get("/metrics", (req, res) => {
  res.setHeader("Content-Type", "text/plain; version=0.0.4");
  metrics.updateSystemMetrics();
  res.send(metrics.getPrometheusMetrics());
});

// --------------------
// STATUS (Real-time)
// --------------------
app.get("/status", async (req, res) => {
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

// --------------------
// ERROR HANDLER
// --------------------
app.use((err, req, res, next) => {
  const status = err.statusCode || 500;

  logError(err.message, {
    reqId: req.requestId,
  });

  if (err.details) {
    logError(JSON.stringify(err.details), {
      reqId: req.requestId,
    });
  }

  return res.status(status).json(
    ApiResponse.error(err.message, err.code || "INTERNAL_ERROR")
  );
});

const PORT = Number(process.env.PORT || 4000);
const server = app.listen(PORT, "0.0.0.0", () => {
  info(`server started on port ${PORT}`);

  const workers = Number(process.env.WORKERS || 2);
  for (let i = 1; i <= workers; i++) startWorker(i);
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  info(`${signal} received, shutting down gracefully`);
  server.close(() => {
    info("server closed");
    process.exit(0);
  });
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
