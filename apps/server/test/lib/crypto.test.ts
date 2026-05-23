import { describe, expect, it } from "vitest";
import { decrypt, encrypt } from "../../src/lib/crypto";

describe("crypto", () => {
  it("round-trips arbitrary text", () => {
    const plaintext = "Hello, world!";
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it("never produces the same ciphertext twice (fresh IV per call)", () => {
    const a = encrypt("same");
    const b = encrypt("same");
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe("same");
    expect(decrypt(b)).toBe("same");
  });

  it("rejects tampered ciphertext (auth tag fails)", () => {
    const original = encrypt("secret");
    const tampered = `${original.slice(0, -4)}AAAA`;
    expect(() => decrypt(tampered)).toThrow();
  });

  it("handles unicode and large payloads", () => {
    const payload = "🌍".repeat(500) + "x".repeat(20_000);
    expect(decrypt(encrypt(payload))).toBe(payload);
  });
});
