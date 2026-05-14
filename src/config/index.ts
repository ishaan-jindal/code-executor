import { execFileSync } from "child_process";

/**
 * Centralized Configuration Module
 *
 * Single source of truth for all environment-driven configuration.
 * Validates required values on import and coerces types.
 */

// ─── Helpers ──────────────────────────────────────────────────

export interface GVisorStatus {
  available: boolean;
  reason: string;
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function requiredEnv(key: string): string {
  const value = process.env[key];
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, fallback: string): string {
  const value = process.env[key];
  return value !== undefined && value !== "" ? value : fallback;
}

function intEnv(key: string, fallback: number): number {
  const raw = optionalEnv(key, String(fallback));
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Environment variable ${key} must be a number, got: ${raw}`);
  }
  return parsed;
}

function boolEnv(key: string, fallback: boolean): boolean {
  const raw = optionalEnv(key, String(fallback));
  return raw === "true" || raw === "1";
}

/**
 * Parse time string (e.g., "15m", "7d") to seconds.
 * Supports s(econds), m(inutes), h(ours), d(ays).
 */
export function parseTimeToSeconds(timeStr: string): number {
  const match = String(timeStr).match(/^(\d+)([smhd])$/);
  if (!match) return 604800; // default 7 days

  const value = parseInt(match[1], 10);
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
  const unit = match[2] as keyof typeof multipliers;
  return value * (multipliers[unit] || 86400);
}

// ─── gVisor Detection ─────────────────────────────────────────

/**
 * Detect gVisor availability.
 * Returns { available: boolean, reason: string }
 */
function detectGVisor(): GVisorStatus {
  if (boolEnv("DISABLE_GVISOR", false)) {
    return { available: false, reason: "DISABLE_GVISOR is set to true in environment" };
  }

  try {
    const output = execFileSync(
      "docker",
      ["info", "--format", "{{json .Runtimes}}"],
      { timeout: 5000, stdio: "pipe", encoding: "utf-8" }
    );

    if (output.includes("runsc")) {
      return { available: true, reason: "runsc runtime found in Docker" };
    }

    return { available: false, reason: "runsc runtime not registered in Docker (see: gVisor install docs)" };
  } catch (err) {
    return { available: false, reason: `Docker check failed: ${getErrorMessage(err)}` };
  }
}

// ─── Configuration Object ─────────────────────────────────────

const config = Object.freeze({
  // Server
  port: intEnv("PORT", 4000),
  nodeEnv: optionalEnv("NODE_ENV", "development"),
  isProduction: optionalEnv("NODE_ENV", "development") === "production",

  // Workers
  workerCount: intEnv("WORKERS", 2),

  // Redis
  redisUrl: optionalEnv("REDIS_URL", "redis://localhost:6379"),

  // JWT
  jwtSecret: optionalEnv("JWT_SECRET", "change-this-secret-in-production"),
  jwtExpiresIn: optionalEnv("JWT_EXPIRES_IN", "15m"),
  refreshTokenExpiresIn: optionalEnv("REFRESH_TOKEN_EXPIRES_IN", "7d"),

  // Execution
  execTimeoutMs: intEnv("EXEC_TIMEOUT_MS", 2000),
  maxConcurrent: intEnv("MAX_CONCURRENT", 10),
  maxQueue: intEnv("MAX_QUEUE", 1000),

  // Job storage
  jobTtlSeconds: intEnv("JOB_TTL_SECONDS", 86400),

  // Sandbox
  gvisorEnabled: false, // set after detection below
  sandbox: Object.freeze({
    memoryLimit: "256m",
    cpuLimit: "0.5",
    pidsLimit: "32",
    network: "none",
    tmpfsSize: "16m",
    compileTmpfsSize: "64m",
    readOnly: true,
    user: "runner",
    securityOpts: ["no-new-privileges"],
    capDrop: ["ALL"],
  }),
});

// ─── gVisor: detect on startup (lazy, so tests can skip) ──────

let _gvisorResult: GVisorStatus | null = null;

export function isGVisorAvailable(): boolean {
  if (_gvisorResult === null) {
    _gvisorResult = detectGVisor();
  }
  return _gvisorResult.available;
}

/**
 * Get full gVisor detection status (for startup logging).
 * @returns {{ available: boolean, reason: string }}
 */
export function getGVisorStatus(): GVisorStatus {
  if (_gvisorResult === null) {
    _gvisorResult = detectGVisor();
  }
  return _gvisorResult;
}

/**
 * Override gVisor detection result (for testing).
 */
export function setGVisorOverride(value: boolean | null): void {
  if (value === null) {
    _gvisorResult = null;
  } else {
    _gvisorResult = { available: value, reason: "overridden by test" };
  }
}

export default config;
