import "./styles.css";
import { isTauri } from "@tauri-apps/api/core";
import { confirm as confirmDialog } from "@tauri-apps/plugin-dialog";
import {
  type BoardViewportState,
  createBoardViewport,
  createBoardViewportState,
  markerDragDataType,
  resetBoardViewportState
} from "./board-viewport";
import {
  type CommandDefinition,
  type CommandRegistry,
  createCommandRegistry,
  findCommandByShortcut
} from "./commands";
import {
  canRedoHistory,
  canUndoHistory,
  clearHistory,
  createHistoryState,
  popRedoHistory,
  popUndoHistory,
  pushHistoryEntry
} from "./history";
import {
  type ScenarioAssetKind,
  type Scenario,
  type ScenarioSpaceType,
  type ScenarioTileSpaceType,
  createFreeCoordinateScenarioSpace,
  createEmptyScenario,
  createTileScenarioSpace,
  defaultBoardBackgroundColor,
  defaultFreeCoordinateDistancePerWorldUnit,
  defaultFreeCoordinateScaleUnit,
  defaultGridLineColor,
  defaultGridLineOpacity,
  defaultScaleDistancePerTile,
  defaultScaleUnit,
  getDefaultTileSize,
  getScenarioBackgroundImageAsset,
  isTileScenarioSpace,
  maxFreeCoordinateBoardSize,
  maxTileGridSize,
  parseSupportedFreeCoordinateBoardSize,
  parseSupportedTileGridSize,
  parseSupportedTileSize,
  scenarioToJson
} from "./scenario";
import { loadScenarioWithMeta } from "./scenario-migrations";
import { generatePieceId } from "./scenario-migrations/identity";
import {
  type ScenarioStorageResult,
  canImportScenarioAssets,
  clearCurrentFilePath,
  exportScenarioBrowserRuntime,
  getCurrentFilePath,
  getFileLabel,
  getSaveAsLabel,
  getStorageModeLabel,
  importScenarioAssetFile,
  openBrowserScenarioFile,
  openScenarioFile,
  rememberScenario,
  resolveScenarioAssetUrl,
  saveScenarioFile,
  saveScenarioFileAs,
  setCurrentFilePath
} from "./storage";

type Route = "editor" | "runtime";

type EditorCommandId =
  | "undo"
  | "redo"
  | "new"
  | "open"
  | "save"
  | "save-as"
  | "export-runtime"
  | "delete-selected-marker";

type EditorCommand = CommandDefinition<EditorCommandId>;
type EditorCommands = CommandRegistry<EditorCommandId>;
type MenuEntry = EditorCommandId | "separator";
type Theme = "light" | "dark";
type ThemePreference = Theme | null;

type BoardSetupDraft = {
  type: ScenarioSpaceType;
  widthValue: string;
  heightValue: string;
  tileSizeValue: string;
  distancePerTileValue: string;
  scaleUnitValue: string;
  gridLineColorValue: string;
  gridLineOpacityValue: string;
  backgroundColorValue: string;
  freeXValue: string;
  freeYValue: string;
  freeWidthValue: string;
  freeHeightValue: string;
  freeDistancePerWorldUnitValue: string;
  freeScaleUnitValue: string;
  freeBackgroundColorValue: string;
  tileSizeEdited: boolean;
};

type ThemeBoardDefaults = {
  gridLineColor: string;
  boardBackgroundColor: string;
};

type StoredEditorSessionDraft = {
  version: 2;
  scenario: Scenario;
  boardSetupDraft: BoardSetupDraft;
  dirty: boolean;
  currentFilePath: string | null;
  sourceDraft: string;
};

type EditorSnapshot = {
  scenario: Scenario;
  boardSetupDraft: BoardSetupDraft;
  selectedMarkerId: string | null;
};

type SourceEditorSelection = {
  start: number;
  end: number;
};

const documentCommandGroups = [
  ["undo", "redo"],
  ["new", "open", "save", "save-as", "export-runtime"]
] as const satisfies ReadonlyArray<ReadonlyArray<EditorCommandId>>;

const themeStorageKey = "fieldcraft:theme";
const editorSessionDraftStorageKey = "fieldcraft:editor-session-draft";
const systemThemeMedia = window.matchMedia("(prefers-color-scheme: dark)");
const darkThemeBoardDefaults: ThemeBoardDefaults = {
  gridLineColor: "#536576",
  boardBackgroundColor: "#162129"
};

const appRoot = document.querySelector<HTMLDivElement>("#app");

if (!appRoot) {
  throw new Error("Missing #app root.");
}

const app = appRoot;
let themePreference = readStoredThemePreference();
applyTheme();
const recoveredSessionDraft = readStoredEditorSessionDraft();
if (recoveredSessionDraft) {
  setCurrentFilePath(recoveredSessionDraft.currentFilePath);
}
let scenario = recoveredSessionDraft?.scenario ?? createEmptyScenario();
let dirty = recoveredSessionDraft?.dirty ?? false;
let statusMessage = recoveredSessionDraft ? "Recovered session draft" : "Ready";
let boardSetupDraft =
  recoveredSessionDraft?.boardSetupDraft ?? createDefaultBoardSetupDraft(getActiveTheme());
let sourceDraft = recoveredSessionDraft?.sourceDraft ?? scenarioToJson(scenario);
let sourceEditorErrorMessage: string | null = null;
let sourceEditorErrorSelection: SourceEditorSelection | null = null;
let selectedMarkerId: string | null = null;
let commandRegistry: EditorCommands | null = null;
const editorHistory = createHistoryState<EditorSnapshot>();
let cleanScenarioSnapshot: Scenario | null = recoveredSessionDraft?.dirty
  ? null
  : cloneScenarioValue(scenario);
const boardViewportStates: Record<Route, BoardViewportState> = {
  editor: createBoardViewportState(),
  runtime: createBoardViewportState()
};

window.addEventListener("hashchange", render);
window.addEventListener("keydown", handleCommandShortcutKeyDown);
window.addEventListener("pagehide", syncEditorSessionDraft);
systemThemeMedia.addEventListener("change", handleSystemThemeChange);

render();

function render(): void {
  syncSelectedMarkerWithScenario();
  syncEditorSessionDraft();
  app.innerHTML = "";
  app.append(createShell(getRoute()));
}

function createShell(route: Route): HTMLElement {
  const shell = element("main", "shell");
  const fileInput = createOpenScenarioInput();
  commandRegistry = createEditorCommands(fileInput, route);
  const header = element("header", "topbar");
  const brand = element("div", "brand");
  brand.append(element("span", "brand-mark", "FC"), element("strong", "", "Fieldcraft"));
  const menuBar = createMenuBar();
  const themeSwitch = createThemeSwitch();

  const routeSwitch = element("nav", "route-switch");
  routeSwitch.setAttribute("aria-label", "Mode");
  routeSwitch.append(
    modeButton("Editor", "editor", route, () => navigate("editor")),
    modeButton("Runtime", "runtime", route, launchRuntime, !scenario.space)
  );

  const topbarPrimary = element("div", "topbar-primary");
  topbarPrimary.append(menuBar, createDocumentCommandBar());

  header.append(brand, topbarPrimary, themeSwitch, routeSwitch);
  shell.append(
    header,
    fileInput,
    route === "runtime" ? createRuntimeView() : createEditorView()
  );
  return shell;
}

function modeButton(
  label: string,
  targetRoute: Route,
  activeRoute: Route,
  onClick: () => void | Promise<void>,
  disabled = false
): HTMLButtonElement {
  const button = buttonElement(label, onClick, `mode-${targetRoute}`, disabled);
  button.className = targetRoute === activeRoute ? "mode-button active" : "mode-button";
  button.type = "button";
  return button;
}

function createThemeSwitch(): HTMLElement {
  const switcher = element("nav", "theme-switch");
  switcher.setAttribute("aria-label", "Theme");
  switcher.append(
    themeButton("System", null, "theme-system"),
    themeButton("Light", "light", "theme-light"),
    themeButton("Dark", "dark", "theme-dark")
  );
  return switcher;
}

function themeButton(
  label: string,
  preference: ThemePreference,
  testId: string
): HTMLButtonElement {
  const button = buttonElement(label, () => setThemePreference(preference), testId);
  button.className =
    themePreference === preference ? "theme-button active" : "theme-button";
  button.type = "button";
  return button;
}

function createEditorView(): HTMLElement {
  const view = element("section", "workspace");
  view.dataset.view = "editor";
  const selectedMarker = getSelectedMarker();

  const sidebar = element("aside", "panel left-panel");
  sidebar.append(
    element("p", "eyebrow", "Scenario"),
    labeledInput("Title", scenario.title, updateScenarioTitle, "scenario-title-input"),
    metric("Board", getBoardLabel()),
    metric("Markers", String(scenario.pieces.length), "marker-count"),
    metric("Assets", String(scenario.assets.length), "asset-count"),
    metric("File", getFileLabel(), "current-file"),
    createContextToolSection(),
    createStatusSection()
  );

  const boardStage = element("section", "board-stage");
  boardStage.append(
    element("div", "stage-header", scenario.space ? "Editor Board" : "Board Setup"),
    scenario.space
      ? createBoard({
          readonly: false,
          mode: "editor",
          state: boardViewportStates.editor,
          selectedMarkerId,
          onPieceSelect: handleSelectedMarkerChange,
          onMarkerDrop: placeDefaultMarker
        })
      : createBoardSetup()
  );

  const inspector = element("aside", "panel right-panel");
  inspector.append(createSelectionInspector(selectedMarker));
  inspector.append(createAssetLibrarySection());
  const savedAt = scenario.metadata.savedAt
    ? new Date(scenario.metadata.savedAt).toLocaleString()
    : "Not saved";
  const currentFilePath = getCurrentFilePath();
  const savedGameSection = element("section", "inspector-section");
  savedGameSection.append(
    element("p", "eyebrow", "Saved Game"),
    metric("State", getDocumentState()),
    metric("Mode", getStorageModeLabel()),
    metric("Last Save", savedAt)
  );
  if (currentFilePath) {
    savedGameSection.append(metric("Path", currentFilePath));
  }
  inspector.append(savedGameSection);
  inspector.append(createSourceEditorSection());

  view.append(sidebar, boardStage, inspector);
  return view;
}

