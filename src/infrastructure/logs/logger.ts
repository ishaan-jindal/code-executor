interface LogMeta {
  reqId?: string;
  jobId?: string;
  [key: string]: unknown;
}

function time(): string {
  return new Date().toISOString();
}

export function log(level: string, message: string, meta: LogMeta = {}): void {
  const req = meta.reqId ? `REQ:${meta.reqId}` : "REQ:-";
  const job = meta.jobId ? `JOB:${meta.jobId}` : "JOB:-";

  console.log(`[${time()}] [${level}] [${req}] [${job}] ${message}`);
}

export const info = (msg: string, meta?: LogMeta): void => log("INFO", msg, meta);
export const warn = (msg: string, meta?: LogMeta): void => log("WARN", msg, meta);
export const error = (msg: string, meta?: LogMeta): void => log("ERROR", msg, meta);
