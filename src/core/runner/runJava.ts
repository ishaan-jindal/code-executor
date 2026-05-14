import { spawn, spawnSync } from "child_process";
import { JobStatus, type ExecutionResult } from "../jobs/jobTypes.ts";
import { truncateOutput, MAX_OUTPUT_SIZE } from "../../utils/outputHandler.ts";
import config from "../../config/index.ts";

/**
 * Compile and run Java code inside a single Docker container.
 *
 * Uses spawn for proper stdin/stdout handling with timeout enforcement.
 *
 * @param {string} dir - Host directory containing Main.java
 * @param {string|null} input - stdin data to pipe to the program
 * @returns {Promise<{status: string, stdout: string, stderr: string, exit_code: number|null}>}
 */
export function runJava(dir: string, input: string | number | null | undefined): Promise<ExecutionResult> {
  const runCmd = `javac /app/Main.java && java -cp /app Main`;

  const dockerArgs = [
    "run",
    "--rm",
    "-i",  // Enable stdin
    "--network=none",
    "--memory=128m",
    "--cpus=1",
    "--pids-limit=100",
    "--cap-drop=NET_RAW",
    "--cap-drop=NET_ADMIN",
    "--security-opt=no-new-privileges=true",
    "-v",
    `${dir}:/app:rw`,
    "-w",
    "/app",
    "runner-java",
    "/bin/sh",
    "-c",
    runCmd,
  ];

  return new Promise((resolve) => {
    const child = spawn("docker", dockerArgs, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let stdoutTruncated = false;
    let stderrTruncated = false;

    let finished = false;
    const done = (result: ExecutionResult): void => {
      if (finished) return;
      finished = true;
      clearTimeout(killTimer);
      resolve(result);
    };

    child.stdout.on("data", (chunk: Buffer) => {
      if (stdoutTruncated) return;
      if (stdout.length + chunk.length > MAX_OUTPUT_SIZE) {
        stdoutTruncated = true;
        stdout = truncateOutput(stdout);
        return;
      }
      stdout += chunk;
    });

    child.stderr.on("data", (chunk: Buffer) => {
      if (stderrTruncated) return;
      if (stderr.length + chunk.length > MAX_OUTPUT_SIZE) {
        stderrTruncated = true;
        stderr = truncateOutput(stderr);
        return;
      }
      stderr += chunk;
    });

    const inputData = input == null ? "" : String(input);
    child.stdin.end(inputData);

    // Timeout enforcement
    // Java needs more time for JVM startup + compilation + execution
    const javaTimeout = 8000; // 8 seconds for Java (vs 2s for Python/C)
    const killTimer = setTimeout(() => {
      try {
        spawnSync("docker", ["kill", "$(docker ps -q)"], { timeout: 2000 });
      } catch {
        // ignore
      }

      try {
        child.kill("SIGKILL");
      } catch {
        // ignore
      }

      done({
        status: JobStatus.TIME_LIMIT_EXCEEDED,
        stdout: truncateOutput(stdout),
        stderr: truncateOutput(stderr),
        exit_code: null,
      });
    }, javaTimeout);

    child.on("close", (code) => {
      // Determine if it's a compile error or runtime error
      const isCompileError =
        stderr?.includes("error:") &&
        (stderr?.includes("cannot find symbol") ||
          stderr?.includes("';' expected") ||
          stderr?.includes("class declaration expected"));

      done({
        status: code === 0 ? JobStatus.ACCEPTED : isCompileError ? JobStatus.COMPILE_ERROR : JobStatus.RUNTIME_ERROR,
        stdout: truncateOutput(stdout),
        stderr: truncateOutput(stderr),
        exit_code: code,
      });
    });

    child.on("error", (err) => {
      if (finished) return;
      finished = true;
      clearTimeout(killTimer);
      resolve({
        status: JobStatus.RUNTIME_ERROR,
        stdout: "",
        stderr: err.message,
        exit_code: null,
      });
    });
  });
}
