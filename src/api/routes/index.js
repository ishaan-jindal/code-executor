import healthRoutes from "./health.routes.js";
import jobRoutes from "./job.routes.js";
import monitoringRoutes from "./monitoring.routes.js";
import authRoutes from "./auth.routes.js";
import adminRoutes from "./admin.routes.js";

/**
 * Configure all API routes
 */
export function configureRoutes(app) {
  app.use("/auth", authRoutes);
  app.use("/admin", adminRoutes);
  app.use(healthRoutes);
  app.use(jobRoutes);
  app.use(monitoringRoutes);
}
