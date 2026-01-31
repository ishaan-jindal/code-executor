import { spawn, spawnSync } from "child_process";
import path from "path";
import { JobStatus } from "../jobs/jobTypes.js";
import { truncateOutput, MAX_OUTPUT_SIZE } from "../utils/outputHandler.js";

const SECCOMP = path.resolve("./seccomp-runtime.json");

export function runBinary(dir, stdin) {
  const containerId = `runner-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Build docker args with optional gVisor runtime
  const dockerArgs = [
    "run",
    "--rm",
    "-i",
    "--name",
    containerId,
  ];
  
  // Only add gVisor runtime if available (can be disabled via env var)
  if (process.env.DISABLE_GVISOR !== "true") {
    dockerArgs.push("--runtime=runsc");
  }
  
  dockerArgs.push(
    "--memory=64m",
    "--cpus=0.5",
    "--pids-limit=32",
    "--network=none",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    "--security-opt",
    `seccomp=${SECCOMP}`,
    "--read-only",
    "--tmpfs",
    "/tmp:rw,nosuid,noexec,size=16m",
    "--user=runner",
    "-v",
    `${dir}:/app`,
    "runner-runtime",
    "./a.out"
  );

  return new Promise((resolve, reject) => {
    const child = spawn("docker", dockerArgs, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "",
      stderr = "";
    let truncated = false;

    let finished = false;
    const done = (result) => {
      if (finished) return;
      finished = true;
      clearTimeout(killTimer);
      resolve(result);
    };

    child.stdout.on("data", (d) => {
      if (!truncated && stdout.length + d.length > MAX_OUTPUT_SIZE) {
        truncated = true;
        stdout = truncateOutput(stdout);
      }
      if (!truncated) {
        stdout += d;
      }
    });
    child.stderr.on("data", (d) => {
      if (!truncated && stderr.length + d.length > MAX_OUTPUT_SIZE) {
        truncated = true;
        stderr = truncateOutput(stderr);
      }
      if (!truncated) {
        stderr += d;
      }
    });

    child.stdin.write(stdin ?? "");
    child.stdin.end();

    const killTimer = setTimeout(() => {
      // First, explicitly kill the container
      try {
        spawnSync("docker", ["kill", containerId], { timeout: 1000 });
      } catch (e) {
        // ignore if docker kill fails
      }

      // Then kill the docker process
      try {
        child.kill("SIGKILL");
      } catch (e) {
        // ignore
      }

      done({
        status: JobStatus.TIME_LIMIT_EXCEEDED,
        stdout: truncateOutput(stdout),
        stderr: truncateOutput(stderr),
        exit_code: null,
      });
    }, Number(process.env.EXEC_TIMEOUT_MS || 2000));

    child.on("close", (code) => {
      done({
        status: code === 0 ? JobStatus.ACCEPTED : JobStatus.RUNTIME_ERROR,
        stdout: truncateOutput(stdout),
        stderr: truncateOutput(stderr),
        exit_code: code,
      });
    });

    child.on("error", (err) => {
      if (finished) return;
      finished = true;
      clearTimeout(killTimer);
      reject(err);
    });
  });
}
