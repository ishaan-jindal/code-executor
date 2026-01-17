import { jobs } from "../jobs/jobStore.js";
import { queue } from "../jobs/jobQueue.js";
import { JobStatus } from "../jobs/jobTypes.js";
import { executionLimiter } from "../limits/executionLimiter.js";
import runCode from "../runner/runCode.js";

setInterval(() => {
  if (queue.length === 0) return;

  // pull job
  const jobId = queue.shift();
  if (!jobId) return;

  const job = jobs.get(jobId);
  if (!job) return;

  // submit execution task to limiter
  executionLimiter.run(async () => {
    job.status = JobStatus.RUNNING;

    try {
      const result = await runCode(job);

      job.status = result.status;
      job.result = result;
    } catch (err) {
      job.status = JobStatus.SYSTEM_ERROR;
      job.result = {
        job_id: job.id,
        status: JobStatus.SYSTEM_ERROR,
        error: err?.message ?? "Execution failed"
      };
    }
  });
}, 5);

