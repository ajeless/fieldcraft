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
  isTileScenarioSpace,
  maxFreeCoordinateBoardSize,
  maxTileGridSize,
  parseScenario,
  scenarioToJson
} from "./scenario";
import {
  type ScenarioStorageResult,
  clearCurrentFilePath,
  getCurrentFilePath,
  getFileLabel,
  getSaveAsLabel,
  getStorageModeLabel,
  openBrowserScenarioFile,
  openScenarioFile,
  rememberScenario,
  saveScenarioFile,
  saveScenarioFileAs,
  setCurrentFilePath
} from "./storage";

type Route = "editor" | "runtime";

type EditorCommandId =
  | "new"
  | "open"
  | "save"
  | "save-as"
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
  version: 1;
  scenario: Scenario;
  boardSetupDraft: BoardSetupDraft;
  dirty: boolean;
  currentFilePath: string | null;
};

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
let selectedMarkerId: string | null = null;
let commandRegistry: EditorCommands | null = null;
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

  header.append(brand, menuBar, themeSwitch, routeSwitch);
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
  const sidebarItems: HTMLElement[] = [
    element("p", "eyebrow", "Scenario"),
    labeledInput("Title", scenario.title, (value) => {
      scenario = { ...scenario, title: value || createEmptyScenario().title };
      dirty = true;
      render();
    }),
    metric("Board", getBoardLabel()),
    metric("Markers", String(scenario.pieces.length), "marker-count"),
    metric("File", getFileLabel(), "current-file")
  ];
  if (scenario.space) {
    sidebarItems.push(createMarkerPalette());
  }
  sidebarItems.push(createActionStack());
  sidebar.append(...sidebarItems);

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
  inspector.append(element("pre", "scenario-preview", scenarioToJson(scenario)));

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
  menuBar.append(createMenu("File", "file", ["new", "open", "separator", "save", "save-as"]));
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
  const button = document.createElement("button");
  const label = element("span", "menu-item-label", command.label);
  const shortcut = command.shortcut
    ? element("span", "menu-item-shortcut", formatShortcutHint(command.shortcut))
    : null;
  button.type = "button";
  button.className = "menu-item";
  button.disabled = !command.enabled;
  button.dataset.testid = getMenuCommandTestId(commandId);
  button.title = getCommandTitle(commandId);
  if (command.shortcut) {
    button.setAttribute("aria-keyshortcuts", formatShortcutAria(command.shortcut));
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

  if (isDeleteSelectionKeyEvent(event)) {
    const deleteCommand = commandRegistry["delete-selected-marker"];
    if (deleteCommand?.enabled) {
      event.preventDefault();
      executeCommand(deleteCommand);
    }
    return;
  }

  const command = findCommandByShortcut(commandRegistry, event);
  if (!command) {
    return;
  }

  event.preventDefault();
  executeCommand(command);
}