function createOpenScenarioInput(): HTMLInputElement {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "application/json,.json";
  fileInput.className = "file-input";
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) {
      return;
    }

    void openBrowserScenarioFile(file)
      .then((result) => {
        fileInput.value = "";
        applyStorageResult(result);
      })
      .catch((error) => {
        statusMessage = getErrorMessage(error, "Could not load scenario.");
        fileInput.value = "";
        render();
      });
  });

  return fileInput;
}

function createEditorCommands(fileInput: HTMLInputElement, route: Route): EditorCommands {
  const selectedMarker = getSelectedMarker();

  return createCommandRegistry<EditorCommandId>([
    {
      id: "undo",
      label: "Undo",
      enabled: route === "editor" && canUndoHistory(editorHistory),
      shortcut: "Mod+Z",
      run: undoEditorMutation
    },
    {
      id: "redo",
      label: "Redo",
      enabled: route === "editor" && canRedoHistory(editorHistory),
      shortcut: "Shift+Mod+Z",
      run: redoEditorMutation
    },
    {
      id: "new",
      label: "New",
      enabled: true,
      shortcut: "Mod+N",
      run: createNewScenario
    },
    {
      id: "open",
      label: "Open",
      enabled: true,
      shortcut: "Mod+O",
      run: () => openScenario(fileInput)
    },
    {
      id: "save",
      label: "Save",
      enabled: true,
      shortcut: "Mod+S",
      run: saveScenario
    },
    {
      id: "save-as",
      label: getSaveAsLabel(),
      enabled: true,
      shortcut: "Shift+Mod+S",
      run: saveScenarioAs
    },
    {
      id: "export-runtime",
      label: "Export Runtime",
      enabled: Boolean(scenario.space),
      run: exportRuntime
    },
    {
      id: "delete-selected-marker",
      label: "Delete Marker",
      enabled: route === "editor" && Boolean(selectedMarker),
      shortcut: "Delete",
      run: deleteSelectedMarker
    }
  ]);
}

function createMenuBar(): HTMLElement {
  const menuBar = element("nav", "app-menu-bar");
  menuBar.setAttribute("aria-label", "Application menu");
  menuBar.append(
    createMenu("File", "file", [
      "new",
      "open",
      "separator",
      "save",
      "save-as",
      "export-runtime"
    ]),
    createMenu("Edit", "edit", ["undo", "redo", "separator", "delete-selected-marker"])
  );
  return menuBar;
}

function createMenu(label: string, id: string, entries: MenuEntry[]): HTMLElement {
  const details = document.createElement("details");
  const summary = element("summary", "app-menu-trigger", label);
  const popover = element("div", "app-menu-popover");

  details.className = "app-menu";
  summary.dataset.testid = `menu-${id}`;
  popover.setAttribute("role", "menu");

  for (const entry of entries) {
    if (entry === "separator") {
      popover.append(element("div", "menu-separator"));
      continue;
    }

    popover.append(createMenuCommandButton(entry));
  }

  details.addEventListener("toggle", () => {
    if (!details.open) {
      return;
    }

    const siblingMenus = details.parentElement?.querySelectorAll<HTMLDetailsElement>(
      "details.app-menu"
    );
    siblingMenus?.forEach((menu) => {
      if (menu !== details) {
        menu.open = false;
      }
    });
  });
  details.addEventListener("focusout", (event) => {
    const nextFocusedNode = event.relatedTarget;
    if (nextFocusedNode instanceof Node && details.contains(nextFocusedNode)) {
      return;
    }

    details.open = false;
  });

  details.append(summary, popover);
  return details;
}

function createMenuCommandButton(commandId: EditorCommandId): HTMLButtonElement {
  const command = getCommand(commandId);
  const shortcuts = getCommandShortcuts(commandId);
  const button = document.createElement("button");
  const label = element("span", "menu-item-label", command.label);
  const shortcut = shortcuts.length > 0
    ? element("span", "menu-item-shortcut", formatShortcutHints(shortcuts))
    : null;
  button.type = "button";
  button.className = "menu-item";
  button.disabled = !command.enabled;
  button.dataset.testid = getMenuCommandTestId(commandId);
  button.title = getCommandTitle(commandId);
  if (shortcuts.length > 0) {
    button.setAttribute("aria-keyshortcuts", formatShortcutAriaSet(shortcuts));
  }
  button.append(label);
  if (shortcut) {
    button.append(shortcut);
  }
  button.addEventListener("click", () => {
    const menu = button.closest("details");
    if (menu instanceof HTMLDetailsElement) {
      menu.open = false;
    }

    executeCommandById(commandId);
  });
  return button;
}

function executeCommand(command: EditorCommand): void {
  if (!command.enabled) {
    return;
  }

  const result = command.run();
  if (result instanceof Promise) {
    void result.catch((error) => {
      statusMessage = getErrorMessage(error, "Action failed.");
      render();
    });
  }
}

function executeCommandById(commandId: EditorCommandId): void {
  executeCommand(getCommand(commandId));
}

function handleCommandShortcutKeyDown(event: KeyboardEvent): void {
  if (event.defaultPrevented || event.repeat || !commandRegistry) {
    return;
  }

  const allowEditorHistoryFromSourceEditor =
    isSourceEditorEventTarget(event.target) && !hasPendingSourceEdits();

  if (isDeleteSelectionKeyEvent(event)) {
    const deleteCommand = commandRegistry["delete-selected-marker"];
    if (deleteCommand?.enabled) {
      event.preventDefault();
      executeCommand(deleteCommand);
    }
    return;
  }

  if (isRedoAliasKeyEvent(event, allowEditorHistoryFromSourceEditor)) {
    const redoCommand = commandRegistry["redo"];
    if (redoCommand?.enabled) {
      event.preventDefault();
      executeCommand(redoCommand);
    }
    return;
  }

  const command = findCommandByShortcut(commandRegistry, event);
  if (!command) {
    return;
  }
  if (
    (command.id === "undo" || command.id === "redo") &&
    isEditableEventTarget(event.target) &&
    !allowEditorHistoryFromSourceEditor
  ) {
    return;
  }

  event.preventDefault();
  executeCommand(command);
}

function isDeleteSelectionKeyEvent(event: KeyboardEvent): boolean {
  if (isEditableEventTarget(event.target)) {
    return false;
  }

  if (event.key === "Delete") {
    return true;
  }

  return event.key === "Backspace";
}

function isRedoAliasKeyEvent(
  event: KeyboardEvent,
  allowFromEditable = false
): boolean {
  return (
    !isMacPlatform() &&
    (allowFromEditable || !isEditableEventTarget(event.target)) &&
    event.key.toLowerCase() === "y" &&
    event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !event.shiftKey
  );
}

function isEditableEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const tagName = target.tagName;
  return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
}

function isSourceEditorEventTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLTextAreaElement &&
    target.dataset.testid === "scenario-source-input"
  );
}

function handleSourceEditorTabKeyDown(
  editor: HTMLTextAreaElement,
  event: KeyboardEvent
): boolean {
  if (event.key !== "Tab") {
    return false;
  }

  event.preventDefault();

  if (event.shiftKey) {
    outdentSourceEditorSelection(editor);
  } else {
    indentSourceEditorSelection(editor);
  }

  return true;
}

function indentSourceEditorSelection(editor: HTMLTextAreaElement): void {
  const indent = "  ";
  const selectionStart = editor.selectionStart;
  const selectionEnd = editor.selectionEnd;

  if (selectionStart === selectionEnd) {
    editor.setRangeText(indent, selectionStart, selectionEnd, "end");
    return;
  }

  const lineStart = getLineStartIndex(editor.value, selectionStart);
  const selectedText = editor.value.slice(lineStart, selectionEnd);
  const lineCount = selectedText.split("\n").length;
  const indentedText = selectedText
    .split("\n")
    .map((line) => `${indent}${line}`)
    .join("\n");

  editor.setRangeText(indentedText, lineStart, selectionEnd, "preserve");
  editor.setSelectionRange(
    selectionStart + indent.length,
    selectionEnd + indent.length * lineCount
  );
}

function outdentSourceEditorSelection(editor: HTMLTextAreaElement): void {
  const selectionStart = editor.selectionStart;
  const selectionEnd = editor.selectionEnd;
  const lineStart = getLineStartIndex(editor.value, selectionStart);

  if (selectionStart === selectionEnd) {
    const lineText = getCurrentLineText(editor.value, selectionStart);
    const removedPrefixLength = getOutdentPrefixLength(lineText);
    if (removedPrefixLength === 0) {
      return;
    }

    editor.setRangeText("", lineStart, lineStart + removedPrefixLength, "preserve");
    const nextCaret = Math.max(lineStart, selectionStart - removedPrefixLength);
    editor.setSelectionRange(nextCaret, nextCaret);
    return;
  }

  const selectedText = editor.value.slice(lineStart, selectionEnd);
  const lines = selectedText.split("\n");
  const removedPrefixLengths = lines.map(getOutdentPrefixLength);
  const outdentedText = lines
    .map((line, index) => line.slice(removedPrefixLengths[index]))
    .join("\n");
  const totalRemoved = removedPrefixLengths.reduce((sum, value) => sum + value, 0);
  const removedFromFirstLine = removedPrefixLengths[0] ?? 0;

  editor.setRangeText(outdentedText, lineStart, selectionEnd, "preserve");
  editor.setSelectionRange(
    Math.max(lineStart, selectionStart - removedFromFirstLine),
    Math.max(lineStart, selectionEnd - totalRemoved)
  );
}

function getLineStartIndex(value: string, index: number): number {
  return value.lastIndexOf("\n", Math.max(0, index - 1)) + 1;
}

