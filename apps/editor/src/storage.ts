import { convertFileSrc, isTauri } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import {
  copyFile,
  exists,
  mkdir,
  readFile,
  readTextFile,
  writeTextFile
} from "@tauri-apps/plugin-fs";
import {
  consumeDesktopAutomationExportPath,
  consumeDesktopAutomationImportPath,
  consumeDesktopAutomationOpenPath,
  consumeDesktopAutomationSavePath
} from "./desktop-automation";
import browserRuntimeStyles from "./runtime-export/browser-runtime.css?raw";
import browserRuntimeScript from "./runtime-export/browser-runtime.js?raw";
import {
  type Scenario,
  type ScenarioAsset,
  type ScenarioAssetKind,
  prepareScenarioForSave,
  scenarioStorageKey,
  scenarioToJson
} from "./scenario";
import { loadScenarioWithMeta } from "./scenario-migrations";

export type ScenarioStorageResult = {
  scenario?: Scenario;
  dirty?: boolean;
  migrated?: boolean;
  statusMessage: string;
};

export type ScenarioAssetImportResult = {
  asset?: ScenarioAsset;
  statusMessage: string;
};

const scenarioFileFilters = [
  {
    name: "Fieldcraft Scenario",
    extensions: ["json"]
  }
];
const scenarioAssetDirectoryName = "assets";
const imageAssetFileFilters = [
  {
    name: "Image Files",
    extensions: ["png", "jpg", "jpeg", "webp"]
  }
];
const audioAssetFileFilters = [
  {
    name: "Audio Files",
    extensions: ["wav"]
  }
];
const browserRuntimeExportFileFilters = [
  {
    name: "HTML Files",
    extensions: ["html"]
  }
];

let currentFilePath: string | null = null;

export function getStorageModeLabel(): string {
  return isTauri() ? "Desktop file" : "Browser fallback";
}

export function getCurrentFilePath(): string | null {
  return currentFilePath;
}

export function setCurrentFilePath(filePath: string | null): void {
  currentFilePath = filePath;
}

export function clearCurrentFilePath(): void {
  setCurrentFilePath(null);
}

export function getFileLabel(): string {
  if (currentFilePath) {
    return getFileName(currentFilePath);
  }

  return "Unsaved";
}

export function getSaveAsLabel(): string {
  return isTauri() ? "Save As" : "Download JSON";
}

export function canImportScenarioAssets(): boolean {
  return isTauri();
}

export function rememberScenario(scenario: Scenario): void {
  window.localStorage.setItem(scenarioStorageKey, scenarioToJson(scenario));
}

export async function openScenarioFile(
  fileInput: HTMLInputElement
): Promise<ScenarioStorageResult | null> {
  if (!isTauri()) {
    fileInput.click();
    return null;
  }

  const automationSelection = await consumeDesktopAutomationOpenPath();
  const selectedPath = automationSelection.handled
    ? automationSelection.value
    : normalizeDialogPath(
        await open({
          title: "Open Fieldcraft Scenario",
          multiple: false,
          directory: false,
          filters: scenarioFileFilters
        })
      );

  if (!selectedPath) {
    return {
      statusMessage: "Open cancelled"
    };
  }

  const contents = await readTextFile(selectedPath);
  const { scenario, migrated } = loadScenarioWithMeta(contents);
  currentFilePath = selectedPath;
  rememberScenario(scenario);

  return {
    scenario,
    dirty: migrated,
    migrated,
    statusMessage: `Opened ${getFileName(selectedPath)}`
  };
}

export async function openBrowserScenarioFile(file: File): Promise<ScenarioStorageResult> {
  const { scenario, migrated } = loadScenarioWithMeta(await file.text());
  currentFilePath = null;

  return {
    scenario,
    dirty: migrated,
    migrated,
    statusMessage: `Loaded ${file.name}`
  };
}

export async function saveScenarioFile(scenario: Scenario): Promise<ScenarioStorageResult> {
  if (isTauri()) {
    if (!currentFilePath) {
      return saveScenarioFileAs(scenario);
    }

    return writeScenarioFile(currentFilePath, scenario);
  }

  const savedScenario = prepareScenarioForSave(scenario);
  rememberScenario(savedScenario);

  return {
    scenario: savedScenario,
    dirty: false,
    statusMessage: "Scenario saved"
  };
}

