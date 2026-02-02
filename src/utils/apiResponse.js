export class ApiResponse {
  static success(data) {
    return {
      success: true,
      data,
    };
  }

  static error(message, code = null) {
    return {
      success: false,
      error: message,
      ...(code && { code }),
    };
  }

  static jobResponse(job, includeOutput = false) {
    const response = {
      job_id: job.id,
      status: job.status,
    };

    if (job.metrics) {
      response.metrics = job.metrics;
    }

    if (includeOutput) {
      response.stdout = job.stdout ?? "";
      response.stderr = job.stderr ?? "";
      response.exit_code = job.exit_code !== undefined ? Number(job.exit_code) : null;
    }

    return response;
  }
}