function getCurrentLineText(value: string, index: number): string {
  const lineStart = getLineStartIndex(value, index);
  const nextNewline = value.indexOf("\n", index);

  return value.slice(lineStart, nextNewline === -1 ? value.length : nextNewline);
}

function getOutdentPrefixLength(line: string): number {
  if (line.startsWith("  ")) {
    return 2;
  }

  if (line.startsWith("\t") || line.startsWith(" ")) {
    return 1;
  }

  return 0;
}

function createRuntimeView(): HTMLElement {
  const view = element("section", "workspace runtime-workspace");
  view.dataset.view = "runtime";

  const sidebar = element("aside", "panel left-panel");
  sidebar.append(
    element("p", "eyebrow", "Runtime"),
    element("h1", "runtime-title", scenario.title),
    metric("Board", getBoardLabel()),
    metric("Markers", String(scenario.pieces.length)),
    metric("Assets", String(scenario.assets.length))
  );

  const boardStage = element("section", "board-stage runtime-stage");
  boardStage.append(
    element("div", "stage-header", "Game Runtime"),
    scenario.space
      ? createBoard({
          readonly: true,
          mode: "runtime",
          state: boardViewportStates.runtime
        })
      : createBlankBoardMessage()
  );

  view.append(sidebar, boardStage);
  return view;
}

function createDocumentCommandBar(): HTMLElement {
  const bar = element("nav", "document-command-bar");
  bar.dataset.testid = "document-command-bar";
  bar.setAttribute("aria-label", "Document commands");

  for (const group of documentCommandGroups) {
    const groupElement = element("div", "document-command-group");
    for (const commandId of group) {
      groupElement.append(createDocumentCommandButton(commandId));
    }
    bar.append(groupElement);
  }

  return bar;
}

function createDocumentCommandButton(commandId: EditorCommandId): HTMLButtonElement {
  const command = getCommand(commandId);
  const shortcuts = getCommandShortcuts(commandId);
  const button = buttonElement(
    getCommandLabel(commandId),
    () => executeCommandById(commandId),
    getCommandTestId(commandId),
    !command.enabled
  );
  button.className = "document-command-button";
  button.title = getCommandTitle(commandId);
  if (shortcuts.length > 0) {
    button.setAttribute("aria-keyshortcuts", formatShortcutAriaSet(shortcuts));
  }
  return button;
}

function createBoard(options: {
  readonly: boolean;
  mode: Route;
  state: BoardViewportState;
  selectedMarkerId?: string | null;
  onPieceSelect?: (pieceId: string | null) => void;
  onMarkerDrop?: (x: number, y: number) => void;
}): HTMLElement {
  const space = scenario.space;
  if (!space) {
    return createBlankBoardMessage();
  }

  const backgroundImageAsset = getScenarioBackgroundImageAsset(scenario);

  return createBoardViewport({
    mode: options.mode,
    readonly: options.readonly,
    space,
    pieces: scenario.pieces,
    backgroundImageUrl: backgroundImageAsset
      ? resolveScenarioAssetUrl(backgroundImageAsset)
      : null,
    selectedPieceId: options.selectedMarkerId ?? null,
    state: options.state,
    onPieceSelect: options.onPieceSelect,
    onMarkerDrop: options.onMarkerDrop
  });
}

function createSelectionInspector(selectedMarker: Scenario["pieces"][number] | null): HTMLElement {
  const section = element("section", "inspector-section");
  const deleteButton = createInspectorCommandButton(
    "delete-selected-marker",
    "delete-selected-marker",
    "action-button compact-action destructive-action",
    "Delete"
  );
  const header = element("div", "inspector-section-header");
  header.append(element("p", "eyebrow", "Selection"), deleteButton);

  section.append(header);
  if (!scenario.space) {
    const empty = element(
      "p",
      "inspector-empty",
      "Create a board and place a marker to inspect it."
    );
    empty.dataset.testid = "selected-marker-empty";
    section.append(empty);
    return section;
  }

  if (!selectedMarker) {
    const empty = element("p", "inspector-empty", "No marker selected.");
    empty.dataset.testid = "selected-marker-empty";
    section.append(empty);
    return section;
  }

  section.append(
    createMarkerIdInput(selectedMarker),
    metric("Position", getMarkerPositionLabel(selectedMarker), "selected-marker-position"),
    metric("Kind", "Marker", "selected-marker-kind")
  );

  return section;
}

function createMarkerIdInput(selectedMarker: Scenario["pieces"][number]): HTMLElement {
  const field = textInput("Marker ID", selectedMarker.id, "selected-marker-id-input");
  field.input.addEventListener("change", () => updateSelectedMarkerId(field.input.value));
  return field.label;
}

function createAssetLibrarySection(): HTMLElement {
  const section = element("section", "inspector-section");
  const header = element("div", "inspector-section-header");
  const actions = element("div", "asset-section-actions");
  const importImageButton = buttonElement(
    "Import Image",
    () => importScenarioAsset("image"),
    "import-image-asset",
    !canImportScenarioAssets() || !getCurrentFilePath()
  );
  const importAudioButton = buttonElement(
    "Import Audio",
    () => importScenarioAsset("audio"),
    "import-audio-asset",
    !canImportScenarioAssets() || !getCurrentFilePath()
  );
  const clearBackgroundButton = buttonElement(
    "Clear Background",
    clearBoardBackgroundImageAsset,
    "clear-background-image-asset",
    !scenario.space?.background.imageAssetId
  );
  const backgroundImageAsset = getScenarioBackgroundImageAsset(scenario);
  const currentFilePath = getCurrentFilePath();

  importImageButton.className = "action-button compact-action";
  importAudioButton.className = "action-button compact-action";
  clearBackgroundButton.className = "action-button compact-action";
  header.append(element("p", "eyebrow", "Assets"));
  actions.append(importImageButton, importAudioButton, clearBackgroundButton);
  header.append(actions);
  section.append(header);
  section.append(
    metric(
      "Board Background",
      backgroundImageAsset?.id ?? "None",
      "board-background-image-asset"
    )
  );

  if (!isTauri()) {
    section.append(
      element(
        "p",
        "inspector-empty",
        "Desktop imports copy package-local image and audio files. Browser mode preserves asset refs from source or opened scenarios but does not import local files."
      )
    );
  } else if (!currentFilePath) {
    section.append(
      element(
        "p",
        "inspector-empty",
        "Save the scenario to a desktop file before importing package assets."
      )
    );
  } else {
    section.append(
      element(
        "p",
        "source-editor-hint",
        "Imported assets are copied into an assets/ folder beside the scenario file and kept as relative package refs."
      )
    );
  }

  if (scenario.assets.length === 0) {
    section.append(element("p", "inspector-empty", "No imported assets."));
    return section;
  }

  const assetList = element("ul", "asset-list");
  assetList.dataset.testid = "asset-list";

  for (const asset of scenario.assets) {
    const item = element("li", "asset-list-item");
    const assetMeta = element("div", "asset-meta");
    const assetHeader = element("div", "asset-meta-header");
    const assetId = element("strong", "asset-id", asset.id);
    const assetKind = element("span", `asset-kind asset-kind-${asset.kind}`, asset.kind);
    const assetPath = element("code", "asset-path", asset.path);

    assetHeader.append(assetId, assetKind);
    assetMeta.append(assetHeader, assetPath);
    item.append(assetMeta);

    if (asset.kind === "image" && scenario.space) {
      const isCurrentBackground = scenario.space.background.imageAssetId === asset.id;
      const backgroundButton = buttonElement(
        isCurrentBackground ? "Background Active" : "Set Background",
        () => setBoardBackgroundImageAsset(asset.id),
        `set-background-image-${asset.id}`,
        isCurrentBackground
      );
      backgroundButton.className = "action-button compact-action";
      item.append(backgroundButton);
    }

    assetList.append(item);
  }

  section.append(assetList);
  return section;
}

function createSourceEditorSection(): HTMLElement {
  const section = element("section", "inspector-section source-editor-section");
  const header = element("div", "inspector-section-header source-editor-header");
  const actions = element("div", "source-editor-actions");
  const appliedSource = getAppliedSourceText();
  const hint = element("p", "source-editor-hint");
  const error =
    sourceEditorErrorMessage === null
      ? null
      : element("p", "source-editor-error", sourceEditorErrorMessage);
  const editor = document.createElement("textarea");
  const applyButton = buttonElement("Apply", applyScenarioSource, "apply-source");
  const resetButton = buttonElement("Reset", resetScenarioSource, "reset-source");
  const syncSourceEditorDraft = () => {
    sourceDraft = editor.value;
    clearSourceEditorError();
    syncEditorSessionDraft();
    syncControls();
  };
  const syncControls = () => {
    const hasPendingEdits = editor.value !== appliedSource;
    hint.textContent = hasPendingEdits
      ? "Draft has unapplied edits. Apply validates JSON before replacing the current editor state; save and runtime still use the applied scenario."
      : "Source matches the current editor state.";
    applyButton.disabled = !hasPendingEdits;
    resetButton.disabled = !hasPendingEdits;
  };

  applyButton.className = "action-button compact-action";
  resetButton.className = "action-button compact-action";
  header.append(element("p", "eyebrow", "Source"));
  actions.append(applyButton, resetButton);
  header.append(actions);

  editor.className = "source-editor-input";
  if (sourceEditorErrorMessage) {
    editor.classList.add("has-error");
  }
  editor.value = sourceDraft;
  editor.spellcheck = false;
  editor.wrap = "off";
  editor.dataset.testid = "scenario-source-input";
  editor.setAttribute("aria-label", "Scenario source");
  editor.addEventListener("input", () => {
    syncSourceEditorDraft();
  });
  editor.addEventListener("keydown", (event) => {
    if (!handleSourceEditorTabKeyDown(editor, event)) {
      return;
    }

    syncSourceEditorDraft();
  });

  if (sourceEditorErrorSelection) {
    const selection = sourceEditorErrorSelection;
    sourceEditorErrorSelection = null;
    requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(selection.start, selection.end);
    });
  }

  syncControls();
  section.append(header);
  if (error) {
    section.append(error);
  }
  section.append(hint, editor);
  return section;
}

