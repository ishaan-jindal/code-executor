import { spawn } from "child_process";
import path from "path";
import { JobStatus } from "../jobs/jobTypes.js";

const SECCOMP = path.resolve("./seccomp-runtime.json");

export function runPython(dir, stdin) {
  return new Promise((resolve) => {
    const child = spawn(
      "docker",
      [
        "run",
        "--rm",
        "-i",

        "--runtime=runsc",

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
        "python3",
        "main.py",
      ],
      { stdio: ["pipe", "pipe", "pipe"] },
    );

    let stdout = "",
      stderr = "";

    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));

    child.stdin.write(stdin ?? "");
    child.stdin.end();

    setTimeout(() => {
      child.kill("SIGKILL");
      resolve({
        status: JobStatus.TIME_LIMIT_EXCEEDED,
        stdout,
        stderr,
      });
    }, 2000);

    child.on("close", (code) => {
      resolve({
        status: code === 0 ? JobStatus.ACCEPTED : JobStatus.RUNTIME_ERROR,
        stdout,
        stderr,
        exit_code: code,
      });
    });
  });
}
