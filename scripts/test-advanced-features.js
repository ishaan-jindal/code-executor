#!/usr/bin/env node

/**
 * Advanced Features Test Script
 * Tests new endpoints: code retrieval, job search, language info, webhooks
 */

import https from "https";
import http from "http";

const BASE_URL = "http://localhost:4000";
const API_KEY = process.argv[2]; // Pass API key as argument

if (!API_KEY) {
  console.error("Usage: node test-advanced-features.js <api_key>");
  process.exit(1);
}

// Helper to make HTTP requests
function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const isHttps = url.protocol === "https:";
    const client = isHttps ? https : http;

    const options = {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY,
        ...headers,
      },
    };

    const req = client.request(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null,
          });
        } catch (err) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data,
          });
        }
      });
    });

    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function test() {
  console.log("🧪 Testing Advanced Features\n");

  try {
    // Test 1: Get Language Info
    console.log("1️⃣  Getting all languages...");
    const langRes = await request("GET", "/languages");
    console.log(`   Status: ${langRes.status}`);
    console.log(`   Languages: ${langRes.body.data.languages.map((l) => l.name).join(", ")}\n`);

    // Test 2: Get Specific Language
    console.log("2️⃣  Getting Python language details...");
    const pythonRes = await request("GET", "/languages/python");
    console.log(`   Status: ${pythonRes.status}`);
    console.log(`   Version: ${pythonRes.body.data.version}`);
    console.log(`   Memory Limit: ${pythonRes.body.data.memory_limit_mb}MB\n`);

    // Test 3: Submit a job for testing
    console.log("3️⃣  Submitting test job...");
    const submitRes = await request("POST", "/submit", {
      language: "python",
      code: 'print("Hello from test")',
    });
    const jobId = submitRes.body?.data?.id || submitRes.body?.job_id;
    if (!jobId) {
      throw new Error("Submit response missing job id");
    }
    console.log(`   Status: ${submitRes.status}`);
    console.log(`   Job ID: ${jobId}\n`);

    // Wait a bit for job to process
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Test 4: Get Job Code
    console.log("4️⃣  Retrieving job code...");
    const codeRes = await request("GET", `/jobs/${jobId}/code`);
    console.log(`   Status: ${codeRes.status}`);
    console.log(`   Code: ${codeRes.body.data.code}\n`);

    // Test 5: List Jobs
    console.log("5️⃣  Listing user jobs...");
    const jobsRes = await request("GET", "/jobs");
    console.log(`   Status: ${jobsRes.status}`);
    console.log(`   Jobs returned: ${jobsRes.body.data.jobs.length}\n`);

    // Test 6: Register Webhook
    console.log("6️⃣  Registering webhook...");
    const webhookRes = await request("POST", "/webhooks", {
      url: "https://httpbin.org/post",
      events: ["job.completed"],
      secret: "test-secret",
    });
    const webhookId = webhookRes.body.data.id;
    console.log(`   Status: ${webhookRes.status}`);
    console.log(`   Webhook ID: ${webhookId}`);
    console.log(`   Status: ${webhookRes.body.data.status}\n`);

    // Test 7: List Webhooks
    console.log("7️⃣  Listing webhooks...");
    const listWebhooksRes = await request("GET", "/webhooks");
    console.log(`   Status: ${listWebhooksRes.status}`);
    console.log(`   Webhooks: ${listWebhooksRes.body.data.length}\n`);

    // Test 8: Get Webhook Details
    console.log("8️⃣  Getting webhook details...");
    const webhookDetailsRes = await request("GET", `/webhooks/${webhookId}`);
    console.log(`   Status: ${webhookDetailsRes.status}`);
    console.log(`   URL: ${webhookDetailsRes.body.data.url}\n`);

    // Test 9: Get Webhook Deliveries
    console.log("9️⃣  Checking webhook deliveries...");
    const deliveriesRes = await request("GET", `/webhooks/${webhookId}/deliveries`);
    console.log(`   Status: ${deliveriesRes.status}`);
    console.log(`   Deliveries: ${deliveriesRes.body.data.length}\n`);

    // Test 10: Delete Webhook
    console.log("🔟 Deleting webhook...");
    const deleteRes = await request("DELETE", `/webhooks/${webhookId}`);
    console.log(`   Status: ${deleteRes.status}`);
    console.log(`   Message: ${deleteRes.body.message}\n`);

    console.log("✅ All tests completed successfully!");
  } catch (err) {
    console.error("❌ Test failed:", err.message);
    process.exit(1);
  }
}

test();
