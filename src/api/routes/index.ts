import healthRoutes from "./health.routes.ts";
import jobRoutes from "./job.routes.ts";
import monitoringRoutes from "./monitoring.routes.ts";
import authRoutes from "./auth.routes.ts";
import adminRoutes from "./admin.routes.ts";
import webhooksRoutes from "./webhooks.routes.ts";

/**
 * Configure all API routes
 */
export function configureRoutes(app) {
  app.use("/auth", authRoutes);
  app.use("/admin", adminRoutes);
  app.use(healthRoutes);
  app.use(jobRoutes);
  app.use(monitoringRoutes);
  app.use(webhooksRoutes);
}
