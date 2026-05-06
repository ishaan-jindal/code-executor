import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "../../src/utils/apiError.ts";

describe("ApiError", () => {
  it("should set statusCode", () => {
    const err = new ApiError(404, "Not found");
    assert.equal(err.statusCode, 404);
  });

  it("should set message", () => {
    const err = new ApiError(400, "Bad request");
    assert.equal(err.message, "Bad request");
  });

  it("should set code when provided", () => {
    const err = new ApiError(429, "Rate limit exceeded", "RATE_LIMIT_EXCEEDED");
    assert.equal(err.code, "RATE_LIMIT_EXCEEDED");
  });

  it("should default code to null", () => {
    const err = new ApiError(500, "Internal error");
    assert.equal(err.code, null);
  });

  it("should set details when provided", () => {
    const err = new ApiError(400, "Validation failed", "VALIDATION_ERROR", {
      field: "email",
    });
    assert.deepEqual(err.details, { field: "email" });
  });

  it("should default details to null", () => {
    const err = new ApiError(500, "Internal error");
    assert.equal(err.details, null);
  });

  it("should be an instance of Error", () => {
    const err = new ApiError(500, "Error");
    assert.ok(err instanceof Error);
    assert.ok(err instanceof ApiError);
  });

  it("should have a stack trace", () => {
    const err = new ApiError(500, "Error");
    assert.ok(err.stack);
    assert.ok(err.stack.length > 0);
  });
});
