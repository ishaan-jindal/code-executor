import crypto from "crypto";

export function requestLogger(req, res, next) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  req.requestId = requestId;

  console.log(
    `\n[REQ ${requestId}] ${new Date().toISOString()}`
  );
  console.log(
    `[REQ ${requestId}] ${req.method} ${req.originalUrl}`
  );

  res.on("finish", () => {
    const duration = Date.now() - startTime;

    console.log(
      `[RES ${requestId}] Status: ${res.statusCode} | ${duration} ms`
    );
    console.log(
      `[END ${requestId}]`
    );
  });

  next();
}