export async function saveScenarioFileAs(scenario: Scenario): Promise<ScenarioStorageResult> {
  if (isTauri()) {
    const automationSelection = await consumeDesktopAutomationSavePath();
    const selected = automationSelection.handled
      ? automationSelection.value
      : await save({
          title: "Save Fieldcraft Scenario",
          defaultPath: currentFilePath ?? getDefaultScenarioFileName(scenario),
          filters: scenarioFileFilters
        });

    if (!selected) {
      return {
        statusMessage: "Save cancelled"
      };
    }

    return writeScenarioFile(selected, scenario);
  }

  return downloadScenario(scenario);
}

export async function exportScenarioBrowserRuntime(
  scenario: Scenario
): Promise<ScenarioStorageResult> {
  const html = await createBrowserRuntimeExportHtml(scenario);

  if (isTauri()) {
    const automationSelection = await consumeDesktopAutomationExportPath();
    const selected = automationSelection.handled
      ? automationSelection.value
      : await save({
          title: "Export Fieldcraft Browser Runtime",
          defaultPath: createDefaultRuntimeExportFileName(scenario),
          filters: browserRuntimeExportFileFilters
        });

    if (!selected) {
      return {
        statusMessage: "Runtime export cancelled"
      };
    }

    await writeTextFile(selected, html);

    return {
      statusMessage: `Exported runtime ${getFileName(selected)}`
    };
  }

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = createDefaultRuntimeExportFileName(scenario);
  link.click();
  URL.revokeObjectURL(url);

  return {
    statusMessage: "Runtime exported"
  };
}

async function writeScenarioFile(
  filePath: string,
  scenario: Scenario
): Promise<ScenarioStorageResult> {
  const savedScenario = prepareScenarioForSave(scenario);
  await copyScenarioAssetFilesForSave(savedScenario, currentFilePath, filePath);
  await writeTextFile(filePath, scenarioToJson(savedScenario));
  currentFilePath = filePath;
  rememberScenario(savedScenario);

  return {
    scenario: savedScenario,
    dirty: false,
    statusMessage: `Saved ${getFileName(filePath)}`
  };
}

function downloadScenario(scenario: Scenario): ScenarioStorageResult {
  const savedScenario = prepareScenarioForSave(scenario);
  rememberScenario(savedScenario);

  const blob = new Blob([scenarioToJson(savedScenario)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "fieldcraft-scenario.json";
  link.click();
  URL.revokeObjectURL(url);

  return {
    scenario: savedScenario,
    dirty: false,
    statusMessage: "Scenario downloaded"
  };
}

async function createBrowserRuntimeExportHtml(scenario: Scenario): Promise<string> {
  const exportedScenario = cloneScenarioForRuntimeExport(scenario);
  const bundledAssets = await bundleScenarioAssetsForRuntimeExport(exportedScenario);
  const bundle = {
    version: 1,
    generatedAt: new Date().toISOString(),
    scenario: exportedScenario,
    assets: bundledAssets
  };

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(exportedScenario.title)} | Fieldcraft Viewer</title>
    <style>${sanitizeInlineStyle(browserRuntimeStyles)}</style>
  </head>
  <body>
    <div id="app"></div>
    <script id="fieldcraft-runtime-export-bundle" type="application/json">${serializeJsonForInlineScript(
      bundle
    )}</script>
    <script type="module">${sanitizeInlineScript(browserRuntimeScript)}</script>
  </body>
</html>
`;
}

async function bundleScenarioAssetsForRuntimeExport(
  scenario: Scenario
): Promise<
  Record<
    string,
    {
      kind: ScenarioAssetKind;
      mimeType: string;
      dataUrl: string;
    }
  >
> {
  const bundledAssets: Record<
    string,
    {
      kind: ScenarioAssetKind;
      mimeType: string;
      dataUrl: string;
    }
  > = {};

  for (const asset of scenario.assets) {
    const bytes = await readScenarioAssetBytesForRuntimeExport(asset);
    const mimeType = getScenarioAssetMimeType(asset);
    bundledAssets[asset.path] = {
      kind: asset.kind,
      mimeType,
      dataUrl: createDataUrl(mimeType, bytes)
    };
  }

  return bundledAssets;
}

async function readScenarioAssetBytesForRuntimeExport(asset: ScenarioAsset): Promise<Uint8Array> {
  if (currentFilePath) {
    const scenarioDirectoryPath = getParentDirectoryPath(currentFilePath);
    if (!scenarioDirectoryPath) {
      throw new Error("Could not resolve the scenario package directory for runtime export.");
    }

    try {
      return new Uint8Array(
        await readFile(resolveScenarioAssetFilePath(scenarioDirectoryPath, asset.path))
      );
    } catch (error) {
      throw new Error(
        `Could not bundle scenario asset ${asset.path}: ${getRuntimeExportAssetErrorMessage(error)}`
      );
    }
  }

  const assetUrl = new URL(asset.path, window.location.href).toString();
  const response = await fetch(assetUrl);
  if (!response.ok) {
    throw new Error(
      `Could not bundle scenario asset ${asset.path}: ${response.status} ${response.statusText}`
    );
  }

  return new Uint8Array(await response.arrayBuffer());
}

function cloneScenarioForRuntimeExport(scenario: Scenario): Scenario {
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
        .map((piece) => ({
          ...piece,
          style: { ...piece.style },
          properties: piece.properties.map((property) => ({ ...property }))
        }))
        .sort((left, right) => left.y - right.y || left.x - right.x || left.id.localeCompare(right.id))
    : [];
  const sides = scenario.sides
    .map((side) => ({ ...side }))
    .sort((left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id));

  return {
    ...scenario,
    assets,
    sides,
    pieces,
    metadata: {
      ...scenario.metadata
    }
  };
}

function createDefaultRuntimeExportFileName(scenario: Scenario): string {
  const slug = scenario.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${slug || "fieldcraft-runtime"}.fieldcraft.runtime.html`;
}

function getScenarioAssetMimeType(asset: ScenarioAsset): string {
  const extension = getImportedAssetExtension(asset.path);

  switch (extension) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".wav":
      return "audio/wav";
    default:
      return asset.kind === "image" ? "image/png" : "application/octet-stream";
  }
}

