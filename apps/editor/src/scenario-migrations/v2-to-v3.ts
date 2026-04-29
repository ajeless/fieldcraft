import { schemaIdentifier, currentSchemaVersion } from "../scenario";

export function migrateV2ToV3(input: unknown): unknown {
  if (!isRecord(input)) {
    throw new Error("migrateV2ToV3: expected an object.");
  }

  return {
    ...input,
    schema: schemaIdentifier,
    schemaVersion: currentSchemaVersion,
    sides: [],
    pieces: Array.isArray(input.pieces) ? input.pieces.map(migratePiece) : input.pieces
  };
}

function migratePiece(piece: unknown): unknown {
  if (!isRecord(piece)) {
    return piece;
  }

  const { side: _side, sideId: _sideId, ...rest } = piece;
  void _side;
  void _sideId;
  return rest;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
