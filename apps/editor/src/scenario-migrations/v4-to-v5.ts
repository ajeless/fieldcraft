import { schemaIdentifier } from "../scenario";

const v5SchemaVersion = 5;
const defaultPieceStyle = {
  shape: "circle",
  fillColor: "#c85448",
  strokeColor: "#7a2a22"
};

export function migrateV4ToV5(input: unknown): unknown {
  if (!isRecord(input)) {
    throw new Error("migrateV4ToV5: expected an object.");
  }

  return {
    ...input,
    schema: schemaIdentifier,
    schemaVersion: v5SchemaVersion,
    pieces: Array.isArray(input.pieces) ? input.pieces.map(migratePiece) : input.pieces
  };
}

function migratePiece(piece: unknown): unknown {
  if (!isRecord(piece)) {
    return piece;
  }

  return {
    ...piece,
    style: defaultPieceStyle
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