function createDataUrl(mimeType: string, bytes: Uint8Array): string {
  return `data:${mimeType};base64,${encodeBase64(bytes)}`;
}

function encodeBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return window.btoa(binary);
}

function serializeJsonForInlineScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function sanitizeInlineScript(value: string): string {
  return value
    .replace(/<\/script/gi, "<\\/script")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function sanitizeInlineStyle(value: string): string {
  return value.replace(/<\/style/gi, "<\\/style");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getRuntimeExportAssetErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "asset could not be read";
}

export async function importScenarioAssetFile(
  scenario: Scenario,
  kind: ScenarioAssetKind
): Promise<ScenarioAssetImportResult> {
  if (!isTauri()) {
    throw new Error("Package asset imports are only available in the desktop editor.");
  }

  if (!currentFilePath) {
    throw new Error("Save the scenario to a desktop file before importing package assets.");
  }

  const automationSelection = await consumeDesktopAutomationImportPath(kind);
  const selectedPath = automationSelection.handled
    ? automationSelection.value
    : normalizeDialogPath(
        await open({
          title: kind === "image" ? "Import Image Asset" : "Import Audio Asset",
          multiple: false,
          directory: false,
          filters: kind === "image" ? imageAssetFileFilters : audioAssetFileFilters
        })
      );

  if (!selectedPath) {
    return {
      statusMessage:
        kind === "image" ? "Image import cancelled" : "Audio import cancelled"
    };
  }

  const scenarioDirectoryPath = getParentDirectoryPath(currentFilePath);
  if (!scenarioDirectoryPath) {
    throw new Error("Could not resolve the scenario package directory.");
  }

  const assetDirectoryPath = joinFilePath(scenarioDirectoryPath, scenarioAssetDirectoryName);
  await mkdir(assetDirectoryPath, { recursive: true });

  const sourceFileName = getFileName(selectedPath);
  const destinationFileName = await createUniqueImportedAssetFileName(
    assetDirectoryPath,
    sourceFileName
  );
  const destinationFilePath = joinFilePath(assetDirectoryPath, destinationFileName);
  await copyFile(selectedPath, destinationFilePath);

  const assetId = createImportedAssetId(sourceFileName, scenario.assets);
  const asset: ScenarioAsset = {
    id: assetId,
    kind,
    path: `${scenarioAssetDirectoryName}/${destinationFileName}`
  };

  return {
    asset,
    statusMessage: `Imported ${kind} asset ${assetId}`
  };
}

export function resolveScenarioAssetUrl(asset: ScenarioAsset): string | null {
  if (isTauri() && currentFilePath) {
    const scenarioDirectoryPath = getParentDirectoryPath(currentFilePath);
    if (!scenarioDirectoryPath) {
      return null;
    }

    return convertFileSrc(resolveScenarioAssetFilePath(scenarioDirectoryPath, asset.path));
  }

  try {
    return new URL(asset.path, window.location.href).toString();
  } catch {
    return null;
  }
}

function getFileName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || filePath;
}

