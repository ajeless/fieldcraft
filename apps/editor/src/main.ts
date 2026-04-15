import "./styles.css";
import {
  type BoardViewportState,
  createBoardViewport,
  createBoardViewportState,
  markerDragDataType,
  resetBoardViewportState
} from "./board-viewport";
import {
  type Scenario,
  type ScenarioTileSpaceType,
  createEmptyScenario,
  createTileScenarioSpace,
  defaultBoardBackgroundColor,
  defaultGridLineColor,
  defaultGridLineOpacity,
  defaultScaleDistancePerTile,
  defaultScaleUnit,
  getDefaultTileSize,
  isTileScenarioSpace,
  maxTileGridSize,
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
  saveScenarioFileAs
} from "./storage";

type Route = "editor" | "runtime";

type BoardSetupDraft = {
  type: ScenarioTileSpaceType;
  widthValue: string;
  heightValue: string;
  tileSizeValue: string;
  distancePerTileValue: string;
  scaleUnitValue: string;
  gridLineColorValue: string;
  gridLineOpacityValue: string;
  backgroundColorValue: string;
  tileSizeEdited: boolean;
};

const appRoot = document.querySelector<HTMLDivElement>("#app");

if (!appRoot) {
  throw new Error("Missing #app root.");
}

const app = appRoot;
let scenario = createEmptyScenario();
let dirty = false;
let statusMessage = "Ready";
let boardSetupDraft = createDefaultBoardSetupDraft();
const boardViewportStates: Record<Route, BoardViewportState> = {
  editor: createBoardViewportState(),
  runtime: createBoardViewportState()
};

window.addEventListener("hashchange", render);

render();

function render(): void {
  app.innerHTML = "";
  app.append(createShell(getRoute()));
}

function createShell(route: Route): HTMLElement {
  const shell = element("main", "shell");
  const header = element("header", "topbar");
  const brand = element("div", "brand");
  brand.append(element("span", "brand-mark", "FC"), element("strong", "", "Fieldcraft"));

  const routeSwitch = element("nav", "route-switch");
  routeSwitch.setAttribute("aria-label", "Mode");
  routeSwitch.append(
    modeButton("Editor", "editor", route),
    modeButton("Runtime", "runtime", route)
  );

  header.append(brand, routeSwitch);
  shell.append(header, route === "runtime" ? createRuntimeView() : createEditorView());
  return shell;
}

function modeButton(label: string, targetRoute: Route, activeRoute: Route): HTMLButtonElement {
  const button = buttonElement(label, () => navigate(targetRoute));
  button.className = targetRoute === activeRoute ? "mode-button active" : "mode-button";
  button.type = "button";
  return button;
}

function createEditorView(): HTMLElement {
  const view = element("section", "workspace");
  view.dataset.view = "editor";

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
  if (isTileScenarioSpace(scenario.space)) {
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
          onMarkerDrop: placeDefaultMarker
        })
      : createBoardSetup()
  );

  const inspector = element("aside", "panel right-panel");
  const savedAt = scenario.metadata.savedAt
    ? new Date(scenario.metadata.savedAt).toLocaleString()
    : "Not saved";
  const currentFilePath = getCurrentFilePath();
  inspector.append(
    element("p", "eyebrow", "Saved Game"),
    metric("State", getDocumentState()),
    metric("Mode", getStorageModeLabel()),
    metric("Last Save", savedAt)
  );
  if (currentFilePath) {
    inspector.append(metric("Path", currentFilePath));
  }
  inspector.append(element("pre", "scenario-preview", scenarioToJson(scenario)));

  view.append(sidebar, boardStage, inspector);
  return view;
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
    buttonElement("Close Runtime", () => navigate("editor"), "close-runtime")
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

  const status = element("p", "status-line", statusMessage);
  status.title = statusMessage;

  actions.append(
    buttonElement("New Scenario", createNewScenario, "new-scenario"),
    buttonElement("Open Scenario", () => openScenario(fileInput), "open-scenario"),
    buttonElement("Save Scenario", saveScenario, "save-scenario"),
    buttonElement(getSaveAsLabel(), saveScenarioAs, "save-as-scenario"),
    buttonElement("Launch Runtime", () => {
      rememberScenario(scenario);
      navigate("runtime");
    }, "launch-runtime", !isTileScenarioSpace(scenario.space)),
    fileInput,
    status
  );

  return actions;
}

