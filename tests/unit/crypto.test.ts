import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hashToken } from "../../src/utils/crypto.ts";

describe("crypto utilities", () => {
  describe("hashToken", () => {
    it("should return a hex string", () => {
      const result = hashToken("test-token");
      assert.match(result, /^[0-9a-f]+$/);
    });

    it("should return 64 chars (SHA-256 hex)", () => {
      const result = hashToken("test-token");
      assert.equal(result.length, 64);
    });

    it("should be deterministic", () => {
      const hash1 = hashToken("same-token");
      const hash2 = hashToken("same-token");
      assert.equal(hash1, hash2);
    });

    it("should produce different hashes for different inputs", () => {
      const hash1 = hashToken("token-a");
      const hash2 = hashToken("token-b");
      assert.notEqual(hash1, hash2);
    });

    it("should handle empty string", () => {
      const result = hashToken("");
      assert.equal(result.length, 64);
    });
  });
});