function isDeleteSelectionKeyEvent(event: KeyboardEvent): boolean {
  if (event.key === "Delete") {
    return true;
  }

  return event.key === "Backspace" && !isEditableEventTarget(event.target);
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

function createRuntimeView(): HTMLElement {
  const view = element("section", "workspace runtime-workspace");
  view.dataset.view = "runtime";

  const sidebar = element("aside", "panel left-panel");
  sidebar.append(
    element("p", "eyebrow", "Runtime"),
    element("h1", "runtime-title", scenario.title),
    metric("Board", getBoardLabel()),
    metric("Markers", String(scenario.pieces.length))
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

function createActionStack(): HTMLElement {
  const actions = element("div", "action-stack");
  const status = element("p", "status-line", statusMessage);
  status.title = statusMessage;

  actions.append(
    commandActionButton("new"),
    commandActionButton("open"),
    commandActionButton("save"),
    commandActionButton("save-as"),
    status
  );

  return actions;
}

function commandActionButton(commandId: EditorCommandId): HTMLButtonElement {
  const command = getCommand(commandId);
  const button = buttonElement(
    getSidebarCommandLabel(commandId),
    () => executeCommandById(commandId),
    getCommandTestId(commandId),
    !command.enabled
  );
  button.title = getCommandTitle(commandId);
  if (command.shortcut) {
    button.setAttribute("aria-keyshortcuts", formatShortcutAria(command.shortcut));
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

  return createBoardViewport({
    mode: options.mode,
    readonly: options.readonly,
    space,
    pieces: scenario.pieces,
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
    "action-button destructive-action"
  );

  section.append(element("p", "eyebrow", "Selection"));
  if (!scenario.space) {
    const empty = element(
      "p",
      "inspector-empty",
      "Create a board and place a marker to inspect it."
    );
    empty.dataset.testid = "selected-marker-empty";
    section.append(empty, deleteButton);
    return section;
  }

  if (!selectedMarker) {
    const empty = element("p", "inspector-empty", "No marker selected.");
    empty.dataset.testid = "selected-marker-empty";
    section.append(empty, deleteButton);
    return section;
  }

  section.append(
    metric("Kind", "Marker", "selected-marker-kind"),
    metric("Id", selectedMarker.id, "selected-marker-id"),
    metric("Position", getMarkerPositionLabel(selectedMarker), "selected-marker-position"),
    deleteButton
  );

  return section;
}

function createMarkerPalette(): HTMLElement {
  const palette = element("section", "marker-palette");
  const marker = document.createElement("button");
  const swatch = element("span", "palette-marker-swatch");
  const label = element("span", "palette-marker-label", "Marker");

  marker.type = "button";
  marker.className = "palette-marker";
  marker.draggable = true;
  marker.dataset.testid = "palette-marker";
  marker.setAttribute("aria-label", "Default marker");
  marker.title = "Default marker";
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
  marker.append(swatch, label);
  palette.append(element("p", "eyebrow", "Palette"), marker);
  return palette;
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
  className: string
): HTMLButtonElement {
  const command = getCommand(commandId);
  const button = buttonElement(
    command.label,
    () => executeCommandById(commandId),
    testId,
    !command.enabled
  );
  button.className = className;
  button.title = command.label;
  return button;
}

function handleSelectedMarkerChange(pieceId: string | null): void {
  if (selectedMarkerId === pieceId) {
    return;
  }

  selectedMarkerId = pieceId;
  render();
}

function deleteSelectedMarker(): void {
  const selectedMarker = getSelectedMarker();
  if (!selectedMarker) {
    return;
  }

  scenario = {
    ...scenario,
    pieces: scenario.pieces.filter((piece) => piece.id !== selectedMarker.id)
  };
  selectedMarkerId = null;
  dirty = true;
  statusMessage = "Marker deleted";
  render();
}

function placeDefaultMarker(x: number, y: number): void {
  if (!scenario.space) {
    return;
  }

  const existing = scenario.pieces.find((piece) => piece.x === x && piece.y === y);
  if (existing) {
    selectedMarkerId = existing.id;
    statusMessage = "Marker already present";
    render();
    return;
  }

  const markerId = createMarkerId(x, y);

  scenario = {
    ...scenario,
    pieces: [
      ...scenario.pieces,
      {
        id: markerId,
        kind: "marker" as const,
        side: "neutral" as const,
        x,
        y
      }
    ]
  };
  selectedMarkerId = markerId;
  dirty = true;
  statusMessage = "Marker placed";
  render();
}

async function createNewScenario(): Promise<void> {
  if (!(await confirmDiscardUnsavedChanges())) {
    return;
  }

  scenario = createEmptyScenario();
  selectedMarkerId = null;
  clearCurrentFilePath();
  resetBoardViewportStates();
  boardSetupDraft = createDefaultBoardSetupDraft();
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

  const width = parseGridSize(options.widthValue);
  const height = parseGridSize(options.heightValue);
  const tileSize = parseTileSize(options.tileSizeValue);
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
  dirty = true;
  statusMessage = `${getTileSpaceLabel(options.type)} created: ${width} x ${height}`;
  render();
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
  const width = parseFreeCoordinateBoardSize(options.widthValue);
  const height = parseFreeCoordinateBoardSize(options.heightValue);
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
  dirty = true;
  statusMessage = `Free-coordinate board created: ${width} x ${height}`;
  render();
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

function applyStorageResult(result: ScenarioStorageResult | null): void {
  if (!result) {
    return;
  }

  const previousBoardKey = getScenarioBoardKey(scenario);
  let shouldResetViewport = false;

  if (result.scenario) {
    scenario = result.scenario;
    selectedMarkerId = null;
    if (!scenario.space) {
      boardSetupDraft = createDefaultBoardSetupDraft(getActiveTheme());
    }
    shouldResetViewport =
      previousBoardKey !== getScenarioBoardKey(scenario) ||
      result.statusMessage.startsWith("Opened ") ||
      result.statusMessage.startsWith("Loaded ");
  }
  if (result.dirty !== undefined) {
    dirty = result.dirty;
  }
  if (shouldResetViewport) {
    resetBoardViewportStates();
  }
  statusMessage = result.statusMessage;
  render();
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
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
  if (!isRecord(value) || value.version !== 1 || typeof value.dirty !== "boolean") {
    return null;
  }

  try {
    return {
      version: 1,
      scenario: parseScenario(JSON.stringify(value.scenario)),
      boardSetupDraft:
        parseStoredBoardSetupDraft(value.boardSetupDraft) ??
        createDefaultBoardSetupDraft(getActiveTheme()),
      dirty: value.dirty,
      currentFilePath: typeof value.currentFilePath === "string" ? value.currentFilePath : null
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
      version: 1,
      scenario,
      boardSetupDraft,
      dirty,
      currentFilePath: getCurrentFilePath()
    };
    window.localStorage.setItem(editorSessionDraftStorageKey, JSON.stringify(storedDraft));
  } catch {
    // Ignore storage persistence failures and keep the session usable in-memory.
  }
}

function shouldPersistEditorSessionDraft(): boolean {
  return dirty || hasRecoverableBoardSetupDraft(scenario, boardSetupDraft);
}

function shouldRecoverEditorSessionDraft(draft: StoredEditorSessionDraft): boolean {
  return draft.dirty || hasRecoverableBoardSetupDraft(draft.scenario, draft.boardSetupDraft);
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

async function confirmDiscardUnsavedChanges(): Promise<boolean> {
  if (!dirty) {
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
  onChange: (value: string) => void
): HTMLElement {
  const label = element("label", "field-label");
  const text = element("span", "", labelText);
  const input = document.createElement("input");
  input.value = value;
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

function getSidebarCommandLabel(commandId: EditorCommandId): string {
  const command = getCommand(commandId);
  if (commandId === "save-as") {
    return command.label;
  }

  return `${command.label} Scenario`;
}

function getCommandTitle(commandId: EditorCommandId): string {
  const command = getCommand(commandId);
  if (!command.shortcut) {
    return getSidebarCommandLabel(commandId);
  }

  return `${getSidebarCommandLabel(commandId)} (${formatShortcutHint(command.shortcut)})`;
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
  if (dirty) {
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

function parseGridSize(value: string): number | null {
  const size = Number.parseInt(value, 10);

  if (!Number.isInteger(size) || size < 1 || size > maxTileGridSize) {
    return null;
  }

  return size;
}

function parseTileSize(value: string): number | null {
  const size = Number.parseFloat(value);

  if (!Number.isFinite(size) || size < 8 || size > 160) {
    return null;
  }

  return size;
}

function parseFiniteNumber(value: string): number | null {
  const number = Number.parseFloat(value);

  return Number.isFinite(number) ? number : null;
}

function parseFreeCoordinateBoardSize(value: string): number | null {
  const size = Number.parseFloat(value);

  if (!Number.isFinite(size) || size <= 0 || size > maxFreeCoordinateBoardSize) {
    return null;
  }

  return size;
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

function createMarkerId(x: number, y: number): string {
  if (Number.isInteger(x) && Number.isInteger(y)) {
    return `marker-${x}-${y}`;
  }

  return `marker-${formatCoordinateForId(x)}-${formatCoordinateForId(y)}`;
}

function formatCoordinateForId(value: number): string {
  return String(value).replace("-", "neg").replace(".", "p");
}

function formatCoordinate(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
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