function createBoard(options: {
  readonly: boolean;
  mode: Route;
  state: BoardViewportState;
  onMarkerDrop?: (x: number, y: number) => void;
}): HTMLElement {
  const space = scenario.space;
  if (!isTileScenarioSpace(space)) {
    return createBlankBoardMessage();
  }

  return createBoardViewport({
    mode: options.mode,
    readonly: options.readonly,
    space,
    pieces: scenario.pieces,
    state: options.state,
    onMarkerDrop: options.onMarkerDrop
  });
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
  const squareOption = tileSpaceOption(
    "Square grid",
    "square-grid",
    boardSetupDraft.type === "square-grid"
  );
  const hexOption = tileSpaceOption(
    "Hex grid",
    "hex-grid",
    boardSetupDraft.type === "hex-grid"
  );
  const spaceChoice = element("fieldset", "space-choice");
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
      type: hexOption.input.checked ? "hex-grid" : "square-grid",
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
  for (const option of [squareOption, hexOption]) {
    option.input.addEventListener("change", () => {
      if (!boardSetupDraft.tileSizeEdited && option.input.checked) {
        tileSizeInput.input.value = String(getDefaultTileSize(option.type));
      }
      updateDraft();
    });
  }

  spaceChoice.append(
    element("legend", "", "Space"),
    squareOption.label,
    hexOption.label
  );
  setup.append(
    element("p", "eyebrow", "New Board"),
    spaceChoice,
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
          type: hexOption.input.checked ? "hex-grid" : "square-grid",
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

function placeDefaultMarker(x: number, y: number): void {
  if (!isTileScenarioSpace(scenario.space)) {
    return;
  }

  const existing = scenario.pieces.find((piece) => piece.x === x && piece.y === y);
  if (existing) {
    statusMessage = "Marker already present";
    render();
    return;
  }

  scenario = {
    ...scenario,
    pieces: [
      ...scenario.pieces,
      {
        id: `marker-${x}-${y}`,
        kind: "marker" as const,
        side: "neutral" as const,
        x,
        y
      }
    ]
  };
  dirty = true;
  statusMessage = "Marker placed";
  render();
}

function createNewScenario(): void {
  scenario = createEmptyScenario();
  clearCurrentFilePath();
  resetBoardViewportStates();
  boardSetupDraft = createDefaultBoardSetupDraft();
  dirty = false;
  statusMessage = "New blank scenario";
  navigate("editor");
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
    ...options,
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
  resetBoardViewportStates();
  dirty = true;
  statusMessage = `${getTileSpaceLabel(options.type)} created: ${width} x ${height}`;
  render();
}

async function openScenario(fileInput: HTMLInputElement): Promise<void> {
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
    if (!scenario.space) {
      boardSetupDraft = createDefaultBoardSetupDraft();
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
  window.location.hash = route === "runtime" ? "#/play" : "#/editor";
  render();
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

function tileSpaceOption(
  labelText: string,
  type: ScenarioTileSpaceType,
  checked: boolean
): {
  label: HTMLElement;
  input: HTMLInputElement;
  type: ScenarioTileSpaceType;
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
    return `${scenario.space.bounds.width} x ${scenario.space.bounds.height} free`;
  }

  const gridType = scenario.space.type === "hex-grid" ? "hex" : "square";
  const scale = `${scenario.space.scale.distancePerTile} ${scenario.space.scale.unit}/tile`;

  return `${scenario.space.width} x ${scenario.space.height} ${gridType}, ${scenario.space.tileSize}px, ${scale}`;
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
  if (!isTileScenarioSpace(value.space)) {
    return null;
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

function createDefaultBoardSetupDraft(): BoardSetupDraft {
  return {
    type: "square-grid",
    widthValue: "8",
    heightValue: "8",
    tileSizeValue: String(getDefaultTileSize("square-grid")),
    distancePerTileValue: String(defaultScaleDistancePerTile),
    scaleUnitValue: defaultScaleUnit,
    gridLineColorValue: defaultGridLineColor,
    gridLineOpacityValue: String(defaultGridLineOpacity),
    backgroundColorValue: defaultBoardBackgroundColor,
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
