import {
  type FreeCoordinateBounds,
  isPointInFreeCoordinateBounds
} from "./spatial";

export const schemaIdentifier = "fieldcraft.scenario";
export const currentSchemaVersion = 2;

export const maxTileGridSize = 64;
export const maxFreeCoordinateBoardSize = 100000;
export const minTileSize = 8;
export const maxTileSize = 160;
export const defaultSquareTileSize = 48;
export const defaultHexTileSize = 28;
export const defaultScaleDistancePerTile = 1;
export const defaultScaleUnit = "tile";
export const defaultFreeCoordinateDistancePerWorldUnit = 1;
export const defaultFreeCoordinateScaleUnit = "unit";
export const defaultGridLineColor = "#aeb8c1";
export const defaultGridLineOpacity = 1;
export const defaultBoardBackgroundColor = "#f9fbfb";

export type ScenarioAssetKind = "image" | "audio";

export type ScenarioAsset = {
  id: string;
  kind: ScenarioAssetKind;
  path: string;
};

export type ScenarioPiece = {
  id: string;
  label: string;
  kind: "marker";
  side: "neutral";
  x: number;
  y: number;
  imageAssetId?: string;
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
  imageAssetId?: string;
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
  schema: typeof schemaIdentifier;
  schemaVersion: typeof currentSchemaVersion;
  title: string;
  space: ScenarioSpace | null;
  assets: ScenarioAsset[];
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

export type CreateFreeCoordinateScenarioSpaceOptions = {
  x?: number;
  y?: number;
  width: number;
  height: number;
  distancePerWorldUnit?: number;
  scaleUnit?: string;
  backgroundColor?: string;
};

export const scenarioStorageKey = "fieldcraft:last-scenario";

export function createEmptyScenario(): Scenario {
  return {
    schema: schemaIdentifier,
    schemaVersion: currentSchemaVersion,
    title: "Untitled Fieldcraft Scenario",
    space: null,
    assets: [],
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

export function createFreeCoordinateScenarioSpace(
  options: CreateFreeCoordinateScenarioSpaceOptions
): ScenarioFreeCoordinateSpace {
  return {
    type: "free-coordinate",
    bounds: {
      x: options.x ?? 0,
      y: options.y ?? 0,
      width: options.width,
      height: options.height
    },
    scale: {
      distancePerWorldUnit:
        options.distancePerWorldUnit ?? defaultFreeCoordinateDistancePerWorldUnit,
      unit: normalizeScaleUnit(options.scaleUnit ?? defaultFreeCoordinateScaleUnit)
    },
    background: {
      color: options.backgroundColor ?? defaultBoardBackgroundColor
    }
  };
}

export function getDefaultTileSize(type: ScenarioTileSpaceType): number {
  return type === "hex-grid" ? defaultHexTileSize : defaultSquareTileSize;
}

export function parseSupportedTileGridSize(value: unknown): number | null {
  return isPositiveInteger(value) && value <= maxTileGridSize ? value : null;
}

export function parseSupportedTileSize(
  value: unknown,
  fallback?: number
): number | null {
  if (value === undefined && fallback !== undefined) {
    return parseSupportedTileSize(fallback);
  }

  return isPositiveNumber(value) && value >= minTileSize && value <= maxTileSize
    ? value
    : null;
}

export function parseSupportedFreeCoordinateBoardSize(
  value: unknown
): number | null {
  return isPositiveNumber(value) && value <= maxFreeCoordinateBoardSize ? value : null;
}

export function isTileScenarioSpace(
  space: ScenarioSpace | null
): space is ScenarioTileSpace {
  return space?.type === "square-grid" || space?.type === "hex-grid";
}

export function isFreeCoordinateScenarioSpace(
  space: ScenarioSpace | null
): space is ScenarioFreeCoordinateSpace {
  return space?.type === "free-coordinate";
}

export function prepareScenarioForSave(scenario: Scenario): Scenario {
  const assets = scenario.assets
    .map((asset) => ({ ...asset }))
    .sort(
      (left, right) =>
        left.kind.localeCompare(right.kind) ||
        left.id.localeCompare(right.id) ||
        left.path.localeCompare(right.path)
    );
  const pieces = scenario.space
    ? scenario.pieces
        .map((piece) => ({ ...piece }))
        .sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id))
    : [];

  return {
    ...scenario,
    assets,
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

  validateUniqueAssetIds(scenario);
  validateUniquePieceIds(scenario);
  validateScenarioAssetReferences(scenario);

  return scenario;
}

export function scenarioToJson(scenario: Scenario): string {
  return `${JSON.stringify(scenario, null, 2)}\n`;
}

function parseScenarioValue(value: unknown): Scenario | null {
  if (!isRecord(value)) {
    return null;
  }

  if (value.schema !== schemaIdentifier || value.schemaVersion !== currentSchemaVersion) {
    return null;
  }

  if (typeof value.title !== "string") {
    return null;
  }

  if (!Array.isArray(value.pieces) || !isRecord(value.metadata)) {
    return null;
  }

  const assets = parseScenarioAssets(value.assets);
  if (!assets) {
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
    schema: schemaIdentifier,
    schemaVersion: currentSchemaVersion,
    title: value.title,
    space,
    assets,
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

function validateUniqueAssetIds(scenario: Scenario): void {
  const seenIds = new Set<string>();

  for (const asset of scenario.assets) {
    if (seenIds.has(asset.id)) {
      throw new Error(`Scenario contains duplicate asset ID: ${asset.id}`);
    }

    seenIds.add(asset.id);
  }
}

function validateUniquePieceIds(scenario: Scenario): void {
  const seenIds = new Set<string>();

  for (const piece of scenario.pieces) {
    if (seenIds.has(piece.id)) {
      throw new Error(`Scenario contains duplicate marker ID: ${piece.id}`);
    }

    seenIds.add(piece.id);
  }
}

function validateScenarioAssetReferences(scenario: Scenario): void {
  const backgroundImageAssetId = scenario.space?.background.imageAssetId;
  if (backgroundImageAssetId) {
    const backgroundImageAsset = scenario.assets.find(
      (asset) => asset.id === backgroundImageAssetId
    );

    if (!backgroundImageAsset) {
      throw new Error(
        `Scenario background references missing image asset ID: ${backgroundImageAssetId}`
      );
    }

    if (backgroundImageAsset.kind !== "image") {
      throw new Error(
        `Scenario background asset must be an image: ${backgroundImageAssetId}`
      );
    }
  }

  for (const piece of scenario.pieces) {
    if (!piece.imageAssetId) {
      continue;
    }

    const imageAsset = scenario.assets.find((asset) => asset.id === piece.imageAssetId);
    if (!imageAsset) {
      throw new Error(
        `Marker ${piece.id} references missing image asset ID: ${piece.imageAssetId}`
      );
    }

    if (imageAsset.kind !== "image") {
      throw new Error(
        `Marker ${piece.id} image asset must be an image: ${piece.imageAssetId}`
      );
    }
  }
}

function parseScenarioAssets(value: unknown): ScenarioAsset[] | null {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const assets: ScenarioAsset[] = [];

  for (const asset of value) {
    if (!isRecord(asset) || !isScenarioAssetKind(asset.kind)) {
      return null;
    }

    const id = parseScenarioAssetId(asset.id);
    const path = parseScenarioAssetPath(asset.path);

    if (!id || !path) {
      return null;
    }

    assets.push({
      id,
      kind: asset.kind,
      path
    });
  }

  return assets;
}

function parseScenarioPieces(
  pieces: unknown[],
  space: ScenarioSpace | null
): ScenarioPiece[] | null {
  if (!space) {
    return pieces.length === 0 ? [] : null;
  }

  const parsedPieces: ScenarioPiece[] = [];

  for (const piece of pieces) {
    if (!isRecord(piece)) {
      return null;
    }

    if (
      typeof piece.id !== "string" ||
      piece.id.length === 0 ||
      typeof piece.label !== "string" ||
      piece.kind !== "marker" ||
      piece.side !== "neutral"
    ) {
      return null;
    }

    const x = piece.x;
    const y = piece.y;
    const imageAssetId =
      piece.imageAssetId === undefined ? undefined : parseScenarioAssetId(piece.imageAssetId);

    if (piece.imageAssetId !== undefined && !imageAssetId) {
      return null;
    }

    if (isTileScenarioSpace(space)) {
      if (
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
    } else if (
      typeof x !== "number" ||
      typeof y !== "number" ||
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !isPointInFreeCoordinateBounds({ x, y }, space.bounds)
    ) {
      return null;
    }

    parsedPieces.push({
      id: piece.id,
      label: piece.label,
      kind: "marker",
      side: "neutral",
      x,
      y,
      ...(imageAssetId ? { imageAssetId } : {})
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
  const width = parseSupportedTileGridSize(value.width);
  const height = parseSupportedTileGridSize(value.height);

  if (!width || !height) {
    return false;
  }

  const tileSize = parseSupportedTileSize(value.tileSize, getDefaultTileSize(type));
  const scale = parseTileScale(value.scale);
  const grid = parseGridStyle(value.grid);
  const background = parseBackground(value.background);

  if (!tileSize || !scale || !grid || !background) {
    return false;
  }

  return {
    type,
    width,
    height,
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
  const imageAssetId =
    value.imageAssetId === undefined ? undefined : parseScenarioAssetId(value.imageAssetId);

  if (!color || (value.imageAssetId !== undefined && !imageAssetId)) {
    return null;
  }

  return imageAssetId ? { color, imageAssetId } : { color };
}

function parseFreeCoordinateBounds(value: unknown): ScenarioFreeCoordinateBounds | null {
  if (!isRecord(value)) {
    return null;
  }

  const width = parseSupportedFreeCoordinateBoardSize(value.width);
  const height = parseSupportedFreeCoordinateBoardSize(value.height);

  if (
    !isFiniteNumber(value.x) ||
    !isFiniteNumber(value.y) ||
    !width ||
    !height
  ) {
    return null;
  }

  return {
    x: value.x,
    y: value.y,
    width,
    height
  } satisfies FreeCoordinateBounds;
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

function parseScenarioAssetId(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function parseScenarioAssetPath(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
    return null;
  }

  if (
    value.startsWith("/") ||
    value.startsWith("\\") ||
    value.startsWith("./") ||
    value.startsWith("../") ||
    value.includes("\\") ||
    value.includes(":")
  ) {
    return null;
  }

  const segments = value.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    return null;
  }

  return value;
}

function isScaleUnit(value: unknown): value is string {
  return typeof value === "string" && normalizeScaleUnit(value).length > 0;
}

function isScenarioAssetKind(value: unknown): value is ScenarioAssetKind {
  return value === "image" || value === "audio";
}

function normalizeScaleUnit(value: string): string {
  return value.trim().slice(0, 32);
}

export function getScenarioAssetById(
  scenario: Scenario,
  assetId: string | null | undefined
): ScenarioAsset | null {
  if (!assetId) {
    return null;
  }

  return scenario.assets.find((asset) => asset.id === assetId) ?? null;
}

export function getScenarioBackgroundImageAsset(scenario: Scenario): ScenarioAsset | null {
  return getScenarioAssetById(scenario, scenario.space?.background.imageAssetId);
}

export function getScenarioPieceImageAsset(
  scenario: Scenario,
  piece: ScenarioPiece
): ScenarioAsset | null {
  return getScenarioAssetById(scenario, piece.imageAssetId);
}
