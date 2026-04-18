import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CURRENT_SCHEMA_VERSION,
  loadScenario,
  loadScenarioWithMeta,
  ScenarioLoadError
} from "./index";

const fixturesDir = join(__dirname, "../../test-fixtures/migrations/v0-to-v1");

function readFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), "utf8");
}

function readCurrentFixture(name: string): string {
  const payload = JSON.parse(readFixture(name));
  payload.schemaVersion = CURRENT_SCHEMA_VERSION;
  return JSON.stringify(payload);
}

describe("loadScenario", () => {
  it("loads a current-version payload directly", () => {
    const text = readCurrentFixture("post-tile.json");
    const { scenario, migrated } = loadScenarioWithMeta(text);
    expect(migrated).toBe(false);
    expect(scenario.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(scenario.pieces[0]?.label).toBe("marker-2-1");
  });

  it("migrates a v0 payload (legacy composite schema string)", () => {
    const text = readFixture("pre-tile.json");
    const scenario = loadScenario(text);
    expect(scenario.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(scenario.pieces[0]?.label).toBe("marker-2-1");
    expect(scenario.pieces[0]?.id).toMatch(/^piece_[0-9A-Z]{6}$/);
  });

  it("migrates a v1 payload into the current schema version", () => {
    const text = readFixture("post-tile.json");
    const { scenario, migrated } = loadScenarioWithMeta(text);
    expect(migrated).toBe(true);
    expect(scenario.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(scenario.pieces[0]?.label).toBe("marker-2-1");
  });

  it("rejects a future version with a readable error", () => {
    const future = JSON.stringify({
      schema: "fieldcraft.scenario",
      schemaVersion: 99,
      title: "from the future",
      space: null,
      assets: [],
      pieces: [],
      metadata: { editorVersion: "future", savedAt: null }
    });

    expect(() => loadScenario(future)).toThrowError(ScenarioLoadError);
    try {
      loadScenario(future);
    } catch (error) {
      expect(error).toBeInstanceOf(ScenarioLoadError);
      if (error instanceof ScenarioLoadError) {
        expect(error.kind).toBe("future-version");
        expect(error.message).toContain("99");
      }
    }
  });

  it("rejects invalid JSON", () => {
    try {
      loadScenario("{ not json");
      throw new Error("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ScenarioLoadError);
      if (error instanceof ScenarioLoadError) {
        expect(error.kind).toBe("invalid-json");
      }
    }
  });

  it("rejects non-scenario JSON", () => {
    try {
      loadScenario(JSON.stringify({ hello: "world" }));
      throw new Error("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ScenarioLoadError);
      if (error instanceof ScenarioLoadError) {
        expect(error.kind).toBe("not-a-scenario");
      }
    }
  });

  it("rejects a negative schemaVersion with not-a-scenario", () => {
    const payload = JSON.stringify({
      schema: "fieldcraft.scenario",
      schemaVersion: -1,
      title: "bad version",
      space: null,
      assets: [],
      pieces: [],
      metadata: { editorVersion: "x", savedAt: null }
    });

    try {
      loadScenario(payload);
      throw new Error("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ScenarioLoadError);
      if (error instanceof ScenarioLoadError) {
        expect(error.kind).toBe("not-a-scenario");
      }
    }
  });

  it("rejects a non-integer schemaVersion with not-a-scenario", () => {
    const payload = JSON.stringify({
      schema: "fieldcraft.scenario",
      schemaVersion: 1.5,
      title: "bad version",
      space: null,
      assets: [],
      pieces: [],
      metadata: { editorVersion: "x", savedAt: null }
    });

    try {
      loadScenario(payload);
      throw new Error("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ScenarioLoadError);
      if (error instanceof ScenarioLoadError) {
        expect(error.kind).toBe("not-a-scenario");
      }
    }
  });

  it("surfaces downstream validation failure as invalid-payload", () => {
    const payload = JSON.stringify({
      schema: "fieldcraft.scenario",
      schemaVersion: 1,
      title: "duplicate ids",
      space: {
        type: "square-grid",
        width: 4,
        height: 4,
        tileSize: 48,
        scale: { distancePerTile: 1, unit: "tile" },
        grid: { lineColor: "#aeb8c1", lineOpacity: 1 },
        background: { color: "#f9fbfb" }
      },
      assets: [],
      pieces: [
        { id: "piece_AAAAAA", label: "a", kind: "marker", side: "neutral", x: 0, y: 0 },
        { id: "piece_AAAAAA", label: "b", kind: "marker", side: "neutral", x: 1, y: 1 }
      ],
      metadata: { editorVersion: "x", savedAt: null }
    });

    try {
      loadScenario(payload);
      throw new Error("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ScenarioLoadError);
      if (error instanceof ScenarioLoadError) {
        expect(error.kind).toBe("invalid-payload");
      }
    }
  });

  it("reports a migration side effect so callers can mark docs dirty", () => {
    const v0Text = readFixture("pre-tile.json");
    const v1Text = readFixture("post-tile.json");
    const currentText = readCurrentFixture("post-tile.json");
    expect(loadScenarioWithMeta(v0Text).migrated).toBe(true);
    expect(loadScenarioWithMeta(v1Text).migrated).toBe(true);
    expect(loadScenarioWithMeta(currentText).migrated).toBe(false);
  });
});
