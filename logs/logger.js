function time() {
  return new Date().toISOString().split("T")[1].replace("Z", "");
}

export function log(level, message, meta = {}) {
  const req = meta.reqId ? `REQ:${meta.reqId}` : "REQ:-";
  const job = meta.jobId ? `JOB:${meta.jobId}` : "JOB:-";

  console.log(
    `[${time()}] [${level}] [${req}] [${job}] ${message}`
  );
}

export const info = (msg, meta) => log("INFO", msg, meta);
export const warn = (msg, meta) => log("WARN", msg, meta);
export const error = (msg, meta) => log("ERROR", msg, meta);

