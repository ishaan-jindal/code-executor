import express from "express";
import crypto from "crypto";
import { info } from "../../infrastructure/logs/logger.js";
import { ApiError } from "../../utils/apiError.js";
import { ApiResponse } from "../../utils/apiResponse.js";
import { metrics } from "../../infrastructure/metrics/metricsCollector.js";
import { createJob, getJob } from "../../core/jobs/jobStore.js";
import { enqueueJob } from "../../core/jobs/jobQueue.js";
import { JobStatus } from "../../core/jobs/jobTypes.js";

const router = express.Router();

/**
 * Submit Code for Execution
 * POST /submit
 */
router.post("/submit", async (req, res, next) => {
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

/**
 * Get Job Result
 * GET /result/:id
 */
router.get("/result/:id", async (req, res, next) => {
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

export default router;
