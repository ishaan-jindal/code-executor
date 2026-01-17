import express from "express";
import bodyParser from "body-parser";
import fs from "fs";

import { runCode } from "./runner/runCode.js";
import { executionLimiter } from "./limits/executionLimiter.js";
import { requestLogger } from "./logs/requestLogger.js";
import { ApiError } from "./utils/apiError.js";

const app = express();

app.use(requestLogger);
app.use(bodyParser.json({ limit: "100kb" }));

app.post("/submit", async (req, res, next) => {
  try {
    const { language, code, stdin } = req.body;
    const reqId = req.requestId;

    if (!language || !code) {
      throw new ApiError(400, "Missing langauge or code");
    }

    console.log(`[REQ ${reqId}] Code size: ${code.length} bytes`);

    if (code.length > 100_000) {
      throw new ApiError(413, "Code too large");
    }

    console.log(`[REQ ${reqId}] Running Code...`);

    const result = await executionLimiter.run(() =>
      runCode({
        language: language,
        code: code,
        input: stdin ?? ""
      })
    );

    return res.status(200).json({
      result
    });

    console.log(`[REQ ${reqId}] Testcases PASSED`);

  } catch (err) {
    next(err);
  }
});

app.get("/languages", (req, res, next) => {
  const langs = ["C", "Python"];
  res.json({
    languages: langs
  });
});

app.listen(4000, "0.0.0.0", () => {
  console.log("Server running on port 4000");
});

app.use((err, req, res, next) => {
  const status = err.statusCode || 500;

  console.error(
    `[ERROR] ${req.requestId || "-"} | ${status} | ${err.message}`
  );

  if (err.details) {
    console.error("Details:", err.details);
  }

  res.status(status).json({
    error: err.message
  });
});

