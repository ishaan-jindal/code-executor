import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ApiResponse } from "../../src/utils/apiResponse.js";

describe("ApiResponse", () => {
  describe("success", () => {
    it("should wrap data in success envelope", () => {
      const result = ApiResponse.success({ foo: "bar" });
      assert.deepEqual(result, {
        success: true,
        data: { foo: "bar" },
      });
    });

    it("should handle null data", () => {
      const result = ApiResponse.success(null);
      assert.deepEqual(result, { success: true, data: null });
    });
  });

  describe("error", () => {
    it("should create error response with message", () => {
      const result = ApiResponse.error("Something failed");
      assert.deepEqual(result, {
        success: false,
        error: "Something failed",
      });
    });

    it("should include code when provided", () => {
      const result = ApiResponse.error("Not found", "NOT_FOUND");
      assert.deepEqual(result, {
        success: false,
        error: "Not found",
        code: "NOT_FOUND",
      });
    });

    it("should omit code when null", () => {
      const result = ApiResponse.error("Error", null);
      assert.ok(!("code" in result));
    });
  });

  describe("jobResponse", () => {
    it("should return minimal response when output not included", () => {
      const job = { id: "abc-123", status: "QUEUED" };
      const result = ApiResponse.jobResponse(job, false);
      assert.deepEqual(result, { job_id: "abc-123", status: "QUEUED" });
    });

    it("should include metrics when present", () => {
      const job = {
        id: "abc-123",
        status: "ACCEPTED",
        metrics: { exec_time_ms: 100 },
      };
      const result = ApiResponse.jobResponse(job, false);
      assert.deepEqual(result.metrics, { exec_time_ms: 100 });
    });

    it("should include results array when output included and results exist", () => {
      const job = {
        id: "abc-123",
        status: "ACCEPTED",
        results: [
          { stdin: "", status: "ACCEPTED", stdout: "Hello\n", stderr: "", exit_code: 0 },
        ],
      };
      const result = ApiResponse.jobResponse(job, true);
      assert.deepEqual(result.results, job.results);
    });

    it("should synthesize results from flat fields when no results array", () => {
      const job = {
        id: "abc-123",
        status: "ACCEPTED",
        stdout: "Hello\n",
        stderr: "",
        exit_code: 0,
      };
      const result = ApiResponse.jobResponse(job, true);
      assert.equal(result.results.length, 1);
      assert.equal(result.results[0].stdout, "Hello\n");
      assert.equal(result.results[0].exit_code, 0);
    });

    it("should handle undefined exit_code as null", () => {
      const job = { id: "abc-123", status: "RUNNING" };
      const result = ApiResponse.jobResponse(job, true);
      assert.equal(result.results[0].exit_code, null);
    });
  });
});
