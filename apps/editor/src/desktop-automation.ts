import { isTauri } from "@tauri-apps/api/core";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import type { ScenarioAssetKind } from "./scenario";

export type DesktopAutomationKind = "desktop-smoke";
export type DesktopAutomationPhase = "phase1" | "phase2";

export type DesktopAutomationQuery = {
  kind: DesktopAutomationKind;
  phase: DesktopAutomationPhase;
  specPath: string;
};

type DesktopAutomationSpec = {
  kind: DesktopAutomationKind;
  phase: DesktopAutomationPhase;
  resultPath: string;
  paths: {
    squareScenarioPath: string;
    squareCopyPath: string;
    hexScenarioPath: string;
    freeScenarioPath: string;
    exportPath: string;
    imageFixturePath: string;
    audioFixturePath: string;
  };
  saveResponses: Array<string | null>;
  exportResponses: Array<string | null>;
  openResponses: Array<string | null>;
  importResponses: Partial<Record<ScenarioAssetKind, Array<string | null>>>;
  confirmResponses: boolean[];
};

type DesktopAutomationSession = {
  spec: DesktopAutomationSpec;
  counters: {
    saveRequests: number;
    exportRequests: number;
    openRequests: number;
    confirmRequests: number;
    importRequests: Record<ScenarioAssetKind, number>;
  };
  events: string[];
};

type DesktopAutomationDialogResult = {
  handled: boolean;
  value: string | null;
};

type DesktopAutomationConfirmResult = {
  handled: boolean;
  value: boolean;
};

let cachedQuery: DesktopAutomationQuery | null | undefined;
let cachedSessionPromise: Promise<DesktopAutomationSession | null> | null = null;

export function readDesktopAutomationQuery(): DesktopAutomationQuery | null {
  if (cachedQuery !== undefined) {
    return cachedQuery;
  }

  cachedQuery = parseDesktopAutomationQuery();
  return cachedQuery;
}

export async function getDesktopAutomationSession(): Promise<DesktopAutomationSession | null> {
  if (cachedSessionPromise) {
    return cachedSessionPromise;
  }

  cachedSessionPromise = loadDesktopAutomationSession();
  return cachedSessionPromise;
}

export async function consumeDesktopAutomationSavePath(): Promise<DesktopAutomationDialogResult> {
  return consumeDesktopAutomationPath("saveResponses", "saveRequests", "save dialog");
}

export async function consumeDesktopAutomationExportPath(): Promise<DesktopAutomationDialogResult> {
  return consumeDesktopAutomationPath("exportResponses", "exportRequests", "export dialog");
}

export async function consumeDesktopAutomationOpenPath(): Promise<DesktopAutomationDialogResult> {
  return consumeDesktopAutomationPath("openResponses", "openRequests", "open dialog");
}

export async function consumeDesktopAutomationImportPath(
  kind: ScenarioAssetKind
): Promise<DesktopAutomationDialogResult> {
  const session = await getDesktopAutomationSession();
  if (!session) {
    return {
      handled: false,
      value: null
    };
  }

  const queue = session.spec.importResponses[kind];
  if (!queue || queue.length === 0) {
    throw new Error(`Desktop automation ${kind} import queue is exhausted.`);
  }

  session.counters.importRequests[kind] += 1;
  const value = queue.shift() ?? null;
  appendDesktopAutomationEvent(
    session,
    value ? `automation import ${kind}: ${value}` : `automation import ${kind}: cancel`
  );
  return {
    handled: true,
    value
  };
}

export async function consumeDesktopAutomationConfirmResponse(): Promise<DesktopAutomationConfirmResult> {
  const session = await getDesktopAutomationSession();
  if (!session) {
    return {
      handled: false,
      value: false
    };
  }

  if (session.spec.confirmResponses.length === 0) {
    throw new Error("Desktop automation confirm queue is exhausted.");
  }

  session.counters.confirmRequests += 1;
  const value = session.spec.confirmResponses.shift() ?? false;
  appendDesktopAutomationEvent(
    session,
    `automation confirm response: ${value ? "accept" : "cancel"}`
  );
  return {
    handled: true,
    value
  };
}

