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
interface ExecFileError extends Error {
  stderr?: string;
}

export interface CompileError {
  status: typeof JobStatus.COMPILE_ERROR;
  stderr: string;
}

export async function compileC(dir: string): Promise<void> {
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
    const execError = err as ExecFileError;
    throw {
      status: JobStatus.COMPILE_ERROR,
      stderr: execError.stderr || execError.message,
    } satisfies CompileError;
  }
}
