import { redis } from "../../infrastructure/redis/redisClient.js";

// ioredis methods already return Promises, no need to promisify
const redisGet = redis.get.bind(redis);
const redisSet = redis.set.bind(redis);
const redisDel = redis.del.bind(redis);
const redisKeys = redis.keys.bind(redis);
const redisHGetAll = redis.hgetall.bind(redis);
const redisHSet = redis.hset.bind(redis);
const redisHDel = redis.hdel.bind(redis);
const redisScan = redis.scan.bind(redis);

export const WEBHOOK_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  FAILED: "failed",
};

/**
 * Register a webhook for a user
 * @param {string} userId - User ID
 * @param {string} url - Webhook URL
 * @param {Object} options - Events to subscribe to, secret for HMAC
 * @returns {Promise<Object>} - Created webhook
 */
export async function createWebhook(userId, url, options = {}) {
  if (!url || typeof url !== "string") {
    throw new Error("Invalid webhook URL");
  }

  try {
    new URL(url);
  } catch {
    throw new Error("Invalid webhook URL format");
  }

  const webhookId = `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const webhook = {
    id: webhookId,
    userId,
    url,
    events: options.events || ["job.completed"],
    status: WEBHOOK_STATUS.ACTIVE,
    secret: options.secret || null,
    created_at: Date.now(),
    updated_at: Date.now(),
    failed_attempts: 0,
  };

  const key = `webhook:${webhookId}`;
  await redisSet(key, JSON.stringify(webhook), "EX", 7776000); // 90 days

  // Index for user's webhooks
  await redisSet(`user:${userId}:webhooks:${webhookId}`, "1", "EX", 7776000);

  return webhook;
}

/**
 * Get a webhook by ID
 * @param {string} webhookId - Webhook ID
 * @returns {Promise<Object|null>} - Webhook object or null
 */
export async function getWebhook(webhookId) {
  const data = await redisGet(`webhook:${webhookId}`);
  return data ? JSON.parse(data) : null;
}

/**
 * Delete a webhook
 * @param {string} userId - User ID (for authorization)
 * @param {string} webhookId - Webhook ID to delete
 * @returns {Promise<boolean>} - True if deleted
 */
export async function deleteWebhook(userId, webhookId) {
  const webhook = await getWebhook(webhookId);
  
  if (!webhook) {
    return false;
  }

  if (webhook.userId !== userId) {
    throw new Error("Unauthorized: webhook belongs to different user");
  }

  await redisDel(`webhook:${webhookId}`);
  await redisDel(`user:${userId}:webhooks:${webhookId}`);

  return true;
}

/**
 * Get all webhooks for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Array of webhooks
 */
export async function getUserWebhooks(userId) {
  const pattern = `user:${userId}:webhooks:*`;
  const keys = await redisKeys(pattern);

  if (keys.length === 0) {
    return [];
  }

  const webhooks = [];
  for (const key of keys) {
    const webhookId = key.split(":").pop();
    const webhook = await getWebhook(webhookId);
    if (webhook) {
      webhooks.push(webhook);
    }
  }

  return webhooks;
}

/**
 * Record a webhook delivery attempt
 * @param {string} webhookId - Webhook ID
 * @param {Object} delivery - Delivery record
 */
export async function recordWebhookDelivery(webhookId, delivery) {
  const key = `webhook:${webhookId}:deliveries`;
  const deliveryId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  await redisSet(
    `${key}:${deliveryId}`,
    JSON.stringify({
      ...delivery,
      timestamp: Date.now(),
    }),
    "EX",
    2592000 // 30 days
  );

  // Keep last 100 deliveries
  const pattern = `${key}:*`;
  const deliveries = await redisKeys(pattern);
  if (deliveries.length > 100) {
    // Sort and delete oldest
    const oldest = deliveries.sort().slice(0, deliveries.length - 100);
    for (const del of oldest) {
      await redisDel(del);
    }
  }
}

/**
 * Get webhook delivery history
 * @param {string} webhookId - Webhook ID
 * @param {number} limit - Max deliveries to return
 * @returns {Promise<Array>} - Delivery records
 */
export async function getWebhookDeliveries(webhookId, limit = 50) {
  const pattern = `webhook:${webhookId}:deliveries:*`;
  const keys = await redisKeys(pattern);

  if (keys.length === 0) {
    return [];
  }

  const deliveries = [];
  const sorted = keys.sort().reverse().slice(0, limit);

  for (const key of sorted) {
    const data = await redisGet(key);
    if (data) {
      deliveries.push(JSON.parse(data));
    }
  }

  return deliveries;
}

/**
 * Update webhook status
 * @param {string} webhookId - Webhook ID
 * @param {string} status - New status
 */
export async function updateWebhookStatus(webhookId, status) {
  const webhook = await getWebhook(webhookId);
  if (!webhook) return;

  webhook.status = status;
  webhook.updated_at = Date.now();

  const key = `webhook:${webhookId}`;
  await redisSet(key, JSON.stringify(webhook), "EX", 7776000);
}

/**
 * Increment failed attempts for a webhook
 * @param {string} webhookId - Webhook ID
 */
export async function incrementFailedAttempts(webhookId) {
  const webhook = await getWebhook(webhookId);
  if (!webhook) return;

  webhook.failed_attempts = (webhook.failed_attempts || 0) + 1;

  // Disable after 10 failed attempts
  if (webhook.failed_attempts >= 10) {
    webhook.status = WEBHOOK_STATUS.FAILED;
  }

  webhook.updated_at = Date.now();

  const key = `webhook:${webhookId}`;
  await redisSet(key, JSON.stringify(webhook), "EX", 7776000);
}

/**
 * Reset failed attempts for a webhook
 * @param {string} webhookId - Webhook ID
 */
export async function resetFailedAttempts(webhookId) {
  const webhook = await getWebhook(webhookId);
  if (!webhook) return;

  webhook.failed_attempts = 0;
  webhook.status = WEBHOOK_STATUS.ACTIVE;
  webhook.updated_at = Date.now();

  const key = `webhook:${webhookId}`;
  await redisSet(key, JSON.stringify(webhook), "EX", 7776000);
}
