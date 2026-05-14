#!/usr/bin/env node

/**
 * Test Runner
 * Runs all unit and integration tests with detailed reporting
 */

import { spawn } from "child_process";

interface TestDefinition {
  name: string;
  cmd: string;
  args: string[];
  type: "unit" | "integration";
}

interface TestResult {
  name: string;
  type: TestDefinition["type"];
  passed: boolean;
  duration: number;
}

const tests: TestDefinition[] = [
  // Pure unit tests (no external dependencies)
  {
    name: "Pure Unit Tests",
    cmd: "node",
    args: [
      "--test",
      "tests/unit/apiError.test.ts",
      "tests/unit/apiResponse.test.ts",
      "tests/unit/outputHandler.test.ts",
      "tests/unit/config.test.ts",
      "tests/unit/crypto.test.ts",
      "tests/unit/metricsCollector.test.ts",
      "tests/unit/languageRegistry.test.ts",
      "tests/unit/executionLimiter.test.ts",
      "tests/unit/sandbox.test.ts",
    ],
    type: "unit",
  },
  // Redis-dependent unit tests
  { name: "Webhooks (Redis)", cmd: "node", args: ["tests/unit/webhooks.test.ts"], type: "unit" },
  { name: "API Keys (Redis)", cmd: "node", args: ["tests/unit/apikey.test.ts"], type: "unit" },
  // Integration tests (require running server + Redis)
  { name: "Integration", cmd: "node", args: ["tests/integration/integration.test.ts"], type: "integration" },
  { name: "Auth", cmd: "node", args: ["tests/integration/auth.test.ts"], type: "integration" },
  { name: "Advanced Features", cmd: "node", args: ["tests/integration/advanced-features.test.ts"], type: "integration" },
];

function runTest(test: TestDefinition): Promise<TestResult> {
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

async function runAllTests(): Promise<void> {
  console.log("🧪 Code Executor Test Suite\n");
  console.log("Starting all tests...\n");

  const results: TestResult[] = [];

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
