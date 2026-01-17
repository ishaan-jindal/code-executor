import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { JobStatus } from "../jobs/jobTypes.js";

const FILES = {
  python: "main.py",
  c: "main.c"
};

const IMAGES = {
  python: "runner-py",
  c: "runner-c"
};

export default function runCode(job) {
  const { language, code, stdin } = job;

  return new Promise((resolve) => {
    const dir = fs.mkdtempSync("/tmp/run-");
    const filePath = path.join(dir, FILES[language]);

    fs.writeFileSync(filePath, code);

    const child = spawn(
      "docker",
      [
        "run",
        "--rm",
        "-i",
        "--memory=64m",
        "--cpus=0.5",
        "--network=none",
        "--pids-limit=64",
        "-v",
        `${dir}:/app`,
        IMAGES[language]
      ],
      { stdio: ["pipe", "pipe", "pipe"] }
    );

    let stdout = "";
    let stderr = "";
    let finished = false;

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    child.stdin.write(stdin ?? "");
    child.stdin.end();

    const timeout = setTimeout(() => {
      if (finished) return;
      finished = true;

      child.kill("SIGKILL");
      cleanup();

      resolve({
        status: JobStatus.TIME_LIMIT_EXCEEDED,
        stdout,
        stderr: stderr || "Time limit exceeded",
        exit_code: null
      });
    }, 2000);

    child.on("close", (code) => {
      if (finished) return;
      finished = true;

      clearTimeout(timeout);
      cleanup();

      if (code === 0) {
        resolve({
          status: JobStatus.ACCEPTED,
          stdout,
          stderr,
          exit_code: 0
        });
      } else {
        resolve({
          status: JobStatus.RUNTIME_ERROR,
          stdout,
          stderr,
          exit_code: code
        });
      }
    });

    function cleanup() {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {}
    }
  });
}

