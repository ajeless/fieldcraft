import { describe, it, expect } from "vitest";
import { migrateV1ToV2 } from "./v1-to-v2";

describe("migrateV1ToV2", () => {
  it("bumps the schema version without dropping authored marker image refs", () => {
    const input = {
      schema: "fieldcraft.scenario",
      schemaVersion: 1,
      title: "Marker art",
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

    expect(migrateV1ToV2(input)).toEqual({
      ...input,
      schemaVersion: 2
    });
  });
});
