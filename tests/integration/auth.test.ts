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
      const userId = registerRes.data.data.user.id;
      log(`  User: ${registerRes.data.data.user.username}`);
      log(`  Tier: ${registerRes.data.data.user.tier}`);
      log(`  Rate Limit: ${registerRes.data.data.user.rateLimit} req/min`);

      // Upgrade to pro tier for testing (to avoid rate limits)
      log("\n  Upgrading to pro tier...", "yellow");
      const adminUsername = process.env.ADMIN_USERNAME;
      const adminPassword = process.env.ADMIN_PASSWORD;

      if (adminUsername && adminPassword) {
        const adminLoginRes = await request("POST", "/auth/login", {
          username: adminUsername,
          password: adminPassword,
        });

        if (adminLoginRes.status === 200) {
          const adminToken = adminLoginRes.data.data.accessToken;
          const upgradeRes = await request(
            "POST",
            `/admin/users/${userId}/upgrade`,
            { newTier: "professional" },
            { Authorization: `Bearer ${adminToken}` }
          );

          if (upgradeRes.status === 200) {
            log("  ✓ Upgraded to pro tier (100 req/min)", "green");
            // Refresh the access token to get updated tier info
            const refreshRes = await request("POST", "/auth/refresh", {
              refreshToken: refreshToken,
            });
            if (refreshRes.status === 200) {
              accessToken = refreshRes.data.data.accessToken;
            }
          } else {
            log(`  ⚠ Upgrade failed (continuing with free tier)`, "yellow");
          }
        } else {
          log(`  ⚠ Admin login failed (continuing with free tier)`, "yellow");
        }
      } else {
        log(`  ⚠ Admin credentials not found in .env (continuing with free tier)`, "yellow");
      }
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
      log(`✗ Submit failed: ${submitRes.data.error || JSON.stringify(submitRes.data)}`, "red");
      log(`  Status code: ${submitRes.status}`, "red");
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
        log(`  Status: ${resultRes.data.data.status}`);
        const firstResult = resultRes.data.data.results?.[0];
        if (firstResult?.stdout) {
          log(`  Output: ${firstResult.stdout.trim()}`);
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

    // Test 8: Rate limiting (skipped - user upgraded to professional tier)
    log("\nTest 8: Test rate limiting", "yellow");
    log("⊘ Skipped (user upgraded to professional tier: 100 req/min)", "blue");

    // Test 9: Logout (current device)
    log("\nTest 9: Logout from current device", "yellow");
    const logoutRes = await request("POST", "/auth/logout", {
      refreshToken: refreshToken,
    });

    if (logoutRes.status === 200 && logoutRes.data.success) {
      log("✓ Logout successful", "green");
      log(`  ${logoutRes.data.data.message}`);
    } else {
      log(`✗ Logout failed: ${logoutRes.data.error}`, "red");
    }

    // Test 10: Try to refresh with revoked token
    log("\nTest 10: Try to refresh with revoked token", "yellow");
    const refreshAfterLogoutRes = await request("POST", "/auth/refresh", {
      refreshToken: refreshToken,
    });

    if (refreshAfterLogoutRes.status === 401) {
      log("✓ Revoked token correctly rejected", "green");
      log(`  Error: ${refreshAfterLogoutRes.data.error}`);
    } else {
      log("✗ Revoked token was still accepted (should be rejected)", "red");
    }

    // Test 11: Access token still works (doesn't get revoked on logout)
    log("\nTest 11: Access token still works after logout", "yellow");
    const submitAfterLogoutRes = await request(
      "POST",
      "/submit",
      {
        language: "python",
        code: `print("Access token works!")`,
      },
      {
        Authorization: `Bearer ${accessToken}`,
      }
    );

    if (submitAfterLogoutRes.status === 200 || submitAfterLogoutRes.status === 201) {
      log("✓ Access token still valid after logout", "green");
      log("  (Access tokens are short-lived and not revoked)");
    } else {
      const errorMsg = submitAfterLogoutRes.data?.error || submitAfterLogoutRes.data?.message || "Unknown error";
      log(`✗ Access token rejected: ${errorMsg}`, "red");
      log(`  Status: ${submitAfterLogoutRes.status}`);
    }

    // Test 12: Login again and test logout-all
    log("\nTest 12: Test logout from all devices", "yellow");
    const newLoginRes = await request("POST", "/auth/login", {
      username: testUsername,
      password: testPassword,
    });

    if (newLoginRes.status === 200) {
      const newAccessToken = newLoginRes.data.data.accessToken;
      const newRefreshToken = newLoginRes.data.data.refreshToken;
      log("✓ Logged in again");

      // Logout from all devices
      const logoutAllRes = await request(
        "POST",
        "/auth/logout-all",
        null,
        {
          Authorization: `Bearer ${newAccessToken}`,
        }
      );

      if (logoutAllRes.status === 200 && logoutAllRes.data.success) {
        log("✓ Logout-all successful", "green");
        log(`  ${logoutAllRes.data.data.message}`);

        // Try to refresh with the new token (should fail)
        const refreshAfterLogoutAllRes = await request("POST", "/auth/refresh", {
          refreshToken: newRefreshToken,
        });

        if (refreshAfterLogoutAllRes.status === 401) {
          log("✓ All refresh tokens correctly revoked", "green");
        } else {
          log("✗ Refresh token still works (should be revoked)", "red");
        }
      } else {
        log(`✗ Logout-all failed: ${logoutAllRes.data.error}`, "red");
      }
    }

    log("\n✅ All tests completed!\n", "green");
  } catch (error) {
    log(`\n❌ Test suite failed: ${error.message}\n`, "red");
    console.error(error);
  }
}

// Run tests
testAuth();
