import { schemaIdentifier, currentSchemaVersion } from "../scenario";

export function migrateV1ToV2(input: unknown): unknown {
  if (!isRecord(input)) {
    throw new Error("migrateV1ToV2: expected an object.");
  }

  return {
    ...input,
    schema: schemaIdentifier,
    schemaVersion: currentSchemaVersion
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
