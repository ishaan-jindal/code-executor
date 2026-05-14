import { buildSandboxArgs, generateContainerId } from "./sandbox.ts";
import { executeContainer } from "./executeContainer.ts";

/**
 * Run a compiled C binary inside a sandboxed Docker container.
 *
 * @param {string} dir   - Host directory containing a.out
 * @param {string|null} stdin - stdin data to pipe
 * @returns {Promise<{status: string, stdout: string, stderr: string, exit_code: number|null}>}
 */
export function runBinary(dir: string, stdin: string | number | null | undefined) {
  const containerId = generateContainerId();

  const dockerArgs = buildSandboxArgs({
    containerId,
    image: "runner-runtime",
    interactive: true,
    hostDir: dir,
    cmd: ["./a.out"],
  });

  return executeContainer(dockerArgs, stdin, containerId);
}
