import { convertFileSrc, isTauri } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import {
  copyFile,
  exists,
  mkdir,
  readTextFile,
  writeTextFile
} from "@tauri-apps/plugin-fs";
import {
  type Scenario,
  type ScenarioAsset,
  type ScenarioAssetKind,
  parseScenario,
  prepareScenarioForSave,
  scenarioStorageKey,
  scenarioToJson
} from "./scenario";

export type ScenarioStorageResult = {
  scenario?: Scenario;
  dirty?: boolean;
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

  const selected = await open({
    title: "Open Fieldcraft Scenario",
    multiple: false,
    directory: false,
    filters: scenarioFileFilters
  });
  const selectedPath = Array.isArray(selected) ? selected[0] : selected;

  if (!selectedPath) {
    return {
      statusMessage: "Open cancelled"
    };
  }

  const contents = await readTextFile(selectedPath);
  const scenario = parseScenario(contents);
  currentFilePath = selectedPath;
  rememberScenario(scenario);

  return {
    scenario,
    dirty: false,
    statusMessage: `Opened ${getFileName(selectedPath)}`
  };
}

export async function openBrowserScenarioFile(file: File): Promise<ScenarioStorageResult> {
  const scenario = parseScenario(await file.text());
  currentFilePath = null;

  return {
    scenario,
    dirty: false,
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
    const selected = await save({
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

  const selected = await open({
    title: kind === "image" ? "Import Image Asset" : "Import Audio Asset",
    multiple: false,
    directory: false,
    filters: kind === "image" ? imageAssetFileFilters : audioAssetFileFilters
  });
  const selectedPath = Array.isArray(selected) ? selected[0] : selected;

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
  if (!isTauri() || !currentFilePath) {
    return null;
  }

  const scenarioDirectoryPath = getParentDirectoryPath(currentFilePath);
  if (!scenarioDirectoryPath) {
    return null;
  }

  return convertFileSrc(resolveScenarioAssetFilePath(scenarioDirectoryPath, asset.path));
}

function getFileName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || filePath;
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
