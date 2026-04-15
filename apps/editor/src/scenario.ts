export const scenarioSchema = "fieldcraft.scenario.v0";

export const maxTileGridSize = 64;
export const defaultSquareTileSize = 48;
export const defaultHexTileSize = 28;
export const defaultScaleDistancePerTile = 1;
export const defaultScaleUnit = "tile";
export const defaultGridLineColor = "#aeb8c1";
export const defaultGridLineOpacity = 1;
export const defaultBoardBackgroundColor = "#f9fbfb";

export type ScenarioPiece = {
  id: string;
  kind: "marker";
  side: "neutral";
  x: number;
  y: number;
};

export type ScenarioTileSpaceType = "square-grid" | "hex-grid";
export type ScenarioSpaceType = ScenarioTileSpaceType | "free-coordinate";

export type ScenarioTileScale = {
  distancePerTile: number;
  unit: string;
};

export type ScenarioFreeCoordinateScale = {
  distancePerWorldUnit: number;
  unit: string;
};

export type ScenarioGridStyle = {
  lineColor: string;
  lineOpacity: number;
};

export type ScenarioBoardBackground = {
  color: string;
};

export type ScenarioTileSpace = {
  type: ScenarioTileSpaceType;
  width: number;
  height: number;
  tileSize: number;
  scale: ScenarioTileScale;
  grid: ScenarioGridStyle;
  background: ScenarioBoardBackground;
};

export type ScenarioFreeCoordinateBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ScenarioFreeCoordinateSpace = {
  type: "free-coordinate";
  bounds: ScenarioFreeCoordinateBounds;
  scale: ScenarioFreeCoordinateScale;
  background: ScenarioBoardBackground;
};

export type ScenarioSpace = ScenarioTileSpace | ScenarioFreeCoordinateSpace;

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

