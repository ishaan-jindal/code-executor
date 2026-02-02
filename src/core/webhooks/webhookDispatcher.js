import https from "https";
import http from "http";
import crypto from "crypto";
import { info, warn, error } from "../../infrastructure/logs/logger.js";
import {
  recordWebhookDelivery,
  incrementFailedAttempts,
  resetFailedAttempts,
  getUserWebhooks,
} from "./webhookStore.js";

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 5000, 15000]; // ms

/**
 * Create HMAC signature for webhook payload
 * @param {string} payload - JSON payload
 * @param {string} secret - Secret key
 * @returns {string} - HMAC signature
 */
function createSignature(payload, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
}

/**
 * Deliver webhook payload
 * @param {string} url - Webhook URL
 * @param {Object} payload - Payload to send
 * @param {string} secret - Optional secret for HMAC
 * @returns {Promise<Object>} - Delivery result
 */
function deliverWebhook(url, payload, secret) {
  return new Promise((resolve) => {
    const payloadStr = JSON.stringify(payload);
    const signature = secret ? createSignature(payloadStr, secret) : null;

    let attemptCount = 0;

    const tryDeliver = () => {
      attemptCount++;
      const isLastAttempt = attemptCount === MAX_RETRIES;

      try {
        const urlObj = new URL(url);
        const client = urlObj.protocol === "https:" ? https : http;
        const timeout = 10000; // 10 seconds

        const options = {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payloadStr),
            "User-Agent": "code-executor/1.0",
            "X-Webhook-Delivery": crypto.randomUUID(),
          },
          timeout,
        };

        if (signature) {
          options.headers["X-Webhook-Signature"] = `sha256=${signature}`;
        }

        const req = client.request(urlObj, options, (res) => {
          let body = "";

          res.on("data", (chunk) => {
            body += chunk;
          });

          res.on("end", () => {
            const success = res.statusCode >= 200 && res.statusCode < 300;

            if (success) {
              resolve({
                success: true,
                status: res.statusCode,
                attempts: attemptCount,
                response_body: body.substring(0, 500), // Truncate
              });
            } else if (isLastAttempt) {
              resolve({
                success: false,
                status: res.statusCode,
                attempts: attemptCount,
                error: `HTTP ${res.statusCode}`,
              });
            } else {
              // Retry
              setTimeout(tryDeliver, RETRY_DELAYS[attemptCount - 1]);
            }
          });
        });

        req.on("error", (err) => {
          if (isLastAttempt) {
            resolve({
              success: false,
              attempts: attemptCount,
              error: err.message,
            });
          } else {
            // Retry
            setTimeout(tryDeliver, RETRY_DELAYS[attemptCount - 1]);
          }
        });

        req.on("timeout", () => {
          req.destroy();
          if (isLastAttempt) {
            resolve({
              success: false,
              attempts: attemptCount,
              error: "Request timeout",
            });
          } else {
            setTimeout(tryDeliver, RETRY_DELAYS[attemptCount - 1]);
          }
        });

        req.write(payloadStr);
        req.end();
      } catch (err) {
        resolve({
          success: false,
          attempts: attemptCount,
          error: err.message,
        });
      }
    };

    tryDeliver();
  });
}

/**
 * Trigger webhooks for a job event
 * @param {string} userId - User ID
 * @param {string} eventType - Event type (e.g., "job.completed")
 * @param {Object} jobData - Job data to send in payload
 */
export async function triggerWebhooks(userId, eventType, jobData) {
  try {
    const webhooks = await getUserWebhooks(userId);

    for (const webhook of webhooks) {
      // Check if webhook is subscribed to this event
      if (!webhook.events.includes(eventType)) {
        continue;
      }

      // Don't retry failed webhooks
      if (webhook.status === "failed") {
        continue;
      }

      // Build payload
      const payload = {
        event: eventType,
        timestamp: Date.now(),
        data: jobData,
      };

      // Send webhook asynchronously (fire and forget)
      deliverWebhook(webhook.url, payload, webhook.secret)
        .then(async (result) => {
          await recordWebhookDelivery(webhook.id, result);

          if (result.success) {
            // Reset failed attempts on success
            await resetFailedAttempts(webhook.id);
            info(`Webhook delivered: ${webhook.id}`, {
              webhook_id: webhook.id,
              event: eventType,
              attempts: result.attempts,
            });
          } else {
            await incrementFailedAttempts(webhook.id);
            warn(`Webhook delivery failed: ${webhook.id}`, {
              webhook_id: webhook.id,
              event: eventType,
              attempts: result.attempts,
              error: result.error,
            });
          }
        })
        .catch((err) => {
          error(`Webhook trigger error: ${webhook.id}`, {
            webhook_id: webhook.id,
            error: err.message,
          });
        });
    }
  } catch (err) {
    error("Error triggering webhooks", {
      user_id: userId,
      event: eventType,
      error: err.message,
    });
  }
}

/**
 * Trigger webhook for job completion
 * @param {string} userId - User ID
 * @param {Object} job - Job object
 */
export async function onJobCompleted(userId, job) {
  const jobData = {
    id: job.id,
    language: job.language,
    status: job.status,
    created_at: job.created_at,
    completed_at: Date.now(),
    output: job.output,
    error: job.error,
    compile_error: job.compile_error,
    metrics: job.metrics,
  };

  await triggerWebhooks(userId, "job.completed", jobData);
}
