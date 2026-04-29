import { describe, expect, it } from "vitest";
import { migrateV3ToV4 } from "./v3-to-v4";

describe("migrateV3ToV4", () => {
  it("adds default authored facing to marker pieces", () => {
    const input = {
      schema: "fieldcraft.scenario",
      schemaVersion: 3,
      title: "Sided markers",
      space: {
        type: "square-grid",
        width: 4,
        height: 4,
        tileSize: 48,
        scale: { distancePerTile: 1, unit: "tile" },
        grid: { lineColor: "#aeb8c1", lineOpacity: 1 },
        background: { color: "#f9fbfb" }
      },
      sides: [{ id: "side_TEST01", label: "Blue", color: "#2f80ed" }],
      assets: [],
      pieces: [
        {
          id: "piece_ART001",
          label: "Scout",
          kind: "marker",
          x: 1,
          y: 2,
          sideId: "side_TEST01"
        }
      ],
      metadata: {
        editorVersion: "0.1.0-experiment",
        savedAt: null
      }
    };

    expect(migrateV3ToV4(input)).toEqual({
      ...input,
      schemaVersion: 4,
      pieces: [
        {
          id: "piece_ART001",
          label: "Scout",
          kind: "marker",
          x: 1,
          y: 2,
          sideId: "side_TEST01",
          facingDegrees: 0
        }
      ]
    });
  });
});
