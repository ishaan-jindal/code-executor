export interface LegacyJobResult {
  stdin?: string;
  status?: string;
  stdout: string;
  stderr: string;
  exit_code: number | null;
}

export interface LegacyJobResponse {
  job_id: string;
  status: string;
  metrics?: Record<string, unknown>;
  results?: LegacyJobResult[];
}

export type ApiSuccessResponse<T> = { success: true; data: T };
export type ApiErrorResponse = { success: false; error: string; code?: string; details?: unknown };

export class ApiResponse {
  static success<T>(data: T): ApiSuccessResponse<T> {
    return { success: true, data };
  }

  static error(message: string, code: string | null = null, details: unknown = null): ApiErrorResponse {
    const response: ApiErrorResponse = { success: false, error: message };
    if (code) response.code = code;
    if (details) response.details = details;
    return response;
  }

  static jobResponse(job: {
    id: string;
    status: string;
    metrics?: Record<string, unknown>;
    results?: LegacyJobResult[];
    stdout?: string;
    stderr?: string;
    exit_code?: number | null;
  }, includeOutput = false): LegacyJobResponse {
    const response: LegacyJobResponse = { job_id: String(job.id), status: String(job.status) };
    if (job.metrics) response.metrics = job.metrics;

    if (includeOutput) {
      response.results = Array.isArray(job.results)
        ? (job.results as LegacyJobResult[])
        : [{ stdout: job.stdout || "", stderr: job.stderr || "", exit_code: job.exit_code ?? null }];
    }

    return response;
  }
}
