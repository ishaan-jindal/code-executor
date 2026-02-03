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
      if (Array.isArray(job.results)) {
        response.results = job.results;
      } else {
        response.results = [
          {
            stdin: job.stdin ?? "",
            status: job.status,
            stdout: job.stdout ?? "",
            stderr: job.stderr ?? "",
            exit_code: job.exit_code !== undefined ? Number(job.exit_code) : null,
          },
        ];
      }
    }

    return response;
  }
}
