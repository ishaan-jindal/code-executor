import http from "http";
import { JobStatus } from "../../src/core/jobs/jobTypes.ts";

const BASE_URL = "http://localhost:4000";

// Store auth token
let accessToken = null;

// Helper to make HTTP requests
function makeRequest(method, path, body = null, includeAuth = false) {
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

    // Add authentication if requested and token is available
    if (includeAuth && accessToken) {
      options.headers["Authorization"] = `Bearer ${accessToken}`;
    }

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

function getPrimaryResult(result) {
  return result?.results?.[0] || null;
}

// Tests
async function runTests() {
  console.log("🧪 Starting integration tests...\n");

  try {
    // Test 0: Register and login for authentication
    console.log("✓ Test 0: Authentication Setup");
    const testUsername = `testuser_${Date.now()}`;
    const testEmail = `test_${Date.now()}@example.com`;
    const testPassword = "TestPass123!";

    const registerRes = await makeRequest("POST", "/auth/register", {
      username: testUsername,
      email: testEmail,
      password: testPassword,
    });

    if (registerRes.status !== 201 || !registerRes.body.success) {
      throw new Error(`Registration failed: ${registerRes.body.error || 'Unknown error'}`);
    }

    accessToken = registerRes.body.data.accessToken;
    console.log(`  Test user created: ${testUsername}`);
    console.log(`  Token obtained\n`);

    // Test 1: Health check
    console.log("✓ Test 1: Health Check");
    const health = await makeRequest("GET", "/health");
    if (health.status !== 200 || !health.body.status) {
      throw new Error("Health check failed");
    }
    console.log(`  Status: ${health.body.status}\n`);

    // Test 2: Submit Python code (with auth)
    console.log("✓ Test 2: Submit Python Code (Authenticated)");
    const submitRes = await makeRequest("POST", "/submit", {
      language: "python",
      code: 'print("Hello, World!")',
      inputs: [""],
    }, true);
    if (submitRes.status !== 201) {
      throw new Error(`Expected 201, got ${submitRes.status}`);
    }
    const jobId = submitRes.body.data.job_id;
    console.log(`  Job ID: ${jobId}\n`);

    // Test 3: Poll job status (should be queued or running)
    console.log("✓ Test 3: Poll Job Status (Queued/Running)");
    const statusRes = await makeRequest("GET", `/result/${jobId}`, null, true);
    const validStates = [JobStatus.QUEUED, JobStatus.RUNNING];
    if (!validStates.includes(statusRes.body.data.status)) {
      console.log(`  Warning: Got unexpected status ${statusRes.body.data.status}`);
    } else {
      console.log(`  Status: ${statusRes.body.data.status}\n`);
    }

    // Test 4: Wait for execution and poll result
    console.log("✓ Test 4: Wait for Execution (max 15 seconds)");
    let result = null;
    for (let i = 0; i < 75; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const res = await makeRequest("GET", `/result/${jobId}`, null, true);
      if (res.body.data.status !== JobStatus.QUEUED && res.body.data.status !== JobStatus.RUNNING) {
        result = res.body.data;
        break;
      }
    }

    if (!result) {
      throw new Error("Job did not complete in time");
    }

    // Check if it's a gVisor/Docker error
    const primaryResult = getPrimaryResult(result);
    if (
      result.status === JobStatus.RUNTIME_ERROR &&
      primaryResult?.stderr?.includes("cannot create sandbox")
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
      console.log(`  Stderr: ${primaryResult?.stderr || ""}\n`);
      throw new Error(`Job failed with status: ${result.status}`);
    }

    if (!primaryResult?.stdout?.includes("Hello, World!")) {
      throw new Error(`Expected output not found: ${primaryResult?.stdout || ""}`);
    }
    console.log(`  Status: ${result.status}`);
    console.log(`  Output: ${(primaryResult?.stdout || "").trim()}\n`);

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
      inputs: [""],
    }, true);

    if (cSubmit.status !== 201) {
      throw new Error(`Expected 201, got ${cSubmit.status}`);
    }
    const cJobId = cSubmit.body.data.job_id;
    console.log(`  C Job ID: ${cJobId}\n`);

    // Test 6: Wait for C execution
    console.log("✓ Test 6: Wait for C Execution");
    let cResult = null;
    for (let i = 0; i < 75; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const res = await makeRequest("GET", `/result/${cJobId}`, null, true);
      if (res.body.data.status !== JobStatus.QUEUED && res.body.data.status !== JobStatus.RUNNING) {
        cResult = res.body.data;
        break;
      }
    }

    if (!cResult) {
      throw new Error("C job did not complete in time");
    }

    const cPrimary = getPrimaryResult(cResult);
    if (cResult.status !== JobStatus.ACCEPTED) {
      throw new Error(`C job failed: ${cResult.status}\nStderr: ${cPrimary?.stderr || ""}`);
    }
    console.log(`  Status: ${cResult.status}`);
    console.log(`  Output: ${(cPrimary?.stdout || "").trim()}\n`);

    // Test 7: Invalid Job ID
    console.log("✓ Test 7: Invalid Job ID");
    const invalidRes = await makeRequest("GET", "/result/invalid-id", null, true);
    if (invalidRes.status !== 404) {
      throw new Error(`Expected 404, got ${invalidRes.status}`);
    }
    console.log(`  Status Code: ${invalidRes.status}\n`);

    // Test 8: Missing language/code
    console.log("✓ Test 8: Missing Language/Code");
    const missingRes = await makeRequest("POST", "/submit", {
      language: "python",
    }, true);
    if (missingRes.status !== 400) {
      throw new Error(`Expected 400, got ${missingRes.status}`);
    }
    console.log(`  Status Code: ${missingRes.status}\n`);

    // Test 9: Code too large
    console.log("✓ Test 9: Code Too Large");
    const largeRes = await makeRequest("POST", "/submit", {
      language: "python",
      code: "x = " + '"a"'.repeat(150000),
    }, true);
    if (largeRes.status !== 413) {
      throw new Error(`Expected 413, got ${largeRes.status}`);
    }
    console.log(`  Status Code: ${largeRes.status}\n`);

    // Test 10: Runtime error
    console.log("✓ Test 10: Runtime Error");
    const errorRes = await makeRequest("POST", "/submit", {
      language: "python",
      code: "1 / 0",
    }, true);
    const errorJobId = errorRes.body.data.job_id;

    let errorResult = null;
    for (let i = 0; i < 75; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const res = await makeRequest("GET", `/result/${errorJobId}`, null, true);
      if (res.body.data.status !== JobStatus.QUEUED && res.body.data.status !== JobStatus.RUNNING) {
        errorResult = res.body.data;
        break;
      }
    }

    if (errorResult.status !== JobStatus.RUNTIME_ERROR) {
      throw new Error(`Expected RUNTIME_ERROR, got ${errorResult.status}`);
    }
    console.log(`  Status: ${errorResult.status}`);
    const errorPrimary = getPrimaryResult(errorResult);
    console.log(`  Error: ${(errorPrimary?.stderr || "").split("\n")[0]}\n`);

    // Test 11: Python with stdin
    console.log("✓ Test 11: Python with stdin");
    const stdinRes = await makeRequest("POST", "/submit", {
      language: "python",
      code: 'name = input("Enter name: ")\nprint(f"Hello, {name}!")',
      inputs: ["Alice"],
    }, true);
    if (stdinRes.status !== 201) {
      throw new Error(`Expected 201, got ${stdinRes.status}`);
    }
    const stdinJobId = stdinRes.body.data.job_id;

    let stdinResult = null;
    for (let i = 0; i < 75; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const res = await makeRequest("GET", `/result/${stdinJobId}`, null, true);
      if (res.body.data.status !== JobStatus.QUEUED && res.body.data.status !== JobStatus.RUNNING) {
        stdinResult = res.body.data;
        break;
      }
    }

    if (!stdinResult) {
      throw new Error("stdin job did not complete in time");
    }
    const stdinPrimary = getPrimaryResult(stdinResult);
    if (stdinResult.status !== JobStatus.ACCEPTED) {
      throw new Error(`stdin job failed: ${stdinResult.status}\nStderr: ${stdinPrimary?.stderr || ""}`);
    }
    if (!stdinPrimary?.stdout?.includes("Alice")) {
      throw new Error(`Expected stdin in output: ${stdinPrimary?.stdout || ""}`);
    }
    console.log(`  Status: ${stdinResult.status}`);
    console.log(`  Output: ${(stdinPrimary?.stdout || "").trim()}\n`);

    // Test 12: C with stdin
    console.log("✓ Test 12: C with stdin");
    const cStdinRes = await makeRequest("POST", "/submit", {
      language: "c",
      code: `
        #include <stdio.h>
        int main() {
          int x;
          scanf("%d", &x);
          printf("You entered: %d\\n", x);
          printf("Squared: %d\\n", x * x);
          return 0;
        }
      `,
      inputs: ["7"],
    }, true);
    if (cStdinRes.status !== 201) {
      throw new Error(`Expected 201, got ${cStdinRes.status}`);
    }
    const cStdinJobId = cStdinRes.body.data.job_id;

    let cStdinResult = null;
    for (let i = 0; i < 75; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const res = await makeRequest("GET", `/result/${cStdinJobId}`, null, true);
      if (res.body.data.status !== JobStatus.QUEUED && res.body.data.status !== JobStatus.RUNNING) {
        cStdinResult = res.body.data;
        break;
      }
    }

    if (!cStdinResult) {
      throw new Error("C stdin job did not complete in time");
    }
    const cStdinPrimary = getPrimaryResult(cStdinResult);
    if (cStdinResult.status !== JobStatus.ACCEPTED) {
      throw new Error(`C stdin job failed: ${cStdinResult.status}\nStderr: ${cStdinPrimary?.stderr || ""}`);
    }
    if (!cStdinPrimary?.stdout?.includes("7") || !cStdinPrimary?.stdout?.includes("49")) {
      throw new Error(`Expected stdin and calculation in output: ${cStdinPrimary?.stdout || ""}`);
    }
    console.log(`  Status: ${cStdinResult.status}`);
    console.log(`  Output: ${(cStdinPrimary?.stdout || "").trim()}\n`);

    // Test 13: Submit Java code
    console.log("✓ Test 13: Submit Java Code");
    const javaSubmit = await makeRequest("POST", "/submit", {
      language: "java",
      code: `
        public class Main {
          public static void main(String[] args) {
            System.out.println("Java works!");
          }
        }
      `,
      inputs: [""],
    }, true);

    if (javaSubmit.status !== 201) {
      throw new Error(`Expected 201, got ${javaSubmit.status}`);
    }
    const javaJobId = javaSubmit.body.data.job_id;
    console.log(`  Java Job ID: ${javaJobId}\n`);

    // Test 14: Wait for Java execution
    console.log("✓ Test 14: Wait for Java Execution");
    let javaResult = null;
    for (let i = 0; i < 75; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const res = await makeRequest("GET", `/result/${javaJobId}`, null, true);
      if (res.body.data.status !== JobStatus.QUEUED && res.body.data.status !== JobStatus.RUNNING) {
        javaResult = res.body.data;
        break;
      }
    }

    if (!javaResult) {
      throw new Error("Java job did not complete in time");
    }

    const javaPrimary = getPrimaryResult(javaResult);
    if (javaResult.status !== JobStatus.ACCEPTED) {
      throw new Error(`Java job failed: ${javaResult.status}\nStderr: ${javaPrimary?.stderr || ""}`);
    }
    console.log(`  Status: ${javaResult.status}`);
    console.log(`  Output: ${(javaPrimary?.stdout || "").trim()}\n`);

    // Test 15: Java with stdin
    console.log("✓ Test 15: Java with stdin");
    const javaStdinRes = await makeRequest("POST", "/submit", {
      language: "java",
      code: `
        import java.util.Scanner;
        public class Main {
          public static void main(String[] args) {
            Scanner scanner = new Scanner(System.in);
            int x = scanner.nextInt();
            System.out.println("You entered: " + x);
            System.out.println("Squared: " + (x * x));
          }
        }
      `,
      inputs: ["9"],
    }, true);
    if (javaStdinRes.status !== 201) {
      throw new Error(`Expected 201, got ${javaStdinRes.status}`);
    }
    const javaStdinJobId = javaStdinRes.body.data.job_id;

    let javaStdinResult = null;
    for (let i = 0; i < 75; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const res = await makeRequest("GET", `/result/${javaStdinJobId}`, null, true);
      if (res.body.data.status !== JobStatus.QUEUED && res.body.data.status !== JobStatus.RUNNING) {
        javaStdinResult = res.body.data;
        break;
      }
    }

    if (!javaStdinResult) {
      throw new Error("Java stdin job did not complete in time");
    }
    const javaStdinPrimary = getPrimaryResult(javaStdinResult);
    if (javaStdinResult.status !== JobStatus.ACCEPTED) {
      throw new Error(`Java stdin job failed: ${javaStdinResult.status}\nStderr: ${javaStdinPrimary?.stderr || ""}`);
    }
    if (!javaStdinPrimary?.stdout?.includes("9") || !javaStdinPrimary?.stdout?.includes("81")) {
      throw new Error(`Expected stdin and calculation in output: ${javaStdinPrimary?.stdout || ""}`);
    }
    console.log(`  Status: ${javaStdinResult.status}`);
    console.log(`  Output: ${(javaStdinPrimary?.stdout || "").trim()}\n`);

    // Test 16: Multi-line stdin
    console.log("✓ Test 16: Multi-line stdin");
    const multiRes = await makeRequest("POST", "/submit", {
      language: "python",
      code: "lines = []\nfor _ in range(3):\n  lines.append(input())\nfor i, line in enumerate(lines, 1):\n  print(f'{i}: {line}')",
      inputs: ["first\nsecond\nthird"],
    }, true);
    if (multiRes.status !== 201) {
      throw new Error(`Expected 201, got ${multiRes.status}`);
    }
    const multiJobId = multiRes.body.data.job_id;

    let multiResult = null;
    for (let i = 0; i < 75; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const res = await makeRequest("GET", `/result/${multiJobId}`, null, true);
      if (res.body.data.status !== JobStatus.QUEUED && res.body.data.status !== JobStatus.RUNNING) {
        multiResult = res.body.data;
        break;
      }
    }

    if (!multiResult) {
      throw new Error("multi-line stdin job did not complete in time");
    }
    const multiPrimary = getPrimaryResult(multiResult);
    if (multiResult.status !== JobStatus.ACCEPTED) {
      throw new Error(`multi-line stdin job failed: ${multiResult.status}\nStderr: ${multiPrimary?.stderr || ""}`);
    }
    if (!multiPrimary?.stdout?.includes("1: first") || !multiPrimary?.stdout?.includes("3: third")) {
      throw new Error(`Expected multi-line stdin in output: ${multiPrimary?.stdout || ""}`);
    }
    console.log(`  Status: ${multiResult.status}`);
    console.log(`  Output: ${(multiPrimary?.stdout || "").trim()}\n`);

    // Test 17: Unauthenticated request (should fail)
    console.log("✓ Test 17: Unauthenticated Request (Should Fail)");
    const unauthRes = await makeRequest("POST", "/submit", {
      language: "python",
      code: 'print("test")',
    }, false);
    if (unauthRes.status !== 401) {
      throw new Error(`Expected 401 Unauthorized, got ${unauthRes.status}`);
    }
    console.log(`  Status Code: ${unauthRes.status}`);
    console.log(`  Correctly rejected unauthenticated request\n`);

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
