import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { migrateV0ToV1 } from "./v0-to-v1";

const fixturesDir = join(__dirname, "../../test-fixtures/migrations/v0-to-v1");

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(fixturesDir, name), "utf8"));
}

function makeStubIdGenerator(): () => string {
  let counter = 0;
  return () => {
    counter += 1;
    return `piece_STUB${String(counter).padStart(2, "0")}`;
  };
}

describe("migrateV0ToV1", () => {
  it("migrates a tile scenario, preserving labels from old ids and leaving assets untouched", () => {
    const pre = loadFixture("pre-tile.json");
    const post = loadFixture("post-tile.json");
    expect(migrateV0ToV1(pre, { generateId: makeStubIdGenerator() })).toEqual(post);
  });

  it("migrates a free-coordinate scenario with decimal and negative positions", () => {
    const pre = loadFixture("pre-free.json");
    const post = loadFixture("post-free.json");
    expect(migrateV0ToV1(pre, { generateId: makeStubIdGenerator() })).toEqual(post);
  });

  it("migrates an empty scenario", () => {
    const pre = loadFixture("pre-empty.json");
    const post = loadFixture("post-empty.json");
    expect(migrateV0ToV1(pre, { generateId: makeStubIdGenerator() })).toEqual(post);
  });
});
