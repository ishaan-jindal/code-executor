import type { ErrorRequestHandler } from "express";
import { error as logError } from "../infrastructure/logs/logger.ts";
import { ApiResponse } from "../utils/apiResponse.ts";

/**
 * Global error handler middleware
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const apiError = err as { statusCode?: number; message?: string; code?: string; details?: unknown };
  const status = apiError.statusCode || 500;
  const message = apiError.message || "Internal error";

  logError(message, {
    reqId: req.requestId,
  });

  if (apiError.details) {
    logError(JSON.stringify(apiError.details), {
      reqId: req.requestId,
    });
  }

  return res.status(status).json(
    ApiResponse.error(message, apiError.code || "INTERNAL_ERROR")
  );
};
