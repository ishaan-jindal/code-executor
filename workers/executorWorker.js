import { dequeueJob } from "../jobs/jobQueue.js";
import { getJob, updateJob } from "../jobs/jobStore.js";
import { JobStatus } from "../jobs/jobTypes.js";
import runCode from "../runner/runCode.js";
import { executionLimiter } from "../limits/executionLimiter.js";
import { metrics } from "../metrics/metricsCollector.js";

export async function startWorker(id) {
  console.log(`[WORKER ${id}] started`);

  let consecutiveErrors = 0;

  while (true) {
    try {
      const jobId = await dequeueJob();
      if (!jobId) continue;

      const job = await getJob(jobId);
      if (!job) {
        console.warn(`[WORKER ${id}] job ${jobId} not found, skipping`);
        continue;
      }

      const queueWaitTime = Date.now() - job.created_at;

      await updateJob(jobId, {
        status: JobStatus.RUNNING,
        started_at: Date.now(),
      });

      const executionStart = Date.now();
      const result = await executionLimiter.run(() => runCode(job));
      const executionTime = Date.now() - executionStart;

      await updateJob(jobId, {
        status: result.status,
        stdout: result.stdout,
        stderr: result.stderr,
        exit_code: result.exit_code,
        finished_at: Date.now(),
      });

      // Record metrics
      metrics.recordCompletion(result.status, job.language, executionTime, queueWaitTime);

      consecutiveErrors = 0;
    } catch (err) {
      consecutiveErrors++;
      metrics.recordWorkerError();
      const backoff = Math.min(100 * Math.pow(2, consecutiveErrors - 1), 5000);
      console.error(`[WORKER ${id}] error (attempt ${consecutiveErrors}):`, err.message);
      
      // Reset errors on successful retry after backoff
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }
}
