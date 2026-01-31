import healthRoutes from "./health.routes.js";
import jobRoutes from "./job.routes.js";
import monitoringRoutes from "./monitoring.routes.js";

/**
 * Configure all API routes
 */
export function configureRoutes(app) {
  app.use(healthRoutes);
  app.use(jobRoutes);
  app.use(monitoringRoutes);
}
