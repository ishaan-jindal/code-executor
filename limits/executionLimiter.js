class ExecutionLimiter {
  constructor(maxConcurrent) {
    this.max = maxConcurrent;
    this.running = 0;
    this.queue = [];
  }

  async run(task) {
    if (this.running >= this.max) {
      await new Promise(resolve => this.queue.push(resolve));
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

export const executionLimiter = new ExecutionLimiter(10);

