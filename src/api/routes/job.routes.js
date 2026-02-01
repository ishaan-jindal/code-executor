import express from "express";
import crypto from "crypto";
import { info } from "../../infrastructure/logs/logger.js";
import { ApiError } from "../../utils/apiError.js";
import { ApiResponse } from "../../utils/apiResponse.js";
import { metrics } from "../../infrastructure/metrics/metricsCollector.js";
import { createJob, getJob } from "../../core/jobs/jobStore.js";
import { enqueueJob } from "../../core/jobs/jobQueue.js";
import { JobStatus } from "../../core/jobs/jobTypes.js";
import { authenticateJWT } from "../../middleware/authMiddleware.js";
import { rateLimitByUser, checkRateLimit } from "../../middleware/rateLimiter.js";

const router = express.Router();

/**
 * Submit Code for Execution
 * POST /submit
 * Requires JWT authentication and enforces rate limiting
 */
router.post("/submit", authenticateJWT, rateLimitByUser(), async (req, res, next) => {
  try {
    const { language, code, stdin } = req.body;
    const reqId = req.requestId;
    const userId = req.user.id;

    if (!language || !code) {
      throw new ApiError(400, "Missing language or code");
    }

    if (stdin !== undefined && typeof stdin !== "string") {
      throw new ApiError(400, "stdin must be a string");
    }

    info(`submission received`, { reqId, userId });
    info(`code size ${code.length} bytes`, { reqId });

    if (code.length > 100_000) {
      throw new ApiError(413, "Code too large");
    }

    if (stdin && stdin.length > 100_000) {
      throw new ApiError(413, "stdin too large");
    }

    const jobId = crypto.randomUUID();

    await createJob({
      id: jobId,
      userId,
      language,
      code,
      stdin: stdin ?? "",
      status: JobStatus.QUEUED,
      created_at: Date.now(),
    });

    await enqueueJob(jobId);

    info(`job queued`, { reqId, jobId, userId });

    // Record metrics
    metrics.recordSubmission(language);

    return res.status(201).json(
      ApiResponse.jobResponse({ id: jobId, status: JobStatus.QUEUED })
    );
  } catch (err) {
    next(err);
  }
});

/**
 * Get Job Result
 * GET /result/:id
 * Requires JWT authentication - users can only see their own jobs
 * Rate limit check (doesn't increment)
 */
router.get("/result/:id", authenticateJWT, checkRateLimit(), async (req, res, next) => {
  try {
    const jobId = req.params.id;
    const userId = req.user.id;
    const job = await getJob(jobId);

    if (!job) {
      return res.status(404).json(
        ApiResponse.error("Job not found", "JOB_NOT_FOUND")
      );
    }

    // Users can only see their own jobs
    if (job.userId !== userId) {
      return res.status(403).json(
        ApiResponse.error("Forbidden", "FORBIDDEN")
      );
    }

    const includeOutput =
      job.status !== JobStatus.QUEUED && job.status !== JobStatus.RUNNING;

    return res.json(ApiResponse.jobResponse(job, includeOutput));
  } catch (err) {
    next(err);
  }
});

export default router;
