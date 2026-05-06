import { buildSandboxArgs, generateContainerId } from "./sandbox.ts";
import { executeContainer } from "./executeContainer.ts";

/**
 * Run a Python script inside a sandboxed Docker container.
 *
 * @param {string} dir   - Host directory containing main.py
 * @param {string|null} stdin - stdin data to pipe
 * @returns {Promise<{status: string, stdout: string, stderr: string, exit_code: number|null}>}
 */
export function runPython(dir, stdin) {
  const containerId = generateContainerId();

  const dockerArgs = buildSandboxArgs({
    containerId,
    image: "runner-py",
    interactive: true,
    hostDir: dir,
    cmd: ["main.py"],
  });

  return executeContainer(dockerArgs, stdin, containerId);
}
