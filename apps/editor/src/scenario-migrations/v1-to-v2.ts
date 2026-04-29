import { schemaIdentifier } from "../scenario";

const v2SchemaVersion = 2;

export function migrateV1ToV2(input: unknown): unknown {
  if (!isRecord(input)) {
    throw new Error("migrateV1ToV2: expected an object.");
  }

  return {
    ...input,
    schema: schemaIdentifier,
    schemaVersion: v2SchemaVersion
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
