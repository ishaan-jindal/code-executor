import fs from "fs";
import path from "path";
import { spawn } from "child_process";

const FILES = {
  python: "main.py",
  c: "main.c"
};

const IMAGES = {
  python: "runner-py",
  c: "runner-c"
};

export function runCode({ language, code, input }) {
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
      {
        stdio: ["pipe", "pipe", "pipe"]
      }
    );

    let stdout = "";
    let stderr = "";
    let finished = false;

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.stdin.write(input);
    child.stdin.end();

    const timeout = setTimeout(() => {
      if (!finished) {
        finished = true;
        child.kill("SIGKILL");

        cleanup();
        resolve({
          success: false,
          error: "Time limit exceeded"
        });
      }
    }, 2000);

    child.on("close", (code) => {
      if (finished) return;
      finished = true;

      clearTimeout(timeout);
      cleanup();

      if (code === 0) {
        resolve({
          success: true,
          output: stdout
        });
      } else {
        resolve({
          success: false,
          error: stderr || "Runtime error"
        });
      }
    });

    function cleanup() {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch (_) {
        // ignore cleanup errors
      }
    }
  });
}

