import "./styles.css";
import {
  createEmptyScenario,
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

const appRoot = document.querySelector<HTMLDivElement>("#app");

if (!appRoot) {
  throw new Error("Missing #app root.");
}

const app = appRoot;
let scenario = createEmptyScenario();
let dirty = false;
let statusMessage = "Ready";

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
  sidebar.append(
    element("p", "eyebrow", "Scenario"),
    labeledInput("Title", scenario.title, (value) => {
      scenario = { ...scenario, title: value || createEmptyScenario().title };
      dirty = true;
      render();
    }),
    metric("Board", getBoardLabel()),
    metric("Markers", String(scenario.pieces.length), "marker-count"),
    metric("File", getFileLabel(), "current-file"),
    createActionStack()
  );

  const boardStage = element("section", "board-stage");
  boardStage.append(
    element("div", "stage-header", scenario.space ? "Editor Board" : "Board Setup"),
    scenario.space
      ? createBoard({
          readonly: false,
          cellAttribute: "cell",
          onCellClick: toggleMarker
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
          cellAttribute: "runtimeCell"
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

  actions.append(
    buttonElement("New Scenario", createNewScenario, "new-scenario"),
    buttonElement("Open Scenario", () => openScenario(fileInput), "open-scenario"),
    buttonElement("Save Scenario", saveScenario, "save-scenario"),
    buttonElement(getSaveAsLabel(), saveScenarioAs, "save-as-scenario"),
    buttonElement("Launch Runtime", () => {
      rememberScenario(scenario);
      navigate("runtime");
    }, "launch-runtime", !scenario.space),
    fileInput,
    element("p", "status-line", statusMessage)
  );

  return actions;
}

function createBoard(options: {
  readonly: boolean;
  cellAttribute: "cell" | "runtimeCell";
  onCellClick?: (x: number, y: number) => void;
}): HTMLElement {
  const space = scenario.space;
  if (!space) {
    return createBlankBoardMessage();
  }

  const board = element("div", "board");
  board.style.setProperty("--grid-width", String(space.width));
  board.style.setProperty("--grid-height", String(space.height));

  const piecesByPosition = new Map(scenario.pieces.map((piece) => [`${piece.x},${piece.y}`, piece]));

  for (let y = 0; y < space.height; y += 1) {
    for (let x = 0; x < space.width; x += 1) {
      const cell = document.createElement("button");
      const piece = piecesByPosition.get(`${x},${y}`);
      cell.type = "button";
      cell.className = piece ? "board-cell occupied" : "board-cell";
      cell.disabled = options.readonly;
      cell.dataset[options.cellAttribute] = `${x}-${y}`;
      cell.setAttribute("aria-label", `Column ${x + 1}, row ${y + 1}`);

      if (piece) {
        const marker = element("span", "marker");
        marker.setAttribute("aria-hidden", "true");
        cell.append(marker);
      }

      if (!options.readonly && options.onCellClick) {
        cell.addEventListener("click", () => options.onCellClick?.(x, y));
      }

      board.append(cell);
    }
  }

  return board;
}

function createBoardSetup(): HTMLElement {
  const setup = element("section", "board-setup");
  const widthInput = numberInput("Columns", "8", "grid-width-input");
  const heightInput = numberInput("Rows", "8", "grid-height-input");

  setup.append(
    element("p", "eyebrow", "New Board"),
    widthInput.label,
    heightInput.label,
    buttonElement(
      "Create Square Grid",
      () => createSquareGrid(widthInput.input.value, heightInput.input.value),
      "create-square-grid"
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

function toggleMarker(x: number, y: number): void {
  if (!scenario.space) {
    return;
  }

  const existing = scenario.pieces.find((piece) => piece.x === x && piece.y === y);
  const pieces = existing
    ? scenario.pieces.filter((piece) => piece.id !== existing.id)
    : [
        ...scenario.pieces,
        {
          id: `marker-${x}-${y}`,
          kind: "marker" as const,
          side: "neutral" as const,
          x,
          y
        }
      ];

  scenario = {
    ...scenario,
    pieces
  };
  dirty = true;
  statusMessage = existing ? "Marker removed" : "Marker placed";
  render();
}

function createNewScenario(): void {
  scenario = createEmptyScenario();
  clearCurrentFilePath();
  dirty = false;
  statusMessage = "New blank scenario";
  navigate("editor");
}

function createSquareGrid(widthValue: string, heightValue: string): void {
  const width = parseGridSize(widthValue);
  const height = parseGridSize(heightValue);

  if (!width || !height) {
    statusMessage = "Grid size must be between 1 and 64";
    render();
    return;
  }

  scenario = {
    ...scenario,
    space: {
      type: "square-grid",
      width,
      height
    },
    pieces: []
  };
  dirty = true;
  statusMessage = `Square grid created: ${width} x ${height}`;
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

  if (result.scenario) {
    scenario = result.scenario;
  }
  if (result.dirty !== undefined) {
    dirty = result.dirty;
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

function numberInput(labelText: string, value: string, testId: string): {
  label: HTMLElement;
  input: HTMLInputElement;
} {
  const label = element("label", "field-label");
  const text = element("span", "", labelText);
  const input = document.createElement("input");
  input.type = "number";
  input.min = "1";
  input.max = "64";
  input.step = "1";
  input.value = value;
  input.dataset.testid = testId;
  label.append(text, input);
  return { label, input };
}

function metric(label: string, value: string, testId?: string): HTMLElement {
  const item = element("div", "metric");
  const valueElement = element("strong", "", value);
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

  return `${scenario.space.width} x ${scenario.space.height} square`;
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

function parseGridSize(value: string): number | null {
  const size = Number.parseInt(value, 10);

  if (!Number.isInteger(size) || size < 1 || size > 64) {
    return null;
  }

  return size;
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
