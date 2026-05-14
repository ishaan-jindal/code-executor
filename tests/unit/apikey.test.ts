#!/usr/bin/env node

/**
 * API Key Store Unit Tests
 * Tests API key generation, validation, and revocation
 */

import { redis } from "../../src/infrastructure/redis/redisClient.ts";
import {
  generateApiKey,
  validateApiKey,
  revokeApiKey,
  listApiKeys,
} from "../../src/core/auth/apiKeyStore.ts";

const TEST_USER_ID = "test-user-apikey-456";
const TEST_USER = {
  id: TEST_USER_ID,
  username: "testuser",
  email: "test@example.com",
  tier: "free",
  rateLimit: 10,
  role: "user",
};

// Helper to clean up test data
async function cleanup() {
  const keys = await redis.keys(`apikey:*`);
  const userKeys = await redis.keys(`user:${TEST_USER_ID}:*`);
  const apikeyIdKeys = await redis.keys(`apikeyid:*`);
  
  if (keys.length > 0) {
    await redis.del(...keys);
  }
  if (userKeys.length > 0) {
    await redis.del(...userKeys);
  }
  if (apikeyIdKeys.length > 0) {
    await redis.del(...apikeyIdKeys);
  }
}

async function runTests() {
  console.log("🧪 API Key Store Unit Tests\n");

  let testsPassed = 0;
  let testsFailed = 0;

  try {
    // Setup
    await cleanup();

    // Create test user in Redis
    await redis.set(`user:${TEST_USER_ID}`, JSON.stringify(TEST_USER));

    // Test 1: Generate API key
    console.log("Test 1: Generate API key");
    const apiKeyResult = await generateApiKey(TEST_USER_ID);

    if (
      apiKeyResult.key &&
      apiKeyResult.key.startsWith("sk_live_") &&
      apiKeyResult.key.length === 72 && // sk_live_ (8) + 64 hex chars
      apiKeyResult.keyId
    ) {
      console.log("✓ API key generated successfully");
      console.log(`  Key prefix: ${apiKeyResult.key.substring(0, 20)}...`);
      console.log(`  Created: ${new Date(apiKeyResult.createdAt).toISOString()}\n`);
      testsPassed++;
    } else {
      console.log("✗ API key generation failed\n");
      testsFailed++;
      return;
    }

    const testKey = apiKeyResult.key;

    // Test 2: Validate API key
    console.log("Test 2: Validate API key");
    const validatedUser = await validateApiKey(testKey);

    if (
      validatedUser &&
      validatedUser.id === TEST_USER_ID &&
      validatedUser.username === TEST_USER.username
    ) {
      console.log("✓ API key validated successfully\n");
      testsPassed++;
    } else {
      console.log("✗ API key validation failed\n");
      testsFailed++;
    }

    // Test 3: Invalid API key
    console.log("Test 3: Reject invalid API key");
    const invalidUser = await validateApiKey("sk_live_invalid_key_12345678901234567890");

    if (invalidUser === null) {
      console.log("✓ Invalid API key correctly rejected\n");
      testsPassed++;
    } else {
      console.log("✗ Invalid API key should return null\n");
      testsFailed++;
    }

    // Test 4: Get user API keys
    console.log("Test 4: Get user API keys");
    const apiKey2 = await generateApiKey(TEST_USER_ID);
    const userKeys = await listApiKeys(TEST_USER_ID);

    if (userKeys.length === 2) {
      console.log("✓ Retrieved all user API keys\n");
      testsPassed++;
    } else {
      console.log(`✗ Expected 2 keys, got ${userKeys.length}\n`);
      testsFailed++;
    }

    // Test 5: API key includes last_used timestamp
    console.log("Test 5: Validate updates last_used");
    const beforeLastUsed = Date.now();
    await validateApiKey(testKey);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const keysAfterUse = await listApiKeys(TEST_USER_ID);
    const usedKey = keysAfterUse.find((k) => k.keyId === apiKeyResult.keyId);

    if (usedKey && usedKey.lastUsedAt && usedKey.lastUsedAt >= beforeLastUsed) {
      console.log("✓ last_used timestamp updated correctly\n");
      testsPassed++;
    } else {
      console.log("✗ last_used timestamp not updated\n");
      testsFailed++;
    }

    // Test 6: Revoke API key
    console.log("Test 6: Revoke API key");
    const revoked = await revokeApiKey(TEST_USER_ID, apiKeyResult.keyId);

    if (revoked === true) {
      console.log("✓ API key revoked successfully\n");
      testsPassed++;
    } else {
      console.log("✗ API key revocation failed\n");
      testsFailed++;
    }

    // Test 7: Revoked key cannot be validated
    console.log("Test 7: Revoked key validation fails");
    const revokedUser = await validateApiKey(testKey);

    if (revokedUser === null) {
      console.log("✓ Revoked API key correctly rejected\n");
      testsPassed++;
    } else {
      console.log("✗ Revoked API key should be invalid\n");
      testsFailed++;
    }

    // Test 8: Cannot revoke someone else's key
    console.log("Test 8: Cannot revoke another user's key");
    const otherUserKey = apiKey2.key;
    try {
      await revokeApiKey("wrong-user-id", apiKey2.keyId);
      console.log("✗ Should prevent revoking other user's keys\n");
      testsFailed++;
    } catch (err) {
      if (err.message.includes("Unauthorized")) {
        console.log("✓ Cross-user revocation prevented\n");
        testsPassed++;
      } else {
        console.log("✗ Unexpected error:", err.message, "\n");
        testsFailed++;
      }
    }

    // Test 9: Key format validation
    console.log("Test 9: Key format validation");
    const shortKey = await validateApiKey("sk_live_short");

    if (shortKey === null) {
      console.log("✓ Short key rejected\n");
      testsPassed++;
    } else {
      console.log("✗ Should reject malformed keys\n");
      testsFailed++;
    }

    // Test 10: Generate multiple keys
    console.log("Test 10: Generate multiple unique keys");
    const key1 = await generateApiKey(TEST_USER_ID);
    const key2 = await generateApiKey(TEST_USER_ID);

    if (key1.key !== key2.key) {
      console.log("✓ Generated keys are unique\n");
      testsPassed++;
    } else {
      console.log("✗ Generated keys should be unique\n");
      testsFailed++;
    }

    // Test 11: API key preserves user metadata
    console.log("Test 11: API key preserves user metadata");
    const freshKey = await generateApiKey(TEST_USER_ID);
    const userFromKey = await validateApiKey(freshKey.key);
    if (!userFromKey) throw new Error("Expected API key validation to return a user");

    if (
      userFromKey.tier === TEST_USER.tier &&
      userFromKey.rateLimit === TEST_USER.rateLimit &&
      userFromKey.role === TEST_USER.role
    ) {
      console.log("✓ User metadata preserved correctly\n");
      testsPassed++;
    } else {
      console.log("✗ User metadata not preserved\n");
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