export async function writeDesktopAutomationResult(result: {
  ok: boolean;
  summary: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  const session = await getDesktopAutomationSession();
  if (!session) {
    return;
  }

  await writeTextFile(
    session.spec.resultPath,
    `${JSON.stringify(
      {
        ok: result.ok,
        summary: result.summary,
        details: result.details ?? {},
        kind: session.spec.kind,
        phase: session.spec.phase,
        counters: session.counters,
        events: session.events,
        finishedAt: new Date().toISOString()
      },
      null,
      2
    )}\n`
  );
}

export async function recordDesktopAutomationEvent(message: string): Promise<void> {
  const session = await getDesktopAutomationSession();
  if (!session) {
    return;
  }

  session.events.push(message);
}

function parseDesktopAutomationQuery(): DesktopAutomationQuery | null {
  if (!isTauri()) {
    return null;
  }

  const url = new URL(window.location.href);
  const automation = url.searchParams.get("fieldcraftAutomation");
  const specPath = url.searchParams.get("fieldcraftAutomationSpec");

  if (!automation || !specPath) {
    return null;
  }

  const match = /^desktop-smoke-(phase1|phase2)$/.exec(automation);
  if (!match) {
    return null;
  }

  return {
    kind: "desktop-smoke",
    phase: match[1] as DesktopAutomationPhase,
    specPath
  };
}

async function loadDesktopAutomationSession(): Promise<DesktopAutomationSession | null> {
  const query = readDesktopAutomationQuery();
  if (!query) {
    return null;
  }

  const raw = await readTextFile(query.specPath);
  const parsed: unknown = JSON.parse(raw);
  const spec = parseDesktopAutomationSpec(parsed);

  if (!spec) {
    throw new Error("Desktop automation spec is invalid.");
  }

  if (spec.kind !== query.kind || spec.phase !== query.phase) {
    throw new Error("Desktop automation query does not match the loaded spec.");
  }

  return {
    spec,
    counters: {
      saveRequests: 0,
      exportRequests: 0,
      openRequests: 0,
      confirmRequests: 0,
      importRequests: {
        image: 0,
        audio: 0
      }
    },
    events: []
  };
}

async function consumeDesktopAutomationPath(
  key: "saveResponses" | "exportResponses" | "openResponses",
  counterKey: "saveRequests" | "exportRequests" | "openRequests",
  label: string
): Promise<DesktopAutomationDialogResult> {
  const session = await getDesktopAutomationSession();
  if (!session) {
    return {
      handled: false,
      value: null
    };
  }

  const queue = session.spec[key];
  if (queue.length === 0) {
    throw new Error(`Desktop automation ${label} queue is exhausted.`);
  }

  session.counters[counterKey] += 1;
  const value = queue.shift() ?? null;
  appendDesktopAutomationEvent(
    session,
    value ? `automation ${label}: ${value}` : `automation ${label}: cancel`
  );
  return {
    handled: true,
    value
  };
}

function parseDesktopAutomationSpec(value: unknown): DesktopAutomationSpec | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    value.kind !== "desktop-smoke" ||
    (value.phase !== "phase1" && value.phase !== "phase2") ||
    typeof value.resultPath !== "string"
  ) {
    return null;
  }

  const paths = parseDesktopAutomationPaths(value.paths);
  const saveResponses = parseStringOrNullArray(value.saveResponses);
  const exportResponses = parseStringOrNullArray(value.exportResponses);
  const openResponses = parseStringOrNullArray(value.openResponses);
  const confirmResponses = parseBooleanArray(value.confirmResponses);
  const importResponses = parseImportResponseMap(value.importResponses);

  if (
    !paths ||
    !saveResponses ||
    !exportResponses ||
    !openResponses ||
    !confirmResponses ||
    !importResponses
  ) {
    return null;
  }

  return {
    kind: "desktop-smoke",
    phase: value.phase,
    resultPath: value.resultPath,
    paths,
    saveResponses,
    exportResponses,
    openResponses,
    importResponses,
    confirmResponses
  };
}

function parseImportResponseMap(
  value: unknown
): Partial<Record<ScenarioAssetKind, Array<string | null>>> | null {
  if (value === undefined) {
    return {};
  }

  if (!isRecord(value)) {
    return null;
  }

  const result: Partial<Record<ScenarioAssetKind, Array<string | null>>> = {};
  for (const kind of ["image", "audio"] as const) {
    if (value[kind] === undefined) {
      continue;
    }

    const queue = parseStringOrNullArray(value[kind]);
    if (!queue) {
      return null;
    }

    result[kind] = queue;
  }

  return result;
}

function parseStringOrNullArray(value: unknown): Array<string | null> | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const queue: Array<string | null> = [];
  for (const entry of value) {
    if (entry === null) {
      queue.push(null);
      continue;
    }

    if (typeof entry !== "string") {
      return null;
    }

    queue.push(entry);
  }

  return queue;
}

function parseBooleanArray(value: unknown): boolean[] | null {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "boolean")) {
    return null;
  }

  return [...value];
}

function parseDesktopAutomationPaths(
  value: unknown
): DesktopAutomationSpec["paths"] | null {
  if (!isRecord(value)) {
    return null;
  }

  const requiredKeys = [
    "squareScenarioPath",
    "squareCopyPath",
    "hexScenarioPath",
    "freeScenarioPath",
    "exportPath",
    "imageFixturePath",
    "audioFixturePath"
  ] as const;

  if (requiredKeys.some((key) => typeof value[key] !== "string")) {
    return null;
  }

  return {
    squareScenarioPath: value.squareScenarioPath as string,
    squareCopyPath: value.squareCopyPath as string,
    hexScenarioPath: value.hexScenarioPath as string,
    freeScenarioPath: value.freeScenarioPath as string,
    exportPath: value.exportPath as string,
    imageFixturePath: value.imageFixturePath as string,
    audioFixturePath: value.audioFixturePath as string
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function appendDesktopAutomationEvent(
  session: DesktopAutomationSession,
  message: string
): void {
  session.events.push(message);
}
