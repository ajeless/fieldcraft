import { schemaIdentifier } from "../scenario";

const v4SchemaVersion = 4;

export function migrateV3ToV4(input: unknown): unknown {
  if (!isRecord(input)) {
    throw new Error("migrateV3ToV4: expected an object.");
  }

  return {
    ...input,
    schema: schemaIdentifier,
    schemaVersion: v4SchemaVersion,
    pieces: Array.isArray(input.pieces) ? input.pieces.map(migratePiece) : input.pieces
  };
}

function migratePiece(piece: unknown): unknown {
  if (!isRecord(piece)) {
    return piece;
  }

  return {
    ...piece,
    facingDegrees: 0
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
