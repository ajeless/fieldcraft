import { schemaIdentifier } from "../scenario";

const v6SchemaVersion = 6;

export function migrateV5ToV6(input: unknown): unknown {
  if (!isRecord(input)) {
    throw new Error("migrateV5ToV6: expected an object.");
  }

  return {
    ...input,
    schema: schemaIdentifier,
    schemaVersion: v6SchemaVersion,
    pieces: Array.isArray(input.pieces) ? input.pieces.map(migratePiece) : input.pieces
  };
}

function migratePiece(piece: unknown): unknown {
  if (!isRecord(piece)) {
    return piece;
  }

  return {
    ...piece,
    properties: []
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
