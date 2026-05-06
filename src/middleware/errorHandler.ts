import { error as logError } from "../infrastructure/logs/logger.ts";
import { ApiResponse } from "../utils/apiResponse.ts";

/**
 * Global error handler middleware
 */
export function errorHandler(err, req, res, next) {
  const status = err.statusCode || 500;

  logError(err.message, {
    reqId: req.requestId,
  });

  if (err.details) {
    logError(JSON.stringify(err.details), {
      reqId: req.requestId,
    });
  }

  return res.status(status).json(
    ApiResponse.error(err.message, err.code || "INTERNAL_ERROR")
  );
}
