import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadScenarioWithMeta } from "./scenario-migrations";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
);
const examplesDir = path.join(repoRoot, "examples/v1");

describe("v1 example scenarios", () => {
  const scenarioFiles = readdirSync(examplesDir)
    .filter((fileName) => fileName.endsWith(".fieldcraft.json"))
    .sort((left, right) => left.localeCompare(right));

  it("loads every committed v1 example without migration", () => {
    expect(scenarioFiles).toEqual([
      "bridgehead-square.fieldcraft.json",
      "convoy-free-coordinate.fieldcraft.json",
      "ridgeline-hex.fieldcraft.json"
    ]);

    const loaded = scenarioFiles.map((fileName) => {
      const filePath = path.join(examplesDir, fileName);
      const result = loadScenarioWithMeta(readFileSync(filePath, "utf8"));

      expect(result.migrated).toBe(false);
      expect(result.scenario.pieces.length).toBeGreaterThan(0);
      expect(result.scenario.sides.length).toBeGreaterThan(0);
      expect(result.scenario.pieces.some((piece) => piece.properties.length > 0)).toBe(true);
      expect(result.scenario.pieces.some((piece) => piece.imageAssetId)).toBe(true);

      return result.scenario;
    });

    expect(loaded.map((scenario) => scenario.space?.type).sort()).toEqual([
      "free-coordinate",
      "hex-grid",
      "square-grid"
    ]);
  });

  it("keeps package-local asset paths present beside the examples", () => {
    for (const fileName of scenarioFiles) {
      const filePath = path.join(examplesDir, fileName);
      const { scenario } = loadScenarioWithMeta(readFileSync(filePath, "utf8"));

      for (const asset of scenario.assets) {
        expect(existsSync(path.join(examplesDir, asset.path))).toBe(true);
      }
    }
  });
});
