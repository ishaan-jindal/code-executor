import "dotenv/config";
import express from "express";
import cors from "cors";

import config, { getGVisorStatus } from "./src/config/index.js";
import { requestLogger } from "./src/infrastructure/logs/requestLogger.js";
import { info, warn } from "./src/infrastructure/logs/logger.js";
import { errorHandler } from "./src/middleware/errorHandler.js";
import { configureRoutes } from "./src/api/routes/index.js";
import { startWorker } from "./src/core/workers/executorWorker.js";
import { redis, redisBlocking } from "./src/infrastructure/redis/redisClient.js";

const app = express();

// Middleware
// CORS: Allow any origin for authenticated requests
// Security is via API Key / JWT authentication, not origin restriction
const corsOptions = {
  origin: true, // Reflect request origin (allows all)
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"],
  credentials: true,
};
app.use(cors(corsOptions));
app.use(requestLogger);
app.use(express.json({ limit: "100kb" }));

// Routes
configureRoutes(app);

// Error Handler
app.use(errorHandler);

// Start Server
const server = app.listen(config.port, "0.0.0.0", () => {
  info(`server started on port ${config.port}`);

  // Log gVisor status
  const gvisor = getGVisorStatus();
  if (gvisor.available) {
    info(`gVisor (runsc) runtime detected — sandbox hardening ENABLED (${gvisor.reason})`);
  } else {
    warn(`gVisor (runsc) not available — ${gvisor.reason}`);
  }

  // Start workers
  for (let i = 1; i <= config.workerCount; i++) startWorker(i);
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  info(`${signal} received, shutting down gracefully`);

  server.close(async () => {
    info("HTTP server closed");

    // Disconnect Redis clients
    try {
      await redis.quit();
      await redisBlocking.quit();
      info("Redis connections closed");
    } catch {
      // Ignore Redis disconnect errors during shutdown
    }

    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    warn("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
