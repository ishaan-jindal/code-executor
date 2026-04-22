#!/usr/bin/env node

/**
 * Test Runner
 * Runs all unit and integration tests with detailed reporting
 */

import { spawn } from "child_process";

const tests = [
  // Pure unit tests (no external dependencies)
  {
    name: "Pure Unit Tests",
    cmd: "node",
    args: [
      "--test",
      "tests/unit/apiError.test.js",
      "tests/unit/apiResponse.test.js",
      "tests/unit/outputHandler.test.js",
      "tests/unit/config.test.js",
      "tests/unit/crypto.test.js",
      "tests/unit/metricsCollector.test.js",
      "tests/unit/languageRegistry.test.js",
      "tests/unit/executionLimiter.test.js",
      "tests/unit/sandbox.test.js",
    ],
    type: "unit",
  },
  // Redis-dependent unit tests
  { name: "Webhooks (Redis)", cmd: "node", args: ["tests/unit/webhooks.test.js"], type: "unit" },
  { name: "API Keys (Redis)", cmd: "node", args: ["tests/unit/apikey.test.js"], type: "unit" },
  // Integration tests (require running server + Redis)
  { name: "Integration", cmd: "node", args: ["tests/integration/integration.test.js"], type: "integration" },
  { name: "Auth", cmd: "node", args: ["tests/integration/auth.test.js"], type: "integration" },
  { name: "Advanced Features", cmd: "node", args: ["tests/integration/advanced-features.test.js"], type: "integration" },
];

function runTest(test) {
  return new Promise((resolve) => {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Running: ${test.name} (${test.type})`);
    console.log("=".repeat(60));

    const startTime = Date.now();
    const proc = spawn(test.cmd, test.args, {
      stdio: "inherit",
      env: { ...process.env },
    });

    proc.on("close", (code) => {
      const duration = Date.now() - startTime;
      resolve({
        name: test.name,
        type: test.type,
        passed: code === 0,
        duration,
      });
    });

    proc.on("error", (err) => {
      console.error(`Error running ${test.name}:`, err.message);
      resolve({
        name: test.name,
        type: test.type,
        passed: false,
        duration: 0,
      });
    });
  });
}

async function runAllTests() {
  console.log("🧪 Code Executor Test Suite\n");
  console.log("Starting all tests...\n");

  const results = [];

  // Run unit tests
  console.log("\n📦 UNIT TESTS");
  for (const test of tests.filter((t) => t.type === "unit")) {
    const result = await runTest(test);
    results.push(result);
  }

  // Run integration tests
  console.log("\n\n🔗 INTEGRATION TESTS");
  for (const test of tests.filter((t) => t.type === "integration")) {
    const result = await runTest(test);
    results.push(result);
  }

  // Print summary
  console.log("\n\n" + "=".repeat(60));
  console.log("TEST SUMMARY");
  console.log("=".repeat(60));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  results.forEach((result) => {
    const status = result.passed ? "✓" : "✗";
    const color = result.passed ? "\x1b[32m" : "\x1b[31m";
    const duration = `${result.duration}ms`;
    console.log(
      `${color}${status}\x1b[0m ${result.name.padEnd(25)} [${result.type}] ${duration}`
    );
  });

  console.log("\n" + "-".repeat(60));
  console.log(`Total: ${results.length} tests`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Duration: ${totalDuration}ms`);
  console.log("=".repeat(60));

  process.exit(failed > 0 ? 1 : 0);
}

runAllTests();
