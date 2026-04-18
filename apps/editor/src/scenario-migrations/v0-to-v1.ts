import { schemaIdentifier } from "../scenario";

const v1SchemaVersion = 1;

export type MigrateV0ToV1Options = {
  generateId: () => string;
};

export function migrateV0ToV1(
  input: unknown,
  options: MigrateV0ToV1Options
): unknown {
  if (!isRecord(input)) {
    throw new Error("migrateV0ToV1: expected an object.");
  }

  const pieces = Array.isArray(input.pieces) ? input.pieces : [];
  const migratedPieces = pieces.map((piece) => migratePiece(piece, options));

  const output: Record<string, unknown> = {
    ...input,
    schema: schemaIdentifier,
    schemaVersion: v1SchemaVersion,
    pieces: migratedPieces
  };

  return output;
}

function migratePiece(
  piece: unknown,
  options: MigrateV0ToV1Options
): unknown {
  if (!isRecord(piece)) {
    return piece;
  }

  const label = typeof piece.id === "string" ? piece.id : "";
  const { id: _oldId, ...rest } = piece;

  return {
    ...rest,
    id: options.generateId(),
    label
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
