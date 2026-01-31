import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import { JobStatus } from "../jobs/jobTypes.js";

const execFileAsync = promisify(execFile);

export async function compileC(dir) {
  try {
    const compileCmd = "gcc /app/main.c -O2 -o /app/a.out && chmod +x /app/a.out";
    
    const dockerArgs = ["run", "--rm"];
    if (process.env.DISABLE_GVISOR !== "true") {
      dockerArgs.push("--runtime=runsc");
    }
    dockerArgs.push("--network=none");
    
    await execFileAsync("docker", [
      ...dockerArgs,
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",
      "--tmpfs",
      "/tmp:rw,nosuid,noexec,size=64m",
      "-v",
      `${dir}:/app`,
      "runner-c",
      "/bin/sh",
      "-c",
      compileCmd,
    ]);
  } catch (err) {
    throw {
      status: JobStatus.COMPILE_ERROR,
      stderr: err.stderr || err.message,
    };
  }
}
