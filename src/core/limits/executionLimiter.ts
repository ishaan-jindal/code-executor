import config from "../../config/index.ts";

/**
 * Concurrency limiter for code execution.
 * Limits the number of simultaneous Docker containers running.
 */
class ExecutionLimiter {
  constructor(maxConcurrent, maxQueue = 1000) {
    this.max = maxConcurrent;
    this.running = 0;
    this.queue = [];
    this.maxQueue = maxQueue;
  }

  async run(task) {
    if (this.running >= this.max) {
      if (this.queue.length >= this.maxQueue) {
        throw new Error("Queue full");
      }
      await new Promise((resolve) => this.queue.push(resolve));
    }

    this.running++;

    try {
      return await task();
    } finally {
      this.running--;
      if (this.queue.length > 0) {
        this.queue.shift()();
      }
    }
  }
}

export const executionLimiter = new ExecutionLimiter(
  config.maxConcurrent,
  config.maxQueue
);
