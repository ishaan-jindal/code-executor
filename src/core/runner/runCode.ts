import fs from "fs";
import path from "path";
import os from "os";
import { JobStatus } from "../jobs/jobTypes.ts";

import { compileC } from "./compileC.ts";
import { runBinary } from "./runBinary.ts";
import { runPython } from "./runPython.ts";

export default async function runCode(job) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "run-"));
  fs.chmodSync(dir, 0o777);
  const hasMultipleInputs = Array.isArray(job.inputs) && job.inputs.length > 0;
  const inputs = hasMultipleInputs ? job.inputs : [job.stdin];

  try {
    if (job.language === "c") {
      const cPath = path.join(dir, "main.c");
      fs.writeFileSync(cPath, job.code);
      fs.chmodSync(cPath, 0o644);

      const compileStart = Date.now();
      try {
        await compileC(dir);
      } catch (err) {
        const compileTime = Date.now() - compileStart;
        return {
          status: JobStatus.COMPILE_ERROR,
          stdout: "",
          stderr: err.stderr || (err.message || "Compilation failed"),
          exit_code: null,
          metrics: {
            compile_time_ms: compileTime,
            exec_time_ms: 0,
          },
        };
      }

      const compileTime = Date.now() - compileStart;
      const results = [];
      let execTimeTotal = 0;

      for (const input of inputs) {
        const execStart = Date.now();
        const execResult = await runBinary(dir, input);
        const execTime = Date.now() - execStart;
        execTimeTotal += execTime;
        results.push({
          stdin: input == null ? "" : String(input),
          ...execResult,
        });
      }

      const overallStatus = results.every((r) => r.status === JobStatus.ACCEPTED)
        ? JobStatus.ACCEPTED
        : results.find((r) => r.status !== JobStatus.ACCEPTED)?.status;

      const response = hasMultipleInputs
        ? {
          status: overallStatus,
          results,
          stdout: "",
          stderr: "",
          exit_code: null,
        }
        : {
          ...results[0],
        };

      return {
        ...response,
        metrics: {
          compile_time_ms: compileTime,
          exec_time_ms: execTimeTotal,
        },
      };
    }

    if (job.language === "python") {
      const pyPath = path.join(dir, "main.py");
      fs.writeFileSync(pyPath, job.code);
      fs.chmodSync(pyPath, 0o644);
      const results = [];
      let execTimeTotal = 0;

      for (const input of inputs) {
        const execStart = Date.now();
        const execResult = await runPython(dir, input);
        const execTime = Date.now() - execStart;
        execTimeTotal += execTime;
        results.push({
          stdin: input == null ? "" : String(input),
          ...execResult,
        });
      }

      const overallStatus = results.every((r) => r.status === JobStatus.ACCEPTED)
        ? JobStatus.ACCEPTED
        : results.find((r) => r.status !== JobStatus.ACCEPTED)?.status;

      const response = hasMultipleInputs
        ? {
          status: overallStatus,
          results,
          stdout: "",
          stderr: "",
          exit_code: null,
        }
        : {
          ...results[0],
        };

      return {
        ...response,
        metrics: {
          compile_time_ms: 0,
          exec_time_ms: execTimeTotal,
        },
      };
    }

    return {
      status: JobStatus.SYSTEM_ERROR,
      stdout: "",
      stderr: "Unsupported language",
      exit_code: null,
      metrics: {
        compile_time_ms: 0,
        exec_time_ms: 0,
      },
    };
  } catch (err) {
    return {
      status: JobStatus.SYSTEM_ERROR,
      stdout: "",
      stderr: err?.message || "Internal error",
      exit_code: null,
      metrics: {
        compile_time_ms: 0,
        exec_time_ms: 0,
      },
    };
  } finally {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch (e) {
      // ignore cleanup errors
    }
  }
}
