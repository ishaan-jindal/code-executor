import { spawnSync } from "child_process";
import path from "path";
import { JobStatus } from "../jobs/jobTypes.js";

export function compileC(dir) {
  const result = spawnSync("docker", [
    "run", "--rm",

    "--runtime=runsc",
    "--network=none",

    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",

    "--tmpfs", "/tmp:rw,nosuid,noexec,size=64m",

    "-v", `${dir}:/app`,

    "runner-c",
    "/bin/sh",
    "-c",
    "gcc /app/main.c -O2 -o /app/a.out && chmod +x /app/a.out"
  ], { encoding: "utf-8" });

  if (result.status !== 0) {
    throw {
      status: JobStatus.COMPILE_ERROR,
      stderr: result.stderr
    };
  }
}