function createContextToolSection(): HTMLElement {
  const palette = element("section", "marker-palette");
  const markerEnabled = Boolean(scenario.space);
  const marker = document.createElement("button");
  const swatch = element("span", "palette-marker-swatch");
  const label = element("span", "palette-marker-label", "Marker");
  const helper = element(
    "p",
    "tool-hint",
    markerEnabled
      ? "Drag the marker onto the board to place it."
      : "Create a board to unlock marker placement."
  );

  marker.type = "button";
  marker.className = "palette-marker";
  marker.draggable = markerEnabled;
  marker.disabled = !markerEnabled;
  marker.dataset.testid = "palette-marker";
  marker.setAttribute(
    "aria-label",
    markerEnabled ? "Default marker" : "Create a board to enable marker placement"
  );
  marker.title = markerEnabled ? "Default marker" : "Create a board to enable marker placement";
  if (markerEnabled) {
    marker.addEventListener("dragstart", (event) => {
      if (!event.dataTransfer) {
        return;
      }

      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData(markerDragDataType, "default-marker");
      event.dataTransfer.setData("text/plain", "Fieldcraft marker");
      event.dataTransfer.setDragImage(
        swatch,
        swatch.offsetWidth / 2,
        swatch.offsetHeight / 2
      );
    });
  }
  marker.append(swatch, label);
  palette.append(element("p", "eyebrow", "Tools"), helper, marker);
  return palette;
}

function createStatusSection(): HTMLElement {
  const section = element("section", "status-section");
  const status = element("p", "status-line", statusMessage);
  status.dataset.testid = "status-line";
  status.title = statusMessage;
  section.append(element("p", "eyebrow", "Status"), status);
  return section;
}

function createBoardSetup(): HTMLElement {
  const setup = element("section", "board-setup");
  const selectedType = boardSetupDraft.type;
  const squareOption = spaceOption(
    "Square grid",
    "square-grid",
    selectedType === "square-grid"
  );
  const hexOption = spaceOption(
    "Hex grid",
    "hex-grid",
    selectedType === "hex-grid"
  );
  const freeOption = spaceOption(
    "Free-coordinate",
    "free-coordinate",
    selectedType === "free-coordinate"
  );
  const spaceChoice = element("fieldset", "space-choice");

  for (const option of [squareOption, hexOption, freeOption]) {
    option.input.addEventListener("change", () => {
      if (!option.input.checked) {
        return;
      }

      boardSetupDraft = {
        ...boardSetupDraft,
        type: option.type,
        tileSizeValue:
          isTileSetupType(option.type) && !boardSetupDraft.tileSizeEdited
            ? String(getDefaultTileSize(option.type))
            : boardSetupDraft.tileSizeValue
      };
      syncEditorSessionDraft();
      render();
    });
  }

  spaceChoice.append(
    element("legend", "", "Space"),
    squareOption.label,
    hexOption.label,
    freeOption.label
  );
  setup.append(element("p", "eyebrow", "New Board"), spaceChoice);

  if (!isTileSetupType(selectedType)) {
    const xInput = numberInput("Left X", boardSetupDraft.freeXValue, "free-x-input", {
      min: String(-maxFreeCoordinateBoardSize),
      max: String(maxFreeCoordinateBoardSize),
      step: "0.01"
    });
    const yInput = numberInput("Top Y", boardSetupDraft.freeYValue, "free-y-input", {
      min: String(-maxFreeCoordinateBoardSize),
      max: String(maxFreeCoordinateBoardSize),
      step: "0.01"
    });
    const widthInput = numberInput(
      "Width",
      boardSetupDraft.freeWidthValue,
      "free-width-input",
      {
        min: "0.01",
        max: String(maxFreeCoordinateBoardSize),
        step: "0.01"
      }
    );
    const heightInput = numberInput(
      "Height",
      boardSetupDraft.freeHeightValue,
      "free-height-input",
      {
        min: "0.01",
        max: String(maxFreeCoordinateBoardSize),
        step: "0.01"
      }
    );
    const scaleDistanceInput = numberInput(
      "Distance per world unit",
      boardSetupDraft.freeDistancePerWorldUnitValue,
      "free-scale-distance-input",
      {
        min: "0.01",
        max: "9999",
        step: "0.01"
      }
    );
    const scaleUnitInput = textInput(
      "Scale unit",
      boardSetupDraft.freeScaleUnitValue,
      "free-scale-unit-input"
    );
    const backgroundColorInput = colorInput(
      "Board background",
      boardSetupDraft.freeBackgroundColorValue,
      "free-background-input"
    );
    const updateFreeDraft = () => {
      boardSetupDraft = {
        ...boardSetupDraft,
        type: "free-coordinate",
        freeXValue: xInput.input.value,
        freeYValue: yInput.input.value,
        freeWidthValue: widthInput.input.value,
        freeHeightValue: heightInput.input.value,
        freeDistancePerWorldUnitValue: scaleDistanceInput.input.value,
        freeScaleUnitValue: scaleUnitInput.input.value,
        freeBackgroundColorValue: backgroundColorInput.input.value
      };
      syncEditorSessionDraft();
    };

    for (const input of [
      xInput.input,
      yInput.input,
      widthInput.input,
      heightInput.input,
      scaleDistanceInput.input,
      scaleUnitInput.input,
      backgroundColorInput.input
    ]) {
      input.addEventListener("input", updateFreeDraft);
      input.addEventListener("change", updateFreeDraft);
    }

    setup.append(
      xInput.label,
      yInput.label,
      widthInput.label,
      heightInput.label,
      scaleDistanceInput.label,
      scaleUnitInput.label,
      backgroundColorInput.label,
      buttonElement(
        "Create Board",
        () =>
          createFreeCoordinateBoard({
            xValue: xInput.input.value,
            yValue: yInput.input.value,
            widthValue: widthInput.input.value,
            heightValue: heightInput.input.value,
            distancePerWorldUnitValue: scaleDistanceInput.input.value,
            scaleUnitValue: scaleUnitInput.input.value,
            backgroundColorValue: backgroundColorInput.input.value
          }),
        "create-board"
      )
    );

    return setup;
  }

  const widthInput = numberInput("Columns", boardSetupDraft.widthValue, "grid-width-input", {
    max: String(maxTileGridSize),
    step: "1"
  });
  const heightInput = numberInput("Rows", boardSetupDraft.heightValue, "grid-height-input", {
    max: String(maxTileGridSize),
    step: "1"
  });
  const tileSizeInput = numberInput(
    "Tile size",
    boardSetupDraft.tileSizeValue,
    "tile-size-input",
    {
      min: "8",
      max: "160",
      step: "1"
    }
  );
  const scaleDistanceInput = numberInput(
    "Distance per tile",
    boardSetupDraft.distancePerTileValue,
    "scale-distance-input",
    {
      min: "0.01",
      max: "9999",
      step: "0.01"
    }
  );
  const scaleUnitInput = textInput(
    "Scale unit",
    boardSetupDraft.scaleUnitValue,
    "scale-unit-input"
  );
  const gridLineColorInput = colorInput(
    "Grid line color",
    boardSetupDraft.gridLineColorValue,
    "grid-line-color-input"
  );
  const gridLineOpacityInput = numberInput(
    "Grid line opacity",
    boardSetupDraft.gridLineOpacityValue,
    "grid-line-opacity-input",
    {
      min: "0",
      max: "1",
      step: "0.05"
    }
  );
  const backgroundColorInput = colorInput(
    "Board background",
    boardSetupDraft.backgroundColorValue,
    "board-background-input"
  );
  const updateDraft = () => {
    boardSetupDraft = {
      ...boardSetupDraft,
      type: selectedType,
      widthValue: widthInput.input.value,
      heightValue: heightInput.input.value,
      tileSizeValue: tileSizeInput.input.value,
      distancePerTileValue: scaleDistanceInput.input.value,
      scaleUnitValue: scaleUnitInput.input.value,
      gridLineColorValue: gridLineColorInput.input.value,
      gridLineOpacityValue: gridLineOpacityInput.input.value,
      backgroundColorValue: backgroundColorInput.input.value,
      tileSizeEdited: boardSetupDraft.tileSizeEdited
    };
    syncEditorSessionDraft();
  };

  tileSizeInput.input.addEventListener("input", () => {
    boardSetupDraft.tileSizeEdited = true;
    updateDraft();
  });
  for (const input of [
    widthInput.input,
    heightInput.input,
    scaleDistanceInput.input,
    scaleUnitInput.input,
    gridLineColorInput.input,
    gridLineOpacityInput.input,
    backgroundColorInput.input
  ]) {
    input.addEventListener("input", updateDraft);
    input.addEventListener("change", updateDraft);
  }

  setup.append(
    widthInput.label,
    heightInput.label,
    tileSizeInput.label,
    scaleDistanceInput.label,
    scaleUnitInput.label,
    gridLineColorInput.label,
    gridLineOpacityInput.label,
    backgroundColorInput.label,
    buttonElement(
      "Create Board",
      () =>
        createTileGrid({
          type: selectedType,
          widthValue: widthInput.input.value,
          heightValue: heightInput.input.value,
          tileSizeValue: tileSizeInput.input.value,
          distancePerTileValue: scaleDistanceInput.input.value,
          scaleUnitValue: scaleUnitInput.input.value,
          gridLineColorValue: gridLineColorInput.input.value,
          gridLineOpacityValue: gridLineOpacityInput.input.value,
          backgroundColorValue: backgroundColorInput.input.value
        }),
      "create-board"
    )
  );

  return setup;
}

function createBlankBoardMessage(): HTMLElement {
  const blank = element("section", "blank-board");
  blank.append(
    element("p", "eyebrow", "No Board"),
    element("h2", "", "Blank scenario")
  );
  return blank;
}

