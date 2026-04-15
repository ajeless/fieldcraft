export const scenarioSchema = "fieldcraft.scenario.v0";

export type ScenarioPiece = {
  id: string;
  kind: "marker";
  side: "neutral";
  x: number;
  y: number;
};

export type ScenarioSpace = {
  type: "square-grid";
  width: number;
  height: number;
};

export type Scenario = {
  schema: typeof scenarioSchema;
  title: string;
  space: ScenarioSpace | null;
  pieces: ScenarioPiece[];
  metadata: {
    editorVersion: string;
    savedAt: string | null;
  };
};

export const scenarioStorageKey = "fieldcraft:last-scenario";

export function createEmptyScenario(): Scenario {
  return {
    schema: scenarioSchema,
    title: "Untitled Fieldcraft Scenario",
    space: null,
    pieces: [],
    metadata: {
      editorVersion: "0.1.0-experiment",
      savedAt: null
    }
  };
}

export function prepareScenarioForSave(scenario: Scenario): Scenario {
  const pieces = scenario.space
    ? scenario.pieces
        .map((piece) => ({ ...piece }))
        .sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id))
    : [];

  return {
    ...scenario,
    pieces,
    metadata: {
      ...scenario.metadata,
      savedAt: new Date().toISOString()
    }
  };
}

export function parseScenario(input: string): Scenario {
  const parsed: unknown = JSON.parse(input);

  if (!isScenario(parsed)) {
    throw new Error("File is not a Fieldcraft scenario.");
  }

  return parsed;
}

export function scenarioToJson(scenario: Scenario): string {
  return `${JSON.stringify(scenario, null, 2)}\n`;
}

function isScenario(value: unknown): value is Scenario {
  if (!isRecord(value)) {
    return false;
  }

  if (value.schema !== scenarioSchema || typeof value.title !== "string") {
    return false;
  }

  if (!Array.isArray(value.pieces) || !isRecord(value.metadata)) {
    return false;
  }

  const space = parseScenarioSpace(value.space);
  if (space === false) {
    return false;
  }

  if (space === null) {
    return value.pieces.length === 0;
  }

  const width = space.width;
  const height = space.height;

  return value.pieces.every((piece) => {
    if (!isRecord(piece)) {
      return false;
    }

    const x = piece.x;
    const y = piece.y;

    return (
      typeof piece.id === "string" &&
      piece.kind === "marker" &&
      piece.side === "neutral" &&
      typeof x === "number" &&
      typeof y === "number" &&
      Number.isInteger(x) &&
      Number.isInteger(y) &&
      x >= 0 &&
      y >= 0 &&
      x < width &&
      y < height
    );
  });
}

function parseScenarioSpace(value: unknown): ScenarioSpace | null | false {
  if (value === null) {
    return null;
  }

  if (!isRecord(value)) {
    return false;
  }

  if (
    value.type !== "square-grid" ||
    !isPositiveInteger(value.width) ||
    !isPositiveInteger(value.height)
  ) {
    return false;
  }

  return {
    type: value.type,
    width: value.width,
    height: value.height
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}
