import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { truncateOutput, MAX_OUTPUT_SIZE } from "../../src/utils/outputHandler.js";

describe("outputHandler", () => {
  describe("MAX_OUTPUT_SIZE", () => {
    it("should be 100KB", () => {
      assert.equal(MAX_OUTPUT_SIZE, 100 * 1024);
    });
  });

  describe("truncateOutput", () => {
    it("should return text unchanged when under limit", () => {
      const text = "Hello, World!";
      assert.equal(truncateOutput(text), text);
    });

    it("should return empty string unchanged", () => {
      assert.equal(truncateOutput(""), "");
    });

    it("should truncate text exceeding limit", () => {
      const text = "x".repeat(MAX_OUTPUT_SIZE + 100);
      const result = truncateOutput(text);
      assert.ok(result.length <= MAX_OUTPUT_SIZE);
      assert.ok(result.includes("[OUTPUT TRUNCATED"));
    });

    it("should respect custom limit", () => {
      const text = "x".repeat(200);
      const result = truncateOutput(text, 100);
      assert.ok(result.length <= 100);
      assert.ok(result.includes("[OUTPUT TRUNCATED"));
    });

    it("should include byte limit in truncation message", () => {
      const text = "x".repeat(200);
      const result = truncateOutput(text, 150);
      assert.ok(result.includes("150 bytes"));
    });

    it("should keep content from the beginning", () => {
      const text = "BEGINNING" + "x".repeat(MAX_OUTPUT_SIZE);
      const result = truncateOutput(text);
      assert.ok(result.startsWith("BEGINNING"));
    });
  });
});