function normalizeDialogPath(value: string | string[] | null): string | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function getParentDirectoryPath(filePath: string): string | null {
  const separatorIndex = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  return separatorIndex >= 0 ? filePath.slice(0, separatorIndex) : null;
}

function getDefaultScenarioFileName(scenario: Scenario): string {
  const slug = scenario.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${slug || "fieldcraft-scenario"}.fieldcraft.json`;
}

function joinFilePath(basePath: string, ...segments: string[]): string {
  const separator = basePath.includes("\\") ? "\\" : "/";
  const normalizedBasePath = basePath.replace(/[\\/]+$/g, "");
  const normalizedSegments = segments
    .flatMap((segment) => segment.split("/"))
    .filter((segment) => segment.length > 0);

  if (normalizedSegments.length === 0) {
    return normalizedBasePath;
  }

  return `${normalizedBasePath}${separator}${normalizedSegments.join(separator)}`;
}

function resolveScenarioAssetFilePath(
  scenarioDirectoryPath: string,
  assetRelativePath: string
): string {
  return joinFilePath(scenarioDirectoryPath, assetRelativePath);
}

function getImportedAssetExtension(fileName: string): string {
  const extensionMatch = /\.([A-Za-z0-9]+)$/.exec(fileName);
  return extensionMatch ? `.${extensionMatch[1].toLowerCase()}` : "";
}

function getImportedAssetStem(fileName: string): string {
  const extension = getImportedAssetExtension(fileName);
  const baseName = extension ? fileName.slice(0, -extension.length) : fileName;
  return baseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createImportedAssetId(
  sourceFileName: string,
  existingAssets: Scenario["assets"]
): string {
  const baseId = getImportedAssetStem(sourceFileName) || "asset";

  if (!existingAssets.some((asset) => asset.id === baseId)) {
    return baseId;
  }

  let suffix = 2;
  while (existingAssets.some((asset) => asset.id === `${baseId}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseId}-${suffix}`;
}

async function createUniqueImportedAssetFileName(
  assetDirectoryPath: string,
  sourceFileName: string
): Promise<string> {
  const extension = getImportedAssetExtension(sourceFileName);
  const stem = getImportedAssetStem(sourceFileName) || "asset";
  let candidate = `${stem}${extension}`;
  let suffix = 2;

  while (await exists(joinFilePath(assetDirectoryPath, candidate))) {
    candidate = `${stem}-${suffix}${extension}`;
    suffix += 1;
  }

  return candidate;
}

async function copyScenarioAssetFilesForSave(
  scenario: Scenario,
  fromFilePath: string | null,
  toFilePath: string
): Promise<void> {
  if (!isTauri() || scenario.assets.length === 0 || !fromFilePath || fromFilePath === toFilePath) {
    return;
  }

  const fromDirectoryPath = getParentDirectoryPath(fromFilePath);
  const toDirectoryPath = getParentDirectoryPath(toFilePath);
  if (!fromDirectoryPath || !toDirectoryPath || fromDirectoryPath === toDirectoryPath) {
    return;
  }

  for (const asset of scenario.assets) {
    const sourceAssetPath = resolveScenarioAssetFilePath(fromDirectoryPath, asset.path);
    const destinationAssetPath = resolveScenarioAssetFilePath(toDirectoryPath, asset.path);
    const destinationAssetDirectory = getParentDirectoryPath(destinationAssetPath);

    if (destinationAssetDirectory) {
      await mkdir(destinationAssetDirectory, { recursive: true });
    }

    await copyFile(sourceAssetPath, destinationAssetPath);
  }
}
