import express from "express";
import bodyParser from "body-parser";
import crypto from "crypto";

import { requestLogger } from "./logs/requestLogger.js";
import { info, error as logError } from "./logs/logger.js";
import { ApiError } from "./utils/apiError.js";

import { createJob, getJob } from "./jobs/jobStore.js";
import { enqueueJob } from "./jobs/jobQueue.js";
import { JobStatus } from "./jobs/jobTypes.js";

import { startWorker } from "./workers/executorWorker.js";

const app = express();

app.use(requestLogger);
app.use(bodyParser.json({ limit: "100kb" }));

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
      created_at: Date.now()
    });

    await enqueueJob(jobId);

    info(`job queued`, { reqId, jobId });

    res.json({
      job_id: jobId,
      status: JobStatus.QUEUED
    });

    info(`submit response sent`, { reqId, jobId });

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
      return res.status(404).json({ error: "JOB_NOT_FOUND" });
    }

    if (
      job.status === JobStatus.QUEUED ||
      job.status === JobStatus.RUNNING
    ) {
      return res.json({
        job_id: job.id,
        status: job.status
      });
    }
    
    return res.json({
      job_id: job.id,
      status: job.status,
      stdout: job.stdout ?? "",
      stderr: job.stderr ?? "",
      exit_code:
        job.exit_code !== undefined
          ? Number(job.exit_code)
          : null
    });
  } catch (err) {
    next(err);
  }
});

// --------------------
// ERROR HANDLER
// --------------------
app.use((err, req, res, next) => {
  const status = err.statusCode || 500;

  logError(err.message, {
    reqId: req.requestId
  });

  if (err.details) {
    logError(JSON.stringify(err.details), {
      reqId: req.requestId
    });
  }

  res.status(status).json({
    error: err.message
  });
});

app.listen(4000, "0.0.0.0", () => {
  info("server started on port 4000");

  startWorker(1);
  startWorker(2);
});

