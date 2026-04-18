import { describe, expect, it } from "vitest";
import {
  createEmptyScenario,
  createTileScenarioSpace,
  currentSchemaVersion,
  parseScenario,
  schemaIdentifier,
  scenarioToJson,
  type Scenario
} from "./scenario";

function createScenario(): Scenario {
  return {
    ...createEmptyScenario(),
    title: "Marker art validation",
    space: createTileScenarioSpace({
      type: "square-grid",
      width: 4,
      height: 4
    }),
    assets: [
      {
        id: "marker-art",
        kind: "image",
        path: "assets/marker-art.png"
      },
      {
        id: "marker-tone",
        kind: "audio",
        path: "assets/marker-tone.wav"
      }
    ],
    pieces: [
      {
        id: "piece_ART001",
        label: "Scout",
        kind: "marker",
        side: "neutral",
        x: 1,
        y: 2,
        imageAssetId: "marker-art"
      }
    ],
    metadata: {
      editorVersion: "test",
      savedAt: null
    }
  };
}

describe("parseScenario", () => {
  it("parses marker image asset refs on pieces", () => {
    const scenario = parseScenario(scenarioToJson(createScenario()));
    expect(scenario.schema).toBe(schemaIdentifier);
    expect(scenario.schemaVersion).toBe(currentSchemaVersion);
    expect(scenario.pieces[0]?.imageAssetId).toBe("marker-art");
  });

  it("rejects a missing marker image asset ref", () => {
    const scenario = createScenario();
    scenario.pieces[0] = {
      ...scenario.pieces[0],
      imageAssetId: "missing-art"
    };

    expect(() => parseScenario(scenarioToJson(scenario))).toThrowError(
      "Marker piece_ART001 references missing image asset ID: missing-art"
    );
  });

  it("rejects a non-image marker image asset ref", () => {
    const scenario = createScenario();
    scenario.pieces[0] = {
      ...scenario.pieces[0],
      imageAssetId: "marker-tone"
    };

    expect(() => parseScenario(scenarioToJson(scenario))).toThrowError(
      "Marker piece_ART001 image asset must be an image: marker-tone"
    );
  });
});
