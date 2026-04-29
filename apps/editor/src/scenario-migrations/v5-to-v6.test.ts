import { describe, expect, it } from "vitest";
import { migrateV5ToV6 } from "./v5-to-v6";

describe("migrateV5ToV6", () => {
  it("adds empty property arrays to styled pieces", () => {
    const input = {
      schema: "fieldcraft.scenario",
      schemaVersion: 5,
      title: "Styled markers",
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
          facingDegrees: 90,
          style: {
            shape: "diamond",
            fillColor: "#2f80ed",
            strokeColor: "#174a8b"
          }
        }
      ],
      metadata: {
        editorVersion: "0.1.0-experiment",
        savedAt: null
      }
    };

    expect(migrateV5ToV6(input)).toEqual({
      ...input,
      schemaVersion: 6,
      pieces: [
        {
          id: "piece_ART001",
          label: "Scout",
          kind: "marker",
          x: 1,
          y: 2,
          facingDegrees: 90,
          style: {
            shape: "diamond",
            fillColor: "#2f80ed",
            strokeColor: "#174a8b"
          },
          properties: []
        }
      ]
    });
  });
});
