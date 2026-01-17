# Code-Executor

```
Client
  |
  | POST /submit
  v
API
  → jobs.set(job)
  → queue.push(jobId)
  → return jobId
  |
  v
Worker loop
  |
  → executionLimiter.run(job)
        |
        → docker execution
        |
        → update job.result
  |
Client polls
  |
  | GET /result/:id
  v
API returns current state
```
