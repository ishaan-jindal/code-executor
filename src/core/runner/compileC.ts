import { execFile } from "child_process";
import { promisify } from "util";
import { JobStatus } from "../jobs/jobTypes.ts";
import { buildCompileArgs } from "./sandbox.ts";

const execFileAsync = promisify(execFile);

/**
 * Compile C source code inside a sandboxed Docker container.
 *
 * @param {string} dir - Host directory containing main.c
 * @throws {{ status: string, stderr: string }} on compilation failure
 */
export async function compileC(dir) {
  const compileCmd =
    "gcc /app/main.c -O2 -o /app/a.out && chmod +x /app/a.out";

  const dockerArgs = buildCompileArgs({
    hostDir: dir,
    image: "runner-c",
    cmd: ["/bin/sh", "-c", compileCmd],
  });

  try {
    await execFileAsync("docker", dockerArgs);
  } catch (err) {
    throw {
      status: JobStatus.COMPILE_ERROR,
      stderr: err.stderr || err.message,
    };
  }
}
