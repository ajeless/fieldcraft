import { isTauri } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import {
  type Scenario,
  createEmptyScenario,
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

const scenarioFileFilters = [
  {
    name: "Fieldcraft Scenario",
    extensions: ["json"]
  }
];

let currentFilePath: string | null = null;

export function getStorageModeLabel(): string {
  return isTauri() ? "Desktop file" : "Browser fallback";
}

export function getCurrentFilePath(): string | null {
  return currentFilePath;
}

export function getFileLabel(): string {
  if (currentFilePath) {
    return getFileName(currentFilePath);
  }

  return isTauri() ? "Unsaved" : "Browser storage";
}

export function getSaveAsLabel(): string {
  return isTauri() ? "Save As" : "Download JSON";
}

export function rememberScenario(scenario: Scenario): void {
  window.localStorage.setItem(scenarioStorageKey, scenarioToJson(scenario));
}

export function loadRememberedScenario(): Scenario {
  const stored = window.localStorage.getItem(scenarioStorageKey);

  if (!stored) {
    return createEmptyScenario();
  }

  try {
    return parseScenario(stored);
  } catch {
    return createEmptyScenario();
  }
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

function getFileName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || filePath;
}

function getDefaultScenarioFileName(scenario: Scenario): string {
  const slug = scenario.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${slug || "fieldcraft-scenario"}.fieldcraft.json`;
}
