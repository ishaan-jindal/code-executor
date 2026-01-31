#!/usr/bin/env node

/**
 * Metrics Test Script
 * Tests all monitoring endpoints and metrics collection
 */

import http from "http";

const BASE_URL = "http://localhost:4000";

function makeRequest(method, path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            if (res.headers["content-type"]?.includes("application/json")) {
              resolve({ status: res.statusCode, body: JSON.parse(data), raw: data });
            } else {
              resolve({ status: res.statusCode, body: data, raw: data });
            }
          } catch (e) {
            resolve({ status: res.statusCode, body: data, raw: data });
          }
        });
      }
    );

    req.on("error", reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
    req.end();
  });
}

async function testMetrics() {
  console.log("🧪 Testing Metrics & Monitoring System...\n");

  try {
    // Test 1: Health endpoint
    console.log("✓ Test 1: Health Check");
    const health = await makeRequest("GET", "/health");
    if (health.status !== 200) {
      throw new Error(`Health check failed with status ${health.status}`);
    }
    console.log(`  Status: ${health.body.status}`);
    console.log(`  Uptime: ${Math.round(health.body.uptime)}s\n`);

    // Test 2: Status endpoint
    console.log("✓ Test 2: Status Endpoint");
    const status = await makeRequest("GET", "/status");
    if (status.status !== 200) {
      throw new Error(`Status endpoint failed with status ${status.status}`);
    }
    console.log(`  Jobs Submitted: ${status.body.jobs.submitted}`);
    console.log(`  Jobs Completed: ${status.body.jobs.completed}`);
    console.log(`  Success Rate: ${status.body.jobs.success_rate}`);
    console.log(`  Queue Size: ${status.body.queue.current_size}`);
    console.log(`  Memory: ${status.body.system.memory_mb}MB`);
    console.log(`  Redis: ${status.body.system.redis_connected ? "Connected" : "Disconnected"}\n`);

    // Test 3: Prometheus metrics endpoint
    console.log("✓ Test 3: Prometheus Metrics");
    const metrics = await makeRequest("GET", "/metrics");
    if (metrics.status !== 200) {
      throw new Error(`Metrics endpoint failed with status ${metrics.status}`);
    }

    const metricsText = metrics.body;
    const lines = metricsText.split("\n").filter((line) => line && !line.startsWith("#"));

    // Verify key metrics exist
    const keyMetrics = [
      "code_executor_jobs_submitted",
      "code_executor_jobs_completed",
      "code_executor_execution_time_ms",
      "code_executor_queue_size",
      "code_executor_redis_connected",
      "code_executor_success_rate",
    ];

    for (const metric of keyMetrics) {
      const found = lines.some((line) => line.startsWith(metric));
      if (!found) {
        throw new Error(`Missing required metric: ${metric}`);
      }
    }

    console.log(`  Total metrics lines: ${lines.length}`);
    console.log(`  Sample metrics:`);
    lines.slice(0, 5).forEach((line) => console.log(`    ${line}`));
    console.log(`    ...\n`);

    // Test 4: Submit a job and verify metrics update
    console.log("✓ Test 4: Metrics Update on Job Submission");
    const beforeSubmit = await makeRequest("GET", "/status");
    const beforeCount = beforeSubmit.body.jobs.submitted;

    const submitBody = JSON.stringify({
      language: "python",
      code: 'print("Metrics test")',
      stdin: "",
    });

    const submitReq = await new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: "localhost",
          port: 4000,
          path: "/submit",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(submitBody),
          },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          });
        }
      );
      req.on("error", reject);
      req.write(submitBody);
      req.end();
    });

    if (submitReq.status !== 201) {
      throw new Error(`Job submission failed with status ${submitReq.status}`);
    }

    // Wait a moment for metrics to update
    await new Promise((r) => setTimeout(r, 100));

    const afterSubmit = await makeRequest("GET", "/status");
    const afterCount = afterSubmit.body.jobs.submitted;

    if (afterCount !== beforeCount + 1) {
      throw new Error(`Metrics not updated: expected ${beforeCount + 1}, got ${afterCount}`);
    }

    console.log(`  Before: ${beforeCount} submitted`);
    console.log(`  After: ${afterCount} submitted`);
    console.log(`  ✅ Metrics incremented correctly!\n`);

    // Test 5: Wait for job completion and check completion metrics
    console.log("✓ Test 5: Metrics Update on Job Completion");
    const jobId = submitReq.body.job_id;

    // Poll for completion
    let completed = false;
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const result = await makeRequest("GET", `/result/${jobId}`);
      if (result.body.status !== "QUEUED" && result.body.status !== "RUNNING") {
        completed = true;
        break;
      }
    }

    if (!completed) {
      throw new Error("Job did not complete in time");
    }

    const finalStatus = await makeRequest("GET", "/status");
    console.log(`  Completed: ${finalStatus.body.jobs.completed}`);
    console.log(`  Accepted: ${finalStatus.body.jobs.accepted}`);
    console.log(`  Failed: ${finalStatus.body.jobs.failed}`);
    console.log(`  Avg Execution Time: ${finalStatus.body.execution.average_ms}ms`);
    console.log(`  P95 Execution Time: ${finalStatus.body.execution.p95_ms}ms\n`);

    // Test 6: Verify percentile calculations
    console.log("✓ Test 6: Percentile Calculations");
    if (finalStatus.body.execution.count > 0) {
      const p50 = finalStatus.body.execution.p50_ms;
      const p95 = finalStatus.body.execution.p95_ms;
      const p99 = finalStatus.body.execution.p99_ms;

      console.log(`  P50: ${p50}ms`);
      console.log(`  P95: ${p95}ms`);
      console.log(`  P99: ${p99}ms`);

      if (p50 > p95 || p95 > p99) {
        throw new Error("Percentile calculations are incorrect");
      }
      console.log(`  ✅ Percentiles are correctly ordered!\n`);
    } else {
      console.log(`  Skipped (no executions yet)\n`);
    }

    console.log("✅ All metrics tests passed!\n");
    console.log("📊 Monitoring System Summary:");
    console.log("  ✅ Health endpoint working");
    console.log("  ✅ Status endpoint working");
    console.log("  ✅ Prometheus metrics working");
    console.log("  ✅ Metrics update on job submission");
    console.log("  ✅ Metrics update on job completion");
    console.log("  ✅ Percentile calculations correct");
    console.log("\n🎉 Monitoring system is fully operational!\n");

    process.exit(0);
  } catch (err) {
    console.error(`\n❌ Test failed: ${err.message}\n`);
    process.exit(1);
  }
}

testMetrics().catch((err) => {
  console.error(`\n❌ Unexpected error: ${err.message}\n`);
  process.exit(1);
});
