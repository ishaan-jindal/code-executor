import crypto from "crypto";
import type { RequestHandler } from "express";
import { info } from "./logger.ts";

export const requestLogger: RequestHandler = (req, res, next) => {
  const reqId = crypto.randomUUID();
  req.requestId = reqId;

  const start = Date.now();

  info(`${req.method} ${req.url}`, { reqId });

  res.on("finish", () => {
    const ms = Date.now() - start;
    info(`completed ${res.statusCode} in ${ms}ms`, { reqId });
  });

  next();
};
