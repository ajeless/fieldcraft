import { parseScenario, schemaIdentifier, type Scenario } from "../scenario";
import { generatePieceId } from "./identity";
import { migrateV0ToV1 } from "./v0-to-v1";
import { migrateV1ToV2 } from "./v1-to-v2";
import { migrateV2ToV3 } from "./v2-to-v3";
import { migrateV3ToV4 } from "./v3-to-v4";
import { migrateV4ToV5 } from "./v4-to-v5";
import { migrateV5ToV6 } from "./v5-to-v6";

export const CURRENT_SCHEMA_VERSION = 6;

type MigrationStep = {
  from: number;
  to: number;
  migrate: (input: unknown) => unknown;
};

const migrations: readonly MigrationStep[] = [
  {
    from: 0,
    to: 1,
    migrate: (input) => {
      const taken = collectPieceIds(input);
      return migrateV0ToV1(input, {
        generateId: () => {
          const id = generatePieceId(taken);
          taken.add(id);
          return id;
        }
      });
    }
  },
  {
    from: 1,
    to: 2,
    migrate: migrateV1ToV2
  },
  {
    from: 2,
    to: 3,
    migrate: migrateV2ToV3
  },
  {
    from: 3,
    to: 4,
    migrate: migrateV3ToV4
  },
  {
    from: 4,
    to: 5,
    migrate: migrateV4ToV5
  },
  {
    from: 5,
    to: 6,
    migrate: migrateV5ToV6
  }
];

export type ScenarioLoadErrorKind =
  | "invalid-json"
  | "not-a-scenario"
  | "future-version"
  | "invalid-payload";

export class ScenarioLoadError extends Error {
  readonly kind: ScenarioLoadErrorKind;
  readonly cause?: unknown;

  constructor(kind: ScenarioLoadErrorKind, message: string, cause?: unknown) {
    super(message);
    this.name = "ScenarioLoadError";
    this.kind = kind;
    this.cause = cause;
  }
}

export function loadScenario(text: string): Scenario {
  return loadScenarioWithMeta(text).scenario;
}

export function loadScenarioWithMeta(text: string): {
  scenario: Scenario;
  migrated: boolean;
} {
  const parsed = safeJsonParse(text);
  const version = detectSchemaVersion(parsed);

  if (version > CURRENT_SCHEMA_VERSION) {
    throw new ScenarioLoadError(
      "future-version",
      `This scenario was saved by a newer Fieldcraft editor (schema version ${version}). ` +
        `This editor understands up to version ${CURRENT_SCHEMA_VERSION}.`
    );
  }

  let payload: unknown = parsed;
  const migrated = version < CURRENT_SCHEMA_VERSION;
  for (let v = version; v < CURRENT_SCHEMA_VERSION; v += 1) {
    const step = migrations.find((entry) => entry.from === v);
    if (!step) {
      throw new ScenarioLoadError(
        "invalid-payload",
        `No migration registered from schema version ${v} to ${v + 1}.`
      );
    }
    payload = step.migrate(payload);
  }

  let scenario: Scenario;
  try {
    scenario = parseScenario(JSON.stringify(payload));
  } catch (error) {
    throw new ScenarioLoadError(
      "invalid-payload",
      error instanceof Error
        ? error.message
        : `Payload failed v${CURRENT_SCHEMA_VERSION} validation.`
    );
  }
  return { scenario, migrated };
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new ScenarioLoadError(
      "invalid-json",
      error instanceof Error ? error.message : "Could not parse JSON.",
      error
    );
  }
}

function detectSchemaVersion(value: unknown): number {
  if (!isRecord(value)) {
    throw new ScenarioLoadError("not-a-scenario", "Input is not a JSON object.");
  }

  if (value.schema === schemaIdentifier && typeof value.schemaVersion === "number") {
    if (!Number.isInteger(value.schemaVersion) || value.schemaVersion < 0) {
      throw new ScenarioLoadError(
        "not-a-scenario",
        "schemaVersion must be a non-negative integer."
      );
    }
    return value.schemaVersion;
  }

  if (value.schema === "fieldcraft.scenario.v0") {
    return 0;
  }

  throw new ScenarioLoadError(
    "not-a-scenario",
    "Input is not a Fieldcraft scenario (missing or unrecognized schema)."
  );
}

function collectPieceIds(input: unknown): Set<string> {
  const ids = new Set<string>();
  if (!isRecord(input) || !Array.isArray(input.pieces)) {
    return ids;
  }
  for (const piece of input.pieces) {
    if (isRecord(piece) && typeof piece.id === "string") {
      ids.add(piece.id);
    }
  }
  return ids;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
