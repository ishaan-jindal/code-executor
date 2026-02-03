import "dotenv/config";
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";

import { requestLogger } from "./src/infrastructure/logs/requestLogger.js";
import { info } from "./src/infrastructure/logs/logger.js";
import { errorHandler } from "./src/middleware/errorHandler.js";
import { configureRoutes } from "./src/api/routes/index.js";
import { startWorker } from "./src/core/workers/executorWorker.js";

const app = express();

// Middleware
app.use(cors());
app.use(requestLogger);
app.use(bodyParser.json({ limit: "100kb" }));

// Routes
configureRoutes(app);

// Error Handler
app.use(errorHandler);

// Start Server
const PORT = Number(process.env.PORT || 4000);
const server = app.listen(PORT, "0.0.0.0", () => {
  info(`server started on port ${PORT}`);

  const workers = Number(process.env.WORKERS || 2);
  for (let i = 1; i <= workers; i++) startWorker(i);
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  info(`${signal} received, shutting down gracefully`);
  server.close(() => {
    info("server closed");
    process.exit(0);
  });
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
