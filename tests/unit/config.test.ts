import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseTimeToSeconds } from "../../src/config/index.ts";

describe("Config utilities", () => {
  describe("parseTimeToSeconds", () => {
    it("should parse seconds", () => {
      assert.equal(parseTimeToSeconds("30s"), 30);
    });

    it("should parse minutes", () => {
      assert.equal(parseTimeToSeconds("15m"), 900);
    });

    it("should parse hours", () => {
      assert.equal(parseTimeToSeconds("2h"), 7200);
    });

    it("should parse days", () => {
      assert.equal(parseTimeToSeconds("7d"), 604800);
    });

    it("should return default (7 days) for invalid format", () => {
      assert.equal(parseTimeToSeconds("invalid"), 604800);
      assert.equal(parseTimeToSeconds(""), 604800);
      assert.equal(parseTimeToSeconds("15x"), 604800);
    });

    it("should handle single-digit values", () => {
      assert.equal(parseTimeToSeconds("1s"), 1);
      assert.equal(parseTimeToSeconds("1m"), 60);
      assert.equal(parseTimeToSeconds("1h"), 3600);
      assert.equal(parseTimeToSeconds("1d"), 86400);
    });

    it("should handle large values", () => {
      assert.equal(parseTimeToSeconds("365d"), 365 * 86400);
    });
  });
});
