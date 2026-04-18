import { describe, it, expect } from "vitest";
import { generatePieceId, isPieceIdShape, pieceIdAlphabet } from "./identity";

describe("generatePieceId", () => {
  it("produces an id with the piece_ prefix and 6 alphabet characters", () => {
    const id = generatePieceId([]);
    expect(id).toMatch(/^piece_[0-9A-Z]{6}$/);
  });

  it("uses the Crockford base32 alphabet (excludes I, L, O, U)", () => {
    for (const char of pieceIdAlphabet) {
      expect("ILOU").not.toContain(char);
    }
    expect(pieceIdAlphabet.length).toBe(32);
  });

  it("avoids collisions with existing ids (retries)", () => {
    const forced = new Set<string>();
    for (let i = 0; i < 500; i += 1) {
      const id = generatePieceId(forced);
      expect(forced.has(id)).toBe(false);
      forced.add(id);
    }
  });

  it("never returns an id outside the alphabet", () => {
    for (let i = 0; i < 200; i += 1) {
      const id = generatePieceId([]);
      expect(isPieceIdShape(id)).toBe(true);
    }
  });
});

describe("isPieceIdShape", () => {
  it("accepts well-formed ids", () => {
    expect(isPieceIdShape("piece_7A3FK2")).toBe(true);
  });

  it("rejects non-conforming strings", () => {
    expect(isPieceIdShape("")).toBe(false);
    expect(isPieceIdShape("piece_12345")).toBe(false);
    expect(isPieceIdShape("piece_1234567")).toBe(false);
    expect(isPieceIdShape("PIECE_123456")).toBe(false);
    expect(isPieceIdShape("piece_ILOU12")).toBe(false);
  });
});
