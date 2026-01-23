import fs from "fs";
import path from "path";
import { JobStatus } from "../jobs/jobTypes.js";

import { compileC } from "./compileC.js";
import { runBinary } from "./runBinary.js";
import { runPython } from "./runPython.js";

export default async function runCode(job) {
  const dir = fs.mkdtempSync("/tmp/run-");

  try {
    if (job.language === "c") {
      fs.writeFileSync(path.join(dir, "main.c"), job.code);

      try {
        compileC(dir);
      } catch (err) {
        return {
          status: JobStatus.COMPILE_ERROR,
          stdout: "",
          stderr: err.stderr || "Compilation failed",
          exit_code: null,
        };
      }

      return await runBinary(dir, job.stdin);
    }

    if (job.language === "python") {
      fs.writeFileSync(path.join(dir, "main.py"), job.code);
      return await runPython(dir, job.stdin);
    }

    return {
      status: JobStatus.SYSTEM_ERROR,
      stdout: "",
      stderr: "Unsupported language",
      exit_code: null,
    };
  } catch (err) {
    return {
      status: JobStatus.SYSTEM_ERROR,
      stdout: "",
      stderr: err?.message || "Internal error",
      exit_code: null,
    };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