export type CreateTileScenarioSpaceOptions = {
  type: ScenarioTileSpaceType;
  width: number;
  height: number;
  tileSize?: number;
  distancePerTile?: number;
  scaleUnit?: string;
  gridLineColor?: string;
  gridLineOpacity?: number;
  backgroundColor?: string;
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

export function createTileScenarioSpace(
  options: CreateTileScenarioSpaceOptions
): ScenarioTileSpace {
  return {
    type: options.type,
    width: options.width,
    height: options.height,
    tileSize: options.tileSize ?? getDefaultTileSize(options.type),
    scale: {
      distancePerTile: options.distancePerTile ?? defaultScaleDistancePerTile,
      unit: normalizeScaleUnit(options.scaleUnit ?? defaultScaleUnit)
    },
    grid: {
      lineColor: options.gridLineColor ?? defaultGridLineColor,
      lineOpacity: options.gridLineOpacity ?? defaultGridLineOpacity
    },
    background: {
      color: options.backgroundColor ?? defaultBoardBackgroundColor
    }
  };
}

export function getDefaultTileSize(type: ScenarioTileSpaceType): number {
  return type === "hex-grid" ? defaultHexTileSize : defaultSquareTileSize;
}

export function isTileScenarioSpace(
  space: ScenarioSpace | null
): space is ScenarioTileSpace {
  return space?.type === "square-grid" || space?.type === "hex-grid";
}

export function prepareScenarioForSave(scenario: Scenario): Scenario {
  const pieces = isTileScenarioSpace(scenario.space)
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
  const scenario = parseScenarioValue(parsed);

  if (!scenario) {
    throw new Error("File is not a Fieldcraft scenario.");
  }

  return scenario;
}

export function scenarioToJson(scenario: Scenario): string {
  return `${JSON.stringify(scenario, null, 2)}\n`;
}

function parseScenarioValue(value: unknown): Scenario | null {
  if (!isRecord(value)) {
    return null;
  }

  if (value.schema !== scenarioSchema || typeof value.title !== "string") {
    return null;
  }

  if (!Array.isArray(value.pieces) || !isRecord(value.metadata)) {
    return null;
  }

  const space = parseScenarioSpace(value.space);
  if (space === false) {
    return null;
  }

  const pieces = parseScenarioPieces(value.pieces, space);
  if (!pieces) {
    return null;
  }

  return {
    schema: scenarioSchema,
    title: value.title,
    space,
    pieces,
    metadata: {
      editorVersion:
        typeof value.metadata.editorVersion === "string"
          ? value.metadata.editorVersion
          : "unknown",
      savedAt:
        typeof value.metadata.savedAt === "string" || value.metadata.savedAt === null
          ? value.metadata.savedAt
          : null
    }
  };
}

function parseScenarioPieces(
  pieces: unknown[],
  space: ScenarioSpace | null
): ScenarioPiece[] | null {
  if (!isTileScenarioSpace(space)) {
    return pieces.length === 0 ? [] : null;
  }

  const parsedPieces: ScenarioPiece[] = [];

  for (const piece of pieces) {
    if (!isRecord(piece)) {
      return null;
    }

    const x = piece.x;
    const y = piece.y;

    if (
      typeof piece.id !== "string" ||
      piece.kind !== "marker" ||
      piece.side !== "neutral" ||
      typeof x !== "number" ||
      typeof y !== "number" ||
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      x < 0 ||
      y < 0 ||
      x >= space.width ||
      y >= space.height
    ) {
      return null;
    }

    parsedPieces.push({
      id: piece.id,
      kind: "marker",
      side: "neutral",
      x,
      y
    });
  }

  return parsedPieces;
}

function parseScenarioSpace(value: unknown): ScenarioSpace | null | false {
  if (value === null) {
    return null;
  }

  if (!isRecord(value)) {
    return false;
  }

  if (isScenarioTileSpaceType(value.type)) {
    return parseTileScenarioSpace(value, value.type);
  }

  if (value.type === "free-coordinate") {
    return parseFreeCoordinateSpace(value);
  }

  return false;
}

function parseTileScenarioSpace(
  value: Record<string, unknown>,
  type: ScenarioTileSpaceType
): ScenarioTileSpace | false {
  if (!isPositiveInteger(value.width) || !isPositiveInteger(value.height)) {
    return false;
  }

  const tileSize = parsePositiveNumber(value.tileSize, getDefaultTileSize(type));
  const scale = parseTileScale(value.scale);
  const grid = parseGridStyle(value.grid);
  const background = parseBackground(value.background);

  if (!tileSize || !scale || !grid || !background) {
    return false;
  }

  return {
    type,
    width: value.width,
    height: value.height,
    tileSize,
    scale,
    grid,
    background
  };
}

function parseFreeCoordinateSpace(
  value: Record<string, unknown>
): ScenarioFreeCoordinateSpace | false {
  const bounds = parseFreeCoordinateBounds(value.bounds);
  const scale = parseFreeCoordinateScale(value.scale);
  const background = parseBackground(value.background);

  if (!bounds || !scale || !background) {
    return false;
  }

  return {
    type: "free-coordinate",
    bounds,
    scale,
    background
  };
}

function parseTileScale(value: unknown): ScenarioTileScale | null {
  if (value === undefined) {
    return {
      distancePerTile: defaultScaleDistancePerTile,
      unit: defaultScaleUnit
    };
  }

  if (!isRecord(value)) {
    return null;
  }

  const distancePerTile = parsePositiveNumber(
    value.distancePerTile,
    defaultScaleDistancePerTile
  );
  if (!distancePerTile || !isScaleUnit(value.unit)) {
    return null;
  }

  return {
    distancePerTile,
    unit: normalizeScaleUnit(value.unit)
  };
}

function parseFreeCoordinateScale(value: unknown): ScenarioFreeCoordinateScale | null {
  if (!isRecord(value)) {
    return null;
  }

  const distancePerWorldUnit = parsePositiveNumber(value.distancePerWorldUnit);
  if (!distancePerWorldUnit || !isScaleUnit(value.unit)) {
    return null;
  }

  return {
    distancePerWorldUnit,
    unit: normalizeScaleUnit(value.unit)
  };
}

function parseGridStyle(value: unknown): ScenarioGridStyle | null {
  if (value === undefined) {
    return {
      lineColor: defaultGridLineColor,
      lineOpacity: defaultGridLineOpacity
    };
  }

  if (!isRecord(value)) {
    return null;
  }

  const lineColor = parseColor(value.lineColor, defaultGridLineColor);
  const lineOpacity = parseOpacity(value.lineOpacity, defaultGridLineOpacity);

  if (!lineColor || lineOpacity === null) {
    return null;
  }

  return {
    lineColor,
    lineOpacity
  };
}

function parseBackground(value: unknown): ScenarioBoardBackground | null {
  if (value === undefined) {
    return {
      color: defaultBoardBackgroundColor
    };
  }

  if (!isRecord(value)) {
    return null;
  }

  const color = parseColor(value.color, defaultBoardBackgroundColor);
  if (!color) {
    return null;
  }

  return { color };
}

function parseFreeCoordinateBounds(value: unknown): ScenarioFreeCoordinateBounds | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    !isFiniteNumber(value.x) ||
    !isFiniteNumber(value.y) ||
    !isPositiveNumber(value.width) ||
    !isPositiveNumber(value.height)
  ) {
    return null;
  }

  return {
    x: value.x,
    y: value.y,
    width: value.width,
    height: value.height
  };
}

function isScenarioTileSpaceType(value: unknown): value is ScenarioTileSpaceType {
  return value === "square-grid" || value === "hex-grid";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPositiveNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

function parsePositiveNumber(value: unknown, fallback?: number): number | null {
  if (value === undefined && fallback !== undefined) {
    return fallback;
  }

  return isPositiveNumber(value) ? value : null;
}

function parseOpacity(value: unknown, fallback: number): number | null {
  if (value === undefined) {
    return fallback;
  }

  return isFiniteNumber(value) && value >= 0 && value <= 1 ? value : null;
}

function parseColor(value: unknown, fallback: string): string | null {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value)) {
    return null;
  }

  return value.toLowerCase();
}

function isScaleUnit(value: unknown): value is string {
  return typeof value === "string" && normalizeScaleUnit(value).length > 0;
}

function normalizeScaleUnit(value: string): string {
  return value.trim().slice(0, 32);
}