function createInspectorCommandButton(
  commandId: EditorCommandId,
  testId: string,
  className: string,
  label?: string
): HTMLButtonElement {
  const command = getCommand(commandId);
  const shortcuts = getCommandShortcuts(commandId);
  const button = buttonElement(
    label ?? command.label,
    () => executeCommandById(commandId),
    testId,
    !command.enabled
  );
  button.className = className;
  button.title = getCommandTitle(commandId);
  if (shortcuts.length > 0) {
    button.setAttribute("aria-keyshortcuts", formatShortcutAriaSet(shortcuts));
  }
  return button;
}

function handleSelectedMarkerChange(pieceId: string | null): void {
  if (selectedMarkerId === pieceId) {
    return;
  }

  selectedMarkerId = pieceId;
  render();
}

function updateScenarioTitle(value: string): void {
  const nextTitle = value || createEmptyScenario().title;
  if (scenario.title === nextTitle) {
    return;
  }

  commitUndoableChange("title edit", "Title updated", () => {
    scenario = {
      ...scenario,
      title: nextTitle
    };
  });
}

function updateSelectedMarkerId(value: string): void {
  const selectedMarker = getSelectedMarker();
  if (!selectedMarker) {
    return;
  }

  const nextId = value.trim();
  if (!nextId) {
    statusMessage = "Marker ID cannot be empty";
    render();
    return;
  }

  if (nextId === selectedMarker.id) {
    return;
  }

  if (scenario.pieces.some((piece) => piece.id === nextId)) {
    statusMessage = "Marker ID already exists";
    render();
    return;
  }

  commitUndoableChange("marker inspector edit", "Marker ID updated", () => {
    scenario = {
      ...scenario,
      pieces: scenario.pieces.map((piece) =>
        piece.id === selectedMarker.id ? { ...piece, id: nextId } : piece
      )
    };
    selectedMarkerId = nextId;
  });
}

function deleteSelectedMarker(): void {
  const selectedMarker = getSelectedMarker();
  if (!selectedMarker) {
    return;
  }

  commitUndoableChange("marker deletion", "Marker deleted", () => {
    scenario = {
      ...scenario,
      pieces: scenario.pieces.filter((piece) => piece.id !== selectedMarker.id)
    };
    selectedMarkerId = null;
  });
}

function placeDefaultMarker(x: number, y: number): void {
  if (!scenario.space) {
    return;
  }

  const existingIds = new Set(scenario.pieces.map((piece) => piece.id));
  const markerId = generatePieceId(existingIds);

  commitUndoableChange("marker placement", "Marker placed", () => {
    scenario = {
      ...scenario,
      pieces: [
        ...scenario.pieces,
        {
          id: markerId,
          label: "",
          kind: "marker" as const,
          side: "neutral" as const,
          x,
          y
        }
      ]
    };
    selectedMarkerId = markerId;
  });
}

async function createNewScenario(): Promise<void> {
  if (!(await confirmDiscardUnsavedChanges())) {
    return;
  }

  scenario = createEmptyScenario();
  sourceDraft = getAppliedSourceText();
  clearSourceEditorError();
  selectedMarkerId = null;
  clearCurrentFilePath();
  resetBoardViewportStates();
  boardSetupDraft = createDefaultBoardSetupDraft();
  clearHistory(editorHistory);
  cleanScenarioSnapshot = cloneScenarioValue(scenario);
  dirty = false;
  statusMessage = "New blank scenario";
  navigate("editor");
}

function launchRuntime(): void {
  if (!scenario.space) {
    statusMessage = "Create a board before launching runtime.";
    render();
    return;
  }

  rememberScenario(scenario);
  navigate("runtime");
}

function createTileGrid(options: {
  type: ScenarioTileSpaceType;
  widthValue: string;
  heightValue: string;
  tileSizeValue: string;
  distancePerTileValue: string;
  scaleUnitValue: string;
  gridLineColorValue: string;
  gridLineOpacityValue: string;
  backgroundColorValue: string;
}): void {
  boardSetupDraft = {
    ...boardSetupDraft,
    type: options.type,
    widthValue: options.widthValue,
    heightValue: options.heightValue,
    tileSizeValue: options.tileSizeValue,
    distancePerTileValue: options.distancePerTileValue,
    scaleUnitValue: options.scaleUnitValue,
    gridLineColorValue: options.gridLineColorValue,
    gridLineOpacityValue: options.gridLineOpacityValue,
    backgroundColorValue: options.backgroundColorValue,
    tileSizeEdited: boardSetupDraft.tileSizeEdited
  };

  const width = parseSupportedTileGridSize(Number.parseInt(options.widthValue, 10));
  const height = parseSupportedTileGridSize(Number.parseInt(options.heightValue, 10));
  const tileSize = parseSupportedTileSize(Number.parseFloat(options.tileSizeValue));
  const distancePerTile = parsePositiveNumber(options.distancePerTileValue);
  const gridLineOpacity = parseOpacity(options.gridLineOpacityValue);
  const gridLineColor = parseHexColor(options.gridLineColorValue);
  const backgroundColor = parseHexColor(options.backgroundColorValue);
  const scaleUnit = options.scaleUnitValue.trim();

  if (!width || !height) {
    statusMessage = `Grid size must be between 1 and ${maxTileGridSize}`;
    render();
    return;
  }

  if (
    !tileSize ||
    !distancePerTile ||
    gridLineOpacity === null ||
    !gridLineColor ||
    !backgroundColor ||
    !scaleUnit
  ) {
    statusMessage = "Board setup values are out of range";
    render();
    return;
  }

  commitUndoableChange(
    "board creation",
    `${getTileSpaceLabel(options.type)} created: ${width} x ${height}`,
    () => {
      scenario = {
        ...scenario,
        space: createTileScenarioSpace({
          type: options.type,
          width,
          height,
          tileSize,
          distancePerTile,
          scaleUnit,
          gridLineColor,
          gridLineOpacity,
          backgroundColor
        }),
        pieces: []
      };
      selectedMarkerId = null;
      resetBoardViewportStates();
    }
  );
}

function createFreeCoordinateBoard(options: {
  xValue: string;
  yValue: string;
  widthValue: string;
  heightValue: string;
  distancePerWorldUnitValue: string;
  scaleUnitValue: string;
  backgroundColorValue: string;
}): void {
  boardSetupDraft = {
    ...boardSetupDraft,
    type: "free-coordinate",
    freeXValue: options.xValue,
    freeYValue: options.yValue,
    freeWidthValue: options.widthValue,
    freeHeightValue: options.heightValue,
    freeDistancePerWorldUnitValue: options.distancePerWorldUnitValue,
    freeScaleUnitValue: options.scaleUnitValue,
    freeBackgroundColorValue: options.backgroundColorValue
  };

  const x = parseFiniteNumber(options.xValue);
  const y = parseFiniteNumber(options.yValue);
  const width = parseSupportedFreeCoordinateBoardSize(
    Number.parseFloat(options.widthValue)
  );
  const height = parseSupportedFreeCoordinateBoardSize(
    Number.parseFloat(options.heightValue)
  );
  const distancePerWorldUnit = parsePositiveNumber(options.distancePerWorldUnitValue);
  const backgroundColor = parseHexColor(options.backgroundColorValue);
  const scaleUnit = options.scaleUnitValue.trim();

  if (
    x === null ||
    y === null ||
    !width ||
    !height ||
    !distancePerWorldUnit ||
    !backgroundColor ||
    !scaleUnit
  ) {
    statusMessage = "Free-coordinate setup values are out of range";
    render();
    return;
  }

  commitUndoableChange(
    "board creation",
    `Free-coordinate board created: ${width} x ${height}`,
    () => {
      scenario = {
        ...scenario,
        space: createFreeCoordinateScenarioSpace({
          x,
          y,
          width,
          height,
          distancePerWorldUnit,
          scaleUnit,
          backgroundColor
        }),
        pieces: []
      };
      selectedMarkerId = null;
      resetBoardViewportStates();
    }
  );
}

async function openScenario(fileInput: HTMLInputElement): Promise<void> {
  if (!(await confirmDiscardUnsavedChanges())) {
    return;
  }

  try {
    applyStorageResult(await openScenarioFile(fileInput));
  } catch (error) {
    statusMessage = getErrorMessage(error, "Could not open scenario.");
    render();
  }
}

async function saveScenario(): Promise<void> {
  try {
    applyStorageResult(await saveScenarioFile(scenario));
  } catch (error) {
    statusMessage = getErrorMessage(error, "Could not save scenario.");
    render();
  }
}

async function saveScenarioAs(): Promise<void> {
  try {
    applyStorageResult(await saveScenarioFileAs(scenario));
  } catch (error) {
    statusMessage = getErrorMessage(error, "Could not save scenario.");
    render();
  }
}

async function exportRuntime(): Promise<void> {
  if (!scenario.space) {
    statusMessage = "Create a board before exporting runtime.";
    render();
    return;
  }

  try {
    applyStorageResult(await exportScenarioBrowserRuntime(scenario));
  } catch (error) {
    statusMessage = getErrorMessage(error, "Could not export runtime.");
    render();
  }
}

async function importScenarioAsset(kind: ScenarioAssetKind): Promise<void> {
  const result = await importScenarioAssetFile(scenario, kind);
  const importedAsset = result.asset;
  if (!importedAsset) {
    statusMessage = result.statusMessage;
    render();
    return;
  }

  commitUndoableChange(`import ${kind} asset`, result.statusMessage, () => {
    scenario = {
      ...scenario,
      assets: [...scenario.assets, importedAsset]
    };
  });
}

function setBoardBackgroundImageAsset(assetId: string): void {
  if (!scenario.space || scenario.space.background.imageAssetId === assetId) {
    return;
  }

  commitUndoableChange("set board background image", "Board background image updated", () => {
    scenario = {
      ...scenario,
      space: {
        ...scenario.space!,
        background: {
          ...scenario.space!.background,
          imageAssetId: assetId
        }
      }
    };
  });
}

