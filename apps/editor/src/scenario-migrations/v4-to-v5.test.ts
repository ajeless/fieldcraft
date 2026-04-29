import { describe, expect, it } from "vitest";
import { migrateV4ToV5 } from "./v4-to-v5";

describe("migrateV4ToV5", () => {
  it("adds default marker style data to pieces", () => {
    const input = {
      schema: "fieldcraft.scenario",
      schemaVersion: 4,
      title: "Facing markers",
      space: {
        type: "square-grid",
        width: 4,
        height: 4,
        tileSize: 48,
        scale: { distancePerTile: 1, unit: "tile" },
        grid: { lineColor: "#aeb8c1", lineOpacity: 1 },
        background: { color: "#f9fbfb" }
      },
      sides: [],
      assets: [],
      pieces: [
        {
          id: "piece_ART001",
          label: "Scout",
          kind: "marker",
          x: 1,
          y: 2,
          facingDegrees: 90
        }
      ],
      metadata: {
        editorVersion: "0.1.0-experiment",
        savedAt: null
      }
    };

    expect(migrateV4ToV5(input)).toEqual({
      ...input,
      schemaVersion: 5,
      pieces: [
        {
          id: "piece_ART001",
          label: "Scout",
          kind: "marker",
          x: 1,
          y: 2,
          facingDegrees: 90,
          style: {
            shape: "circle",
            fillColor: "#c85448",
            strokeColor: "#7a2a22"
          }
        }
      ]
    });
  });
});
