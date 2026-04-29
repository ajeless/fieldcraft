import { describe, expect, it } from "vitest";
import { migrateV2ToV3 } from "./v2-to-v3";

describe("migrateV2ToV3", () => {
  it("adds scenario sides and removes the old neutral side placeholder from pieces", () => {
    const input = {
      schema: "fieldcraft.scenario",
      schemaVersion: 2,
      title: "Legacy neutral markers",
      space: {
        type: "square-grid",
        width: 4,
        height: 4,
        tileSize: 48,
        scale: { distancePerTile: 1, unit: "tile" },
        grid: { lineColor: "#aeb8c1", lineOpacity: 1 },
        background: { color: "#f9fbfb" }
      },
      assets: [{ id: "marker-art", kind: "image", path: "assets/marker-art.png" }],
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
        editorVersion: "0.1.0-experiment",
        savedAt: null
      }
    };

    expect(migrateV2ToV3(input)).toEqual({
      ...input,
      schemaVersion: 3,
      sides: [],
      pieces: [
        {
          id: "piece_ART001",
          label: "Scout",
          kind: "marker",
          x: 1,
          y: 2,
          imageAssetId: "marker-art"
        }
      ]
    });
  });
});
