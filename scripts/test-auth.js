#!/usr/bin/env node

/**
 * Manual Test Script for JWT Authentication
 * 
 * This script tests the complete authentication flow:
 * 1. Register a new user
 * 2. Login
 * 3. Submit code with auth
 * 4. Get result with auth
 * 5. Test rate limiting
 * 6. Refresh token
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:4000";

// Helper to make HTTP requests
async function request(method, path, body = null, headers = {}) {
  const url = `${BASE_URL}${path}`;
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json();

  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    data,
  };
}

// Test colors
const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  reset: "\x1b[0m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testAuth() {
  log("\n🔐 JWT Authentication Test Suite\n", "blue");

  const testUsername = `testuser_${Date.now()}`;
  const testEmail = `test_${Date.now()}@example.com`;
  const testPassword = "SecurePass123!";

  let accessToken = null;
  let refreshToken = null;
  let jobId = null;

  try {
    // Test 1: Register
    log("Test 1: Register new user", "yellow");
    const registerRes = await request("POST", "/auth/register", {
      username: testUsername,
      email: testEmail,
      password: testPassword,
    });

    if (registerRes.status === 201 && registerRes.data.success) {
      log("✓ Registration successful", "green");
      accessToken = registerRes.data.data.accessToken;
      refreshToken = registerRes.data.data.refreshToken;
      log(`  User: ${registerRes.data.data.user.username}`);
      log(`  Tier: ${registerRes.data.data.user.tier}`);
      log(`  Rate Limit: ${registerRes.data.data.user.rateLimit} req/min`);
    } else {
      log(`✗ Registration failed: ${registerRes.data.error}`, "red");
      return;
    }

    // Test 2: Login
    log("\nTest 2: Login with credentials", "yellow");
    const loginRes = await request("POST", "/auth/login", {
      username: testUsername,
      password: testPassword,
    });

    if (loginRes.status === 200 && loginRes.data.success) {
      log("✓ Login successful", "green");
      accessToken = loginRes.data.data.accessToken;
      refreshToken = loginRes.data.data.refreshToken;
    } else {
      log(`✗ Login failed: ${loginRes.data.error}`, "red");
      return;
    }

    // Test 3: Get current user
    log("\nTest 3: Get current user profile", "yellow");
    const meRes = await request("GET", "/auth/me", null, {
      Authorization: `Bearer ${accessToken}`,
    });

    if (meRes.status === 200 && meRes.data.success) {
      log("✓ Profile retrieved", "green");
      log(`  Username: ${meRes.data.data.username}`);
      log(`  Email: ${meRes.data.data.email}`);
    } else {
      log(`✗ Get profile failed: ${meRes.data.error}`, "red");
    }

    // Test 4: Submit code with auth
    log("\nTest 4: Submit code with authentication", "yellow");
    const submitRes = await request(
      "POST",
      "/submit",
      {
        language: "python",
        code: 'print("Hello from authenticated user!")',
      },
      {
        Authorization: `Bearer ${accessToken}`,
      }
    );

    if (submitRes.status === 201 && submitRes.data.success) {
      log("✓ Code submitted successfully", "green");
      jobId = submitRes.data.data.job_id;
      log(`  Job ID: ${jobId}`);
      log(`  Status: ${submitRes.data.data.status}`);
      
      // Check rate limit headers
      if (submitRes.headers["x-ratelimit-limit"]) {
        log(`  Rate Limit: ${submitRes.headers["x-ratelimit-remaining"]}/${submitRes.headers["x-ratelimit-limit"]} remaining`);
      }
    } else {
      log(`✗ Submit failed: ${submitRes.data.error}`, "red");
    }

    // Test 5: Get result with auth
    if (jobId) {
      log("\nTest 5: Get job result with authentication", "yellow");
      
      // Wait a bit for job to complete
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      const resultRes = await request("GET", `/result/${jobId}`, null, {
        Authorization: `Bearer ${accessToken}`,
      });

      if (resultRes.status === 200 && resultRes.data.success) {
        log("✓ Result retrieved successfully", "green");
        log(`  Status: ${resultRes.data.data.job.status}`);
        if (resultRes.data.data.job.stdout) {
          log(`  Output: ${resultRes.data.data.job.stdout.trim()}`);
        }
      } else {
        log(`✗ Get result failed: ${resultRes.data.error}`, "red");
      }
    }

    // Test 6: Test without auth (should fail)
    log("\nTest 6: Submit without authentication (should fail)", "yellow");
    const noAuthRes = await request("POST", "/submit", {
      language: "python",
      code: 'print("test")',
    });

    if (noAuthRes.status === 401) {
      log("✓ Correctly rejected unauthorized request", "green");
    } else {
      log("✗ Should have rejected unauthorized request", "red");
    }

    // Test 7: Refresh token
    log("\nTest 7: Refresh access token", "yellow");
    const refreshRes = await request("POST", "/auth/refresh", {
      refreshToken: refreshToken,
    });

    if (refreshRes.status === 200 && refreshRes.data.success) {
      log("✓ Token refreshed successfully", "green");
      accessToken = refreshRes.data.data.accessToken;
      log("  New access token received");
    } else {
      log(`✗ Token refresh failed: ${refreshRes.data.error}`, "red");
    }

    // Test 8: Rate limiting
    log("\nTest 8: Test rate limiting (free tier: 10 req/min)", "yellow");
    let rateLimited = false;
    
    for (let i = 0; i < 12; i++) {
      const res = await request(
        "POST",
        "/submit",
        {
          language: "python",
          code: `print(${i})`,
        },
        {
          Authorization: `Bearer ${accessToken}`,
        }
      );

      if (res.status === 429) {
        log(`✓ Rate limit triggered after ${i + 1} requests`, "green");
        log(`  Error: ${res.data.error}`);
        log(`  Retry-After: ${res.headers["retry-after"]} seconds`);
        rateLimited = true;
        break;
      }
    }

    if (!rateLimited) {
      log("✗ Rate limit not triggered (might be due to test timing)", "yellow");
    }

    log("\n✅ All tests completed!\n", "green");
  } catch (error) {
    log(`\n❌ Test suite failed: ${error.message}\n`, "red");
    console.error(error);
  }
}

// Run tests
testAuth();
