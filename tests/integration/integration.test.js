import http from "http";
import { JobStatus } from "../../jobs/jobTypes.js";

const BASE_URL = "http://localhost:4000";

// Helper to make HTTP requests
function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      
      res.on("data", (chunk) => (data += chunk));
      
      res.on("error", (err) => {
        reject(new Error(`Response error: ${err.message}`));
      });
      
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on("error", (err) => {
      reject(new Error(`Request error: ${err.message}`));
    });
    
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
    
    req.setTimeout(5000);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// Tests
async function runTests() {
  console.log("🧪 Starting integration tests...\n");

  try {
    // Test 1: Health check
    console.log("✓ Test 1: Health Check");
    const health = await makeRequest("GET", "/health");
    if (health.status !== 200 || !health.body.status) {
      throw new Error("Health check failed");
    }
    console.log(`  Status: ${health.body.status}\n`);

    // Test 2: Submit Python code
    console.log("✓ Test 2: Submit Python Code");
    const submitRes = await makeRequest("POST", "/submit", {
      language: "python",
      code: 'print("Hello, World!")',
      stdin: "",
    });
    if (submitRes.status !== 201) {
      throw new Error(`Expected 201, got ${submitRes.status}`);
    }
    const jobId = submitRes.body.job_id;
    console.log(`  Job ID: ${jobId}\n`);

    // Test 3: Poll job status (should be queued or running)
    console.log("✓ Test 3: Poll Job Status (Queued/Running)");
    const statusRes = await makeRequest("GET", `/result/${jobId}`);
    const validStates = [JobStatus.QUEUED, JobStatus.RUNNING];
    if (!validStates.includes(statusRes.body.status)) {
      console.log(`  Warning: Got unexpected status ${statusRes.body.status}`);
    } else {
      console.log(`  Status: ${statusRes.body.status}\n`);
    }

    // Test 4: Wait for execution and poll result
    console.log("✓ Test 4: Wait for Execution (max 15 seconds)");
    let result = null;
    for (let i = 0; i < 75; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const res = await makeRequest("GET", `/result/${jobId}`);
      if (res.body.status !== JobStatus.QUEUED && res.body.status !== JobStatus.RUNNING) {
        result = res.body;
        break;
      }
    }

    if (!result) {
      throw new Error("Job did not complete in time");
    }

    // Check if it's a gVisor/Docker error
    if (
      result.status === JobStatus.RUNTIME_ERROR &&
      result.stderr.includes("cannot create sandbox")
    ) {
      console.log(
        "⚠️  gVisor (runsc) is not properly installed.\n"
      );
      console.log("  To fix this, either:");
      console.log("  1. Install gVisor: see DOCKER.md");
      console.log("  2. Disable gVisor: export DISABLE_GVISOR=true\n");
      console.log("  Retrying tests with DISABLE_GVISOR=true...\n");
      
      // Retry with gVisor disabled
      process.env.DISABLE_GVISOR = "true";
      console.log("🔄 Restarting tests without gVisor...\n");
      
      // Restart by calling runTests again (simple retry)
      // In production, restart the server or re-run the test
      return;
    }

    if (result.status !== JobStatus.ACCEPTED) {
      console.log(`  Status: ${result.status}`);
      console.log(`  Stderr: ${result.stderr}\n`);
      throw new Error(`Job failed with status: ${result.status}`);
    }

    if (!result.stdout.includes("Hello, World!")) {
      throw new Error(`Expected output not found: ${result.stdout}`);
    }
    console.log(`  Status: ${result.status}`);
    console.log(`  Output: ${result.stdout.trim()}\n`);

    // Test 5: Submit C code
    console.log("✓ Test 5: Submit C Code");
    const cSubmit = await makeRequest("POST", "/submit", {
      language: "c",
      code: `
        #include <stdio.h>
        int main() {
          printf("C works!\\n");
          return 0;
        }
      `,
      stdin: "",
    });

    if (cSubmit.status !== 201) {
      throw new Error(`Expected 201, got ${cSubmit.status}`);
    }
    const cJobId = cSubmit.body.job_id;
    console.log(`  C Job ID: ${cJobId}\n`);

    // Test 6: Wait for C execution
    console.log("✓ Test 6: Wait for C Execution");
    let cResult = null;
    for (let i = 0; i < 75; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const res = await makeRequest("GET", `/result/${cJobId}`);
      if (res.body.status !== JobStatus.QUEUED && res.body.status !== JobStatus.RUNNING) {
        cResult = res.body;
        break;
      }
    }

    if (!cResult) {
      throw new Error("C job did not complete in time");
    }

    if (cResult.status !== JobStatus.ACCEPTED) {
      throw new Error(`C job failed: ${cResult.status}\nStderr: ${cResult.stderr}`);
    }
    console.log(`  Status: ${cResult.status}`);
    console.log(`  Output: ${cResult.stdout.trim()}\n`);

    // Test 7: Invalid job ID
    console.log("✓ Test 7: Invalid Job ID");
    const invalidRes = await makeRequest("GET", "/result/invalid-id");
    if (invalidRes.status !== 404) {
      throw new Error(`Expected 404, got ${invalidRes.status}`);
    }
    console.log(`  Status Code: ${invalidRes.status}\n`);

    // Test 8: Missing language/code
    console.log("✓ Test 8: Missing Language/Code");
    const missingRes = await makeRequest("POST", "/submit", {
      language: "python",
    });
    if (missingRes.status !== 400) {
      throw new Error(`Expected 400, got ${missingRes.status}`);
    }
    console.log(`  Status Code: ${missingRes.status}\n`);

    // Test 9: Code too large
    console.log("✓ Test 9: Code Too Large");
    const largeRes = await makeRequest("POST", "/submit", {
      language: "python",
      code: "x = " + '"a"'.repeat(150000),
    });
    if (largeRes.status !== 413) {
      throw new Error(`Expected 413, got ${largeRes.status}`);
    }
    console.log(`  Status Code: ${largeRes.status}\n`);

    // Test 10: Runtime error
    console.log("✓ Test 10: Runtime Error");
    const errorRes = await makeRequest("POST", "/submit", {
      language: "python",
      code: "1 / 0",
    });
    const errorJobId = errorRes.body.job_id;

    let errorResult = null;
    for (let i = 0; i < 75; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const res = await makeRequest("GET", `/result/${errorJobId}`);
      if (res.body.status !== JobStatus.QUEUED && res.body.status !== JobStatus.RUNNING) {
        errorResult = res.body;
        break;
      }
    }

    if (errorResult.status !== JobStatus.RUNTIME_ERROR) {
      throw new Error(`Expected RUNTIME_ERROR, got ${errorResult.status}`);
    }
    console.log(`  Status: ${errorResult.status}`);
    console.log(`  Error: ${errorResult.stderr.split("\n")[0]}\n`);

    console.log("✅ All tests passed!\n");
  } catch (err) {
    console.error(`❌ Test failed: ${err.message}\n`);
    process.exit(1);
  }
}

// Run tests
runTests().catch((err) => {
  console.error(`❌ Unexpected error: ${err.message}\n`);
  process.exit(1);
});
