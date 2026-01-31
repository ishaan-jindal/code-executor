import crypto from "crypto";
import { info } from "./logger.js";

export function requestLogger(req, res, next) {
  const reqId = crypto.randomUUID();
  req.requestId = reqId;

  const start = Date.now();

  info(`${req.method} ${req.url}`, { reqId });

  res.on("finish", () => {
    const ms = Date.now() - start;
    info(`completed ${res.statusCode} in ${ms}ms`, { reqId });
  });

  next();
}