function clearBoardBackgroundImageAsset(): void {
  if (!scenario.space?.background.imageAssetId) {
    return;
  }

  commitUndoableChange("clear board background image", "Board background image cleared", () => {
    const nextBackground = {
      ...scenario.space!.background
    };
    delete nextBackground.imageAssetId;
    scenario = {
      ...scenario,
      space: {
        ...scenario.space!,
        background: nextBackground
      }
    };
  });
}

function applyScenarioSource(): void {
  try {
    const { scenario: parsedScenario, migrated } = loadScenarioWithMeta(sourceDraft);
    const appliedSource = scenarioToJson(parsedScenario);
    const statusText = migrated
      ? "Source applied and upgraded to current format"
      : "Source applied";

    if (scenariosEqual(parsedScenario, scenario)) {
      sourceDraft = appliedSource;
      clearSourceEditorError();
      statusMessage = statusText;
      render();
      return;
    }

    commitUndoableChange("source apply", statusText, () => {
      scenario = parsedScenario;
      sourceDraft = appliedSource;
      clearSourceEditorError();
    });
  } catch (error) {
    const sourceEditorError = getScenarioSourceErrorDetails(sourceDraft, error);
    sourceEditorErrorMessage = sourceEditorError.message;
    sourceEditorErrorSelection = sourceEditorError.selection;
    statusMessage = sourceEditorError.message;
    render();
  }
}

function resetScenarioSource(): void {
  if (!hasPendingSourceEdits()) {
    return;
  }

  sourceDraft = getAppliedSourceText();
  clearSourceEditorError();
  statusMessage = "Source reset to editor state";
  render();
}

function undoEditorMutation(): void {
  const snapshot = captureEditorSnapshot();
  const entry = popUndoHistory(editorHistory, snapshot);
  if (!entry) {
    return;
  }

  applyEditorSnapshot(entry.snapshot);
  statusMessage = `Undid ${entry.label}`;
  render();
}

function redoEditorMutation(): void {
  const snapshot = captureEditorSnapshot();
  const entry = popRedoHistory(editorHistory, snapshot);
  if (!entry) {
    return;
  }

  applyEditorSnapshot(entry.snapshot);
  statusMessage = `Redid ${entry.label}`;
  render();
}

function commitUndoableChange(
  label: string,
  successMessage: string,
  mutate: () => void
): void {
  const before = captureEditorSnapshot();
  const previousBoardKey = getScenarioBoardKey(before.scenario);
  mutate();
  syncSourceDraftWithScenario(before.scenario);
  syncSelectedMarkerWithScenario();
  const after = captureEditorSnapshot();

  if (editorSnapshotsEqual(before, after)) {
    return;
  }

  pushHistoryEntry(editorHistory, {
    snapshot: before,
    label
  });
  if (previousBoardKey !== getScenarioBoardKey(after.scenario)) {
    resetBoardViewportStates();
  }
  syncDirtyState();
  statusMessage = successMessage;
  render();
}

function captureEditorSnapshot(): EditorSnapshot {
  return {
    scenario: cloneScenarioValue(scenario),
    boardSetupDraft: cloneBoardSetupDraftValue(boardSetupDraft),
    selectedMarkerId
  };
}

function applyEditorSnapshot(snapshot: EditorSnapshot): void {
  const previousScenario = scenario;
  const previousBoardKey = getScenarioBoardKey(previousScenario);
  scenario = cloneScenarioValue(snapshot.scenario);
  boardSetupDraft = cloneBoardSetupDraftValue(snapshot.boardSetupDraft);
  selectedMarkerId = snapshot.selectedMarkerId;
  syncSourceDraftWithScenario(previousScenario);
  syncSelectedMarkerWithScenario();
  if (previousBoardKey !== getScenarioBoardKey(scenario)) {
    resetBoardViewportStates();
  }
  syncDirtyState();
}

function syncDirtyState(): void {
  dirty = cleanScenarioSnapshot
    ? !scenariosEqual(scenario, cleanScenarioSnapshot)
    : true;
}

function markScenarioClean(value: Scenario): void {
  cleanScenarioSnapshot = cloneScenarioValue(value);
  dirty = false;
}

function applyStorageResult(result: ScenarioStorageResult | null): void {
  if (!result) {
    return;
  }

  const previousScenario = scenario;
  const previousBoardKey = getScenarioBoardKey(previousScenario);
  let shouldResetViewport = false;
  const shouldClearUndoHistory =
    result.statusMessage.startsWith("Opened ") || result.statusMessage.startsWith("Loaded ");

  if (result.scenario) {
    scenario = result.scenario;
    selectedMarkerId = null;
    if (!scenario.space) {
      boardSetupDraft = createDefaultBoardSetupDraft(getActiveTheme());
    }
    if (shouldClearUndoHistory) {
      sourceDraft = getAppliedSourceText();
      clearSourceEditorError();
    } else {
      syncSourceDraftWithScenario(previousScenario);
    }
    shouldResetViewport =
      previousBoardKey !== getScenarioBoardKey(scenario) ||
      shouldClearUndoHistory;
  }
  if (result.scenario) {
    markScenarioClean(result.scenario);
  }
  if (result.migrated) {
    dirty = true;
  } else if (result.dirty !== undefined) {
    dirty = result.dirty;
  }
  if (shouldClearUndoHistory) {
    clearHistory(editorHistory);
  }
  if (shouldResetViewport) {
    resetBoardViewportStates();
  }
  statusMessage =
    result.migrated && result.scenario
      ? `${result.statusMessage} (upgraded to current format)`
      : result.statusMessage;
  render();
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = error.message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return fallback;
}

function clearSourceEditorError(): void {
  sourceEditorErrorMessage = null;
  sourceEditorErrorSelection = null;
}

function getScenarioSourceErrorDetails(
  input: string,
  error: unknown
): {
  message: string;
  selection: SourceEditorSelection | null;
} {
  if (error instanceof SyntaxError) {
    const location = getJsonSyntaxErrorLocation(input, error);
    if (location) {
      return {
        message: `Source is not valid JSON at line ${location.line}, column ${location.column}.`,
        selection: getSourceEditorSelectionForIndex(input, location.index)
      };
    }

    return {
      message: "Source is not valid JSON.",
      selection: null
    };
  }

  return {
    message: getErrorMessage(error, "Could not apply source."),
    selection: null
  };
}

function getJsonSyntaxErrorLocation(
  input: string,
  error: SyntaxError
): {
  index: number;
  line: number;
  column: number;
} | null {
  const lineColumnMatch = /line\s+(\d+)\s+column\s+(\d+)/i.exec(error.message);
  if (lineColumnMatch) {
    const line = Number.parseInt(lineColumnMatch[1], 10);
    const column = Number.parseInt(lineColumnMatch[2], 10);
    const index = getIndexForLineAndColumn(input, line, column);
    if (index !== null) {
      return { index, line, column };
    }
  }

  const positionMatch = /position\s+(\d+)/i.exec(error.message);
  if (positionMatch) {
    const index = clampSelectionIndex(
      Number.parseInt(positionMatch[1], 10),
      input.length
    );

    return {
      index,
      ...getLineAndColumnForIndex(input, index)
    };
  }

  return null;
}

function getSourceEditorSelectionForIndex(
  input: string,
  index: number
): SourceEditorSelection {
  const start = clampSelectionIndex(index, input.length);
  const end = start < input.length ? start + 1 : start;

  if (start === end && start > 0) {
    return {
      start: start - 1,
      end: start
    };
  }

  return {
    start,
    end
  };
}

function getIndexForLineAndColumn(
  input: string,
  line: number,
  column: number
): number | null {
  if (line < 1 || column < 1) {
    return null;
  }

  let currentLine = 1;
  let currentColumn = 1;

  for (let index = 0; index <= input.length; index += 1) {
    if (currentLine === line && currentColumn === column) {
      return index;
    }

    if (index === input.length) {
      break;
    }

    if (input[index] === "\n") {
      currentLine += 1;
      currentColumn = 1;
    } else {
      currentColumn += 1;
    }
  }

  return null;
}

