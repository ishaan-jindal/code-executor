import { dequeueJob } from "../jobs/jobQueue.js";
import { getJob, updateJob } from "../jobs/jobStore.js";
import { JobStatus } from "../jobs/jobTypes.js";
import runCode from "../runner/runCode.js";

export async function startWorker(id) {
  console.log(`[WORKER ${id}] started`);

  while (true) {
    try {
      const jobId = await dequeueJob();
      if (!jobId) continue;

      const job = await getJob(jobId);
      if (!job) continue;

      await updateJob(jobId, {
        status: JobStatus.RUNNING,
        started_at: Date.now(),
      });

      const result = await runCode(job);

      await updateJob(jobId, {
        status: result.status,
        stdout: result.stdout,
        stderr: result.stderr,
        exit_code: result.exit_code,
        finished_at: Date.now(),
      });
    } catch (err) {
      console.error(`[WORKER ${id}] crashed but recovered`, err);
    }
  }
}
