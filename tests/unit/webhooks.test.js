#!/usr/bin/env node

/**
 * Webhook Store Unit Tests
 * Tests webhook CRUD operations and delivery tracking
 */

import { redis } from "../../src/infrastructure/redis/redisClient.js";
import {
  createWebhook,
  getWebhook,
  deleteWebhook,
  getUserWebhooks,
  updateWebhookStatus,
  incrementFailedAttempts,
  resetFailedAttempts,
  recordWebhookDelivery,
  getWebhookDeliveries,
  WEBHOOK_STATUS,
} from "../../src/core/webhooks/webhookStore.js";

const TEST_USER_ID = "test-user-webhook-123";
const TEST_URL = "https://example.com/webhook";

// Helper to clean up test data
async function cleanup() {
  const keys = await redis.keys(`webhook:*`);
  const userKeys = await redis.keys(`user:${TEST_USER_ID}:*`);
  
  if (keys.length > 0) {
    await redis.del(...keys);
  }
  if (userKeys.length > 0) {
    await redis.del(...userKeys);
  }
}

async function runTests() {
  console.log("🧪 Webhook Store Unit Tests\n");

  let testsPassed = 0;
  let testsFailed = 0;

  try {
    // Setup
    await cleanup();

    // Test 1: Create webhook
    console.log("Test 1: Create webhook");
    const webhook1 = await createWebhook(TEST_USER_ID, TEST_URL, {
      events: ["job.completed"],
      secret: "test-secret",
    });

    if (
      webhook1.userId === TEST_USER_ID &&
      webhook1.url === TEST_URL &&
      webhook1.status === WEBHOOK_STATUS.ACTIVE &&
      webhook1.events.includes("job.completed")
    ) {
      console.log("✓ Webhook created successfully\n");
      testsPassed++;
    } else {
      console.log("✗ Webhook creation failed\n");
      testsFailed++;
    }

    // Test 2: Get webhook
    console.log("Test 2: Get webhook by ID");
    const retrieved = await getWebhook(webhook1.id);

    if (retrieved && retrieved.id === webhook1.id && retrieved.url === TEST_URL) {
      console.log("✓ Webhook retrieved successfully\n");
      testsPassed++;
    } else {
      console.log("✗ Webhook retrieval failed\n");
      testsFailed++;
    }

    // Test 3: Get user webhooks
    console.log("Test 3: Get all user webhooks");
    const webhook2 = await createWebhook(TEST_USER_ID, "https://example.com/webhook2");
    const userWebhooks = await getUserWebhooks(TEST_USER_ID);

    if (userWebhooks.length === 2) {
      console.log("✓ User webhooks retrieved successfully\n");
      testsPassed++;
    } else {
      console.log(`✗ Expected 2 webhooks, got ${userWebhooks.length}\n`);
      testsFailed++;
    }

    // Test 4: Update webhook status
    console.log("Test 4: Update webhook status");
    await updateWebhookStatus(webhook1.id, WEBHOOK_STATUS.INACTIVE);
    const updated = await getWebhook(webhook1.id);

    if (updated.status === WEBHOOK_STATUS.INACTIVE) {
      console.log("✓ Webhook status updated successfully\n");
      testsPassed++;
    } else {
      console.log("✗ Webhook status update failed\n");
      testsFailed++;
    }

    // Test 5: Increment failed attempts
    console.log("Test 5: Increment failed attempts");
    await incrementFailedAttempts(webhook1.id);
    await incrementFailedAttempts(webhook1.id);
    const afterFails = await getWebhook(webhook1.id);

    if (afterFails.failed_attempts === 2) {
      console.log("✓ Failed attempts incremented correctly\n");
      testsPassed++;
    } else {
      console.log(`✗ Expected 2 failed attempts, got ${afterFails.failed_attempts}\n`);
      testsFailed++;
    }

    // Test 6: Reset failed attempts
    console.log("Test 6: Reset failed attempts");
    await resetFailedAttempts(webhook1.id);
    const afterReset = await getWebhook(webhook1.id);

    if (afterReset.failed_attempts === 0 && afterReset.status === WEBHOOK_STATUS.ACTIVE) {
      console.log("✓ Failed attempts reset successfully\n");
      testsPassed++;
    } else {
      console.log("✗ Failed attempts reset failed\n");
      testsFailed++;
    }

    // Test 7: Record webhook delivery
    console.log("Test 7: Record webhook delivery");
    await recordWebhookDelivery(webhook1.id, {
      success: true,
      status: 200,
      attempts: 1,
      response_body: "OK",
    });

    const deliveries = await getWebhookDeliveries(webhook1.id, 10);

    if (deliveries.length === 1 && deliveries[0].success === true) {
      console.log("✓ Webhook delivery recorded successfully\n");
      testsPassed++;
    } else {
      console.log("✗ Webhook delivery recording failed\n");
      testsFailed++;
    }

    // Test 8: Delete webhook
    console.log("Test 8: Delete webhook");
    const deleted = await deleteWebhook(TEST_USER_ID, webhook1.id);
    const afterDelete = await getWebhook(webhook1.id);

    if (deleted && !afterDelete) {
      console.log("✓ Webhook deleted successfully\n");
      testsPassed++;
    } else {
      console.log("✗ Webhook deletion failed\n");
      testsFailed++;
    }

    // Test 9: Invalid webhook URL
    console.log("Test 9: Reject invalid webhook URL");
    try {
      await createWebhook(TEST_USER_ID, "not-a-valid-url");
      console.log("✗ Should have rejected invalid URL\n");
      testsFailed++;
    } catch (err) {
      if (err.message.includes("Invalid webhook URL")) {
        console.log("✓ Invalid URL rejected correctly\n");
        testsPassed++;
      } else {
        console.log("✗ Wrong error for invalid URL\n");
        testsFailed++;
      }
    }

    // Test 10: Auto-disable after 10 failures
    console.log("Test 10: Auto-disable webhook after 10 failures");
    const webhook3 = await createWebhook(TEST_USER_ID, "https://example.com/webhook3");
    
    for (let i = 0; i < 10; i++) {
      await incrementFailedAttempts(webhook3.id);
    }

    const autoDisabled = await getWebhook(webhook3.id);

    if (autoDisabled.status === WEBHOOK_STATUS.FAILED && autoDisabled.failed_attempts === 10) {
      console.log("✓ Webhook auto-disabled after 10 failures\n");
      testsPassed++;
    } else {
      console.log("✗ Webhook should be auto-disabled after 10 failures\n");
      testsFailed++;
    }

    // Cleanup
    await cleanup();

    // Summary
    console.log("\n" + "=".repeat(50));
    console.log(`Tests Passed: ${testsPassed}`);
    console.log(`Tests Failed: ${testsFailed}`);
    console.log("=".repeat(50));

    process.exit(testsFailed > 0 ? 1 : 0);
  } catch (err) {
    console.error("\n❌ Test suite error:", err.message);
    console.error(err.stack);
    await cleanup();
    process.exit(1);
  }
}

runTests();