function getLineAndColumnForIndex(
  input: string,
  index: number
): {
  line: number;
  column: number;
} {
  let line = 1;
  let column = 1;

  for (let cursor = 0; cursor < index; cursor += 1) {
    if (input[cursor] === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }

  return { line, column };
}

function clampSelectionIndex(index: number, inputLength: number): number {
  return Math.max(0, Math.min(index, inputLength));
}

function getRoute(): Route {
  return window.location.hash === "#/play" ? "runtime" : "editor";
}

function navigate(route: Route): void {
  const nextHash = route === "runtime" ? "#/play" : "#/editor";
  if (window.location.hash === nextHash) {
    render();
    return;
  }

  window.location.hash = nextHash;
}

function readStoredThemePreference(): ThemePreference {
  try {
    const storedTheme = window.localStorage.getItem(themeStorageKey);
    return storedTheme === "light" || storedTheme === "dark" ? storedTheme : null;
  } catch {
    return null;
  }
}

function getActiveTheme(): Theme {
  return themePreference ?? (systemThemeMedia.matches ? "dark" : "light");
}

function getThemeBoardDefaults(theme: Theme): ThemeBoardDefaults {
  return theme === "dark"
    ? darkThemeBoardDefaults
    : {
        gridLineColor: defaultGridLineColor,
        boardBackgroundColor: defaultBoardBackgroundColor
      };
}

function applyTheme(): void {
  const activeTheme = getActiveTheme();
  document.documentElement.dataset.theme = activeTheme;
  document.documentElement.style.colorScheme = activeTheme;
}

function setThemePreference(preference: ThemePreference): void {
  const previousTheme = getActiveTheme();
  themePreference = preference;
  try {
    if (preference) {
      window.localStorage.setItem(themeStorageKey, preference);
    } else {
      window.localStorage.removeItem(themeStorageKey);
    }
  } catch {
    // Ignore storage persistence failures and still apply the chosen theme in-memory.
  }

  applyTheme();
  syncBoardSetupDraftThemeDefaults(previousTheme, getActiveTheme());
  render();
}

function handleSystemThemeChange(): void {
  if (themePreference !== null) {
    return;
  }

  const previousTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  applyTheme();
  syncBoardSetupDraftThemeDefaults(previousTheme, getActiveTheme());
  render();
}

function readStoredEditorSessionDraft(): StoredEditorSessionDraft | null {
  try {
    const storedDraft = window.localStorage.getItem(editorSessionDraftStorageKey);
    if (!storedDraft) {
      return null;
    }

    const parsedDraft = parseStoredEditorSessionDraft(JSON.parse(storedDraft));
    if (!parsedDraft || !shouldRecoverEditorSessionDraft(parsedDraft)) {
      window.localStorage.removeItem(editorSessionDraftStorageKey);
      return null;
    }

    return parsedDraft;
  } catch {
    try {
      window.localStorage.removeItem(editorSessionDraftStorageKey);
    } catch {
      // Ignore storage failures and keep booting with an empty in-memory session.
    }
    return null;
  }
}

function parseStoredEditorSessionDraft(value: unknown): StoredEditorSessionDraft | null {
  if (
    !isRecord(value) ||
    (value.version !== 1 && value.version !== 2) ||
    typeof value.dirty !== "boolean"
  ) {
    return null;
  }

  try {
    const { scenario: parsedScenario, migrated } = loadScenarioWithMeta(
      JSON.stringify(value.scenario)
    );

    return {
      version: 2,
      scenario: parsedScenario,
      boardSetupDraft:
        parseStoredBoardSetupDraft(value.boardSetupDraft) ??
        createDefaultBoardSetupDraft(getActiveTheme()),
      dirty: value.dirty || migrated,
      currentFilePath: typeof value.currentFilePath === "string" ? value.currentFilePath : null,
      sourceDraft:
        typeof value.sourceDraft === "string"
          ? value.sourceDraft
          : scenarioToJson(parsedScenario)
    };
  } catch {
    return null;
  }
}

function parseStoredBoardSetupDraft(value: unknown): BoardSetupDraft | null {
  if (!isRecord(value) || !isScenarioSpaceType(value.type)) {
    return null;
  }

  const requiredStringKeys: Array<keyof BoardSetupDraft> = [
    "widthValue",
    "heightValue",
    "tileSizeValue",
    "distancePerTileValue",
    "scaleUnitValue",
    "gridLineColorValue",
    "gridLineOpacityValue",
    "backgroundColorValue",
    "freeXValue",
    "freeYValue",
    "freeWidthValue",
    "freeHeightValue",
    "freeDistancePerWorldUnitValue",
    "freeScaleUnitValue",
    "freeBackgroundColorValue"
  ];

  if (
    requiredStringKeys.some((key) => typeof value[key] !== "string") ||
    typeof value.tileSizeEdited !== "boolean"
  ) {
    return null;
  }

  return {
    type: value.type,
    widthValue: value.widthValue as string,
    heightValue: value.heightValue as string,
    tileSizeValue: value.tileSizeValue as string,
    distancePerTileValue: value.distancePerTileValue as string,
    scaleUnitValue: value.scaleUnitValue as string,
    gridLineColorValue: value.gridLineColorValue as string,
    gridLineOpacityValue: value.gridLineOpacityValue as string,
    backgroundColorValue: value.backgroundColorValue as string,
    freeXValue: value.freeXValue as string,
    freeYValue: value.freeYValue as string,
    freeWidthValue: value.freeWidthValue as string,
    freeHeightValue: value.freeHeightValue as string,
    freeDistancePerWorldUnitValue: value.freeDistancePerWorldUnitValue as string,
    freeScaleUnitValue: value.freeScaleUnitValue as string,
    freeBackgroundColorValue: value.freeBackgroundColorValue as string,
    tileSizeEdited: value.tileSizeEdited as boolean
  };
}

function syncEditorSessionDraft(): void {
  try {
    if (!shouldPersistEditorSessionDraft()) {
      window.localStorage.removeItem(editorSessionDraftStorageKey);
      return;
    }

    const storedDraft: StoredEditorSessionDraft = {
      version: 2,
      scenario,
      boardSetupDraft,
      dirty,
      currentFilePath: getCurrentFilePath(),
      sourceDraft
    };
    window.localStorage.setItem(editorSessionDraftStorageKey, JSON.stringify(storedDraft));
  } catch {
    // Ignore storage persistence failures and keep the session usable in-memory.
  }
}

function shouldPersistEditorSessionDraft(): boolean {
  return dirty || hasRecoverableBoardSetupDraft(scenario, boardSetupDraft) || hasPendingSourceEdits();
}

function shouldRecoverEditorSessionDraft(draft: StoredEditorSessionDraft): boolean {
  return (
    draft.dirty ||
    hasRecoverableBoardSetupDraft(draft.scenario, draft.boardSetupDraft) ||
    hasPendingSourceEditsForScenario(draft.scenario, draft.sourceDraft)
  );
}

function hasRecoverableBoardSetupDraft(
  scenarioValue: Scenario,
  boardSetupDraftValue: BoardSetupDraft
): boolean {
  return (
    !scenarioValue.space &&
    !boardSetupDraftMatches(
      boardSetupDraftValue,
      createDefaultBoardSetupDraft(getActiveTheme())
    )
  );
}

function syncBoardSetupDraftThemeDefaults(previousTheme: Theme, nextTheme: Theme): void {
  if (previousTheme === nextTheme) {
    return;
  }

  const previousDefaults = getThemeBoardDefaults(previousTheme);
  const nextDefaults = getThemeBoardDefaults(nextTheme);
  boardSetupDraft = {
    ...boardSetupDraft,
    gridLineColorValue: replaceDefaultThemeColor(
      boardSetupDraft.gridLineColorValue,
      previousDefaults.gridLineColor,
      nextDefaults.gridLineColor
    ),
    backgroundColorValue: replaceDefaultThemeColor(
      boardSetupDraft.backgroundColorValue,
      previousDefaults.boardBackgroundColor,
      nextDefaults.boardBackgroundColor
    ),
    freeBackgroundColorValue: replaceDefaultThemeColor(
      boardSetupDraft.freeBackgroundColorValue,
      previousDefaults.boardBackgroundColor,
      nextDefaults.boardBackgroundColor
    )
  };
}

function getSelectedMarker(): Scenario["pieces"][number] | null {
  if (!selectedMarkerId) {
    return null;
  }

  return scenario.pieces.find((piece) => piece.id === selectedMarkerId) ?? null;
}

function syncSelectedMarkerWithScenario(): void {
  if (!scenario.space || !getSelectedMarker()) {
    selectedMarkerId = null;
  }
}

function getAppliedSourceText(value: Scenario = scenario): string {
  return scenarioToJson(value);
}

function hasPendingSourceEdits(): boolean {
  return hasPendingSourceEditsForScenario(scenario, sourceDraft);
}

function hasPendingSourceEditsForScenario(
  scenarioValue: Scenario,
  sourceDraftValue: string
): boolean {
  return sourceDraftValue !== getAppliedSourceText(scenarioValue);
}

function syncSourceDraftWithScenario(previousScenario: Scenario): void {
  if (!hasPendingSourceEditsForScenario(previousScenario, sourceDraft)) {
    sourceDraft = getAppliedSourceText();
    clearSourceEditorError();
  }
}

function replaceDefaultThemeColor(
  currentValue: string,
  previousDefault: string,
  nextDefault: string
): string {
  return currentValue === previousDefault ? nextDefault : currentValue;
}

function boardSetupDraftMatches(
  left: BoardSetupDraft,
  right: BoardSetupDraft
): boolean {
  return (
    left.type === right.type &&
    left.widthValue === right.widthValue &&
    left.heightValue === right.heightValue &&
    left.tileSizeValue === right.tileSizeValue &&
    left.distancePerTileValue === right.distancePerTileValue &&
    left.scaleUnitValue === right.scaleUnitValue &&
    left.gridLineColorValue === right.gridLineColorValue &&
    left.gridLineOpacityValue === right.gridLineOpacityValue &&
    left.backgroundColorValue === right.backgroundColorValue &&
    left.freeXValue === right.freeXValue &&
    left.freeYValue === right.freeYValue &&
    left.freeWidthValue === right.freeWidthValue &&
    left.freeHeightValue === right.freeHeightValue &&
    left.freeDistancePerWorldUnitValue === right.freeDistancePerWorldUnitValue &&
    left.freeScaleUnitValue === right.freeScaleUnitValue &&
    left.freeBackgroundColorValue === right.freeBackgroundColorValue &&
    left.tileSizeEdited === right.tileSizeEdited
  );
}

function editorSnapshotsEqual(left: EditorSnapshot, right: EditorSnapshot): boolean {
  return (
    left.selectedMarkerId === right.selectedMarkerId &&
    scenariosEqual(left.scenario, right.scenario) &&
    boardSetupDraftMatches(left.boardSetupDraft, right.boardSetupDraft)
  );
}

function scenariosEqual(left: Scenario, right: Scenario): boolean {
  return scenarioToJson(left) === scenarioToJson(right);
}

async function confirmDiscardUnsavedChanges(): Promise<boolean> {
  if (!dirty && !hasPendingSourceEdits()) {
    return true;
  }

  if (!isTauri()) {
    return window.confirm("Discard unsaved changes?");
  }

  return confirmDialog("Discard unsaved changes?", {
    kind: "warning",
    title: "Unsaved Changes"
  });
}

function labeledInput(
  labelText: string,
  value: string,
  onChange: (value: string) => void,
  testId?: string
): HTMLElement {
  const label = element("label", "field-label");
  const text = element("span", "", labelText);
  const input = document.createElement("input");
  input.value = value;
  if (testId) {
    input.dataset.testid = testId;
  }
  input.addEventListener("change", () => onChange(input.value.trim()));
  label.append(text, input);
  return label;
}

function numberInput(
  labelText: string,
  value: string,
  testId: string,
  options: {
    min?: string;
    max?: string;
    step?: string;
  } = {}
): {
  label: HTMLElement;
  input: HTMLInputElement;
} {
  const label = element("label", "field-label");
  const text = element("span", "", labelText);
  const input = document.createElement("input");
  input.type = "number";
  input.min = options.min ?? "1";
  if (options.max) {
    input.max = options.max;
  }
  input.step = options.step ?? "1";
  input.value = value;
  input.dataset.testid = testId;
  label.append(text, input);
  return { label, input };
}

function textInput(labelText: string, value: string, testId: string): {
  label: HTMLElement;
  input: HTMLInputElement;
} {
  const label = element("label", "field-label");
  const text = element("span", "", labelText);
  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  input.dataset.testid = testId;
  label.append(text, input);
  return { label, input };
}

function colorInput(labelText: string, value: string, testId: string): {
  label: HTMLElement;
  input: HTMLInputElement;
} {
  const label = element("label", "field-label color-field");
  const text = element("span", "", labelText);
  const input = document.createElement("input");
  input.type = "color";
  input.value = value;
  input.dataset.testid = testId;
  label.append(text, input);
  return { label, input };
}

function spaceOption(
  labelText: string,
  type: ScenarioSpaceType,
  checked: boolean
): {
  label: HTMLElement;
  input: HTMLInputElement;
  type: ScenarioSpaceType;
} {
  const label = element("label", "space-option");
  const input = document.createElement("input");
  const text = element("span", "", labelText);
  input.type = "radio";
  input.name = "space-type";
  input.value = type;
  input.checked = checked;
  input.dataset.testid = `space-${type}`;
  label.append(input, text);
  return { label, input, type };
}

function metric(label: string, value: string, testId?: string): HTMLElement {
  const item = element("div", "metric");
  const valueElement = element("strong", "", value);
  valueElement.title = value;
  if (testId) {
    valueElement.dataset.testid = testId;
  }
  item.append(element("span", "", label), valueElement);
  return item;
}

function getCommand(commandId: EditorCommandId): EditorCommand {
  const command = commandRegistry?.[commandId];
  if (!command) {
    throw new Error(`Missing command: ${commandId}`);
  }

  return command;
}

function getCommandTestId(commandId: EditorCommandId): string {
  return `${commandId}-scenario`;
}

function getMenuCommandTestId(commandId: EditorCommandId): string {
  return `menu-${getCommandTestId(commandId)}`;
}

function getCommandLabel(commandId: EditorCommandId): string {
  return getCommand(commandId).label;
}

function getCommandShortcuts(commandId: EditorCommandId): string[] {
  const command = getCommand(commandId);
  const shortcuts = command.shortcut ? [command.shortcut] : [];
  if (commandId === "redo" && !isMacPlatform()) {
    shortcuts.push("Mod+Y");
  }

  return shortcuts;
}

function getCommandTitle(commandId: EditorCommandId): string {
  const shortcuts = getCommandShortcuts(commandId);
  if (shortcuts.length === 0) {
    return getCommandLabel(commandId);
  }

  return `${getCommandLabel(commandId)} (${formatShortcutHints(shortcuts)})`;
}

function formatShortcutHints(shortcuts: ReadonlyArray<string>): string {
  return shortcuts.map((shortcut) => formatShortcutHint(shortcut)).join(" / ");
}

function formatShortcutAriaSet(shortcuts: ReadonlyArray<string>): string {
  return shortcuts.map((shortcut) => formatShortcutAria(shortcut)).join(" ");
}

function formatShortcutHint(shortcut: string): string {
  const modifierLabel = isMacPlatform() ? "Cmd" : "Ctrl";

  return shortcut
    .split("+")
    .map((part) => {
      if (part === "Mod") {
        return modifierLabel;
      }

      return part.length === 1 ? part.toUpperCase() : part;
    })
    .join("+");
}

function formatShortcutAria(shortcut: string): string {
  const modifierLabel = isMacPlatform() ? "Meta" : "Control";

  return shortcut
    .split("+")
    .map((part) => {
      if (part === "Mod") {
        return modifierLabel;
      }

      return part.length === 1 ? part.toUpperCase() : part;
    })
    .join("+");
}

function isMacPlatform(): boolean {
  return navigator.platform.toLowerCase().includes("mac");
}

function buttonElement(
  label: string,
  onClick: () => void | Promise<void>,
  testId?: string,
  disabled = false
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "action-button";
  button.textContent = label;
  button.disabled = disabled;
  button.addEventListener("click", () => {
    const result = onClick();
    if (result instanceof Promise) {
      void result.catch((error) => {
        statusMessage = getErrorMessage(error, "Action failed.");
        render();
      });
    }
  });
  if (testId) {
    button.dataset.testid = testId;
  }
  return button;
}

function getBoardLabel(): string {
  if (!scenario.space) {
    return "Not set";
  }

  if (!isTileScenarioSpace(scenario.space)) {
    const bounds = scenario.space.bounds;
    const scale = `${scenario.space.scale.distancePerWorldUnit} ${scenario.space.scale.unit}/unit`;

    return `${bounds.width} x ${bounds.height} free @ ${bounds.x},${bounds.y}, ${scale}`;
  }

  const gridType = scenario.space.type === "hex-grid" ? "hex" : "square";
  const scale = `${scenario.space.scale.distancePerTile} ${scenario.space.scale.unit}/tile`;

  return `${scenario.space.width} x ${scenario.space.height} ${gridType}, ${scenario.space.tileSize}px, ${scale}`;
}

function getMarkerPositionLabel(piece: Scenario["pieces"][number]): string {
  if (scenario.space && isTileScenarioSpace(scenario.space)) {
    return `Tile ${piece.x}, ${piece.y}`;
  }

  return `${formatCoordinate(piece.x)}, ${formatCoordinate(piece.y)}`;
}

function getDocumentState(): string {
  if (dirty || hasPendingSourceEdits()) {
    return "Unsaved changes";
  }

  if (getCurrentFilePath() || scenario.metadata.savedAt) {
    return "Saved";
  }

  return "New scenario";
}

function resetBoardViewportStates(): void {
  resetBoardViewportState(boardViewportStates.editor);
  resetBoardViewportState(boardViewportStates.runtime);
}

function getScenarioBoardKey(value: Scenario): string | null {
  if (!value.space) {
    return null;
  }

  if (!isTileScenarioSpace(value.space)) {
    const bounds = value.space.bounds;

    return `${value.space.type}:${bounds.x},${bounds.y}:${bounds.width}x${bounds.height}`;
  }

  return `${value.space.type}:${value.space.width}x${value.space.height}:${value.space.tileSize}`;
}

function parseFiniteNumber(value: string): number | null {
  const number = Number.parseFloat(value);

  return Number.isFinite(number) ? number : null;
}

function parsePositiveNumber(value: string): number | null {
  const number = Number.parseFloat(value);

  return Number.isFinite(number) && number > 0 ? number : null;
}

function parseOpacity(value: string): number | null {
  const opacity = Number.parseFloat(value);

  return Number.isFinite(opacity) && opacity >= 0 && opacity <= 1 ? opacity : null;
}

function parseHexColor(value: string): string | null {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : null;
}

function getTileSpaceLabel(type: ScenarioTileSpaceType): string {
  return type === "hex-grid" ? "Hex grid" : "Square grid";
}

function isTileSetupType(type: ScenarioSpaceType): type is ScenarioTileSpaceType {
  return type === "square-grid" || type === "hex-grid";
}

function isScenarioSpaceType(value: unknown): value is ScenarioSpaceType {
  return value === "square-grid" || value === "hex-grid" || value === "free-coordinate";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function formatCoordinate(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}

function cloneScenarioValue(value: Scenario): Scenario {
  return {
    ...value,
    space: cloneScenarioSpaceValue(value.space),
    assets: value.assets.map((asset) => ({ ...asset })),
    pieces: value.pieces.map((piece) => ({ ...piece })),
    metadata: {
      ...value.metadata
    }
  };
}

function cloneScenarioSpaceValue(space: Scenario["space"]): Scenario["space"] {
  if (!space) {
    return null;
  }

  if (isTileScenarioSpace(space)) {
    return {
      ...space,
      scale: {
        ...space.scale
      },
      grid: {
        ...space.grid
      },
      background: {
        ...space.background
      }
    };
  }

  return {
    ...space,
    bounds: {
      ...space.bounds
    },
    scale: {
      ...space.scale
    },
    background: {
      ...space.background
    }
  };
}

function cloneBoardSetupDraftValue(value: BoardSetupDraft): BoardSetupDraft {
  return {
    ...value
  };
}

function createDefaultBoardSetupDraft(theme: Theme = getActiveTheme()): BoardSetupDraft {
  const themeBoardDefaults = getThemeBoardDefaults(theme);

  return {
    type: "square-grid",
    widthValue: "8",
    heightValue: "8",
    tileSizeValue: String(getDefaultTileSize("square-grid")),
    distancePerTileValue: String(defaultScaleDistancePerTile),
    scaleUnitValue: defaultScaleUnit,
    gridLineColorValue: themeBoardDefaults.gridLineColor,
    gridLineOpacityValue: String(defaultGridLineOpacity),
    backgroundColorValue: themeBoardDefaults.boardBackgroundColor,
    freeXValue: "0",
    freeYValue: "0",
    freeWidthValue: "100",
    freeHeightValue: "100",
    freeDistancePerWorldUnitValue: String(defaultFreeCoordinateDistancePerWorldUnit),
    freeScaleUnitValue: defaultFreeCoordinateScaleUnit,
    freeBackgroundColorValue: themeBoardDefaults.boardBackgroundColor,
    tileSizeEdited: false
  };
}

function element<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className = "",
  textContent?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tagName);
  if (className) {
    node.className = className;
  }
  if (textContent !== undefined) {
    node.textContent = textContent;
  }
  return node;
}
