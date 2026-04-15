import "./styles.css";
import {
  createEmptyScenario,
  scenarioToJson
} from "./scenario";
import {
  type ScenarioStorageResult,
  getCurrentFilePath,
  getFileLabel,
  getSaveAsLabel,
  getStorageModeLabel,
  loadRememberedScenario,
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
let scenario = loadRememberedScenario();
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
    metric("Grid", `${scenario.space.width} x ${scenario.space.height}`),
    metric("Markers", String(scenario.pieces.length), "marker-count"),
    metric("File", getFileLabel(), "current-file"),
    createActionStack()
  );

  const boardStage = element("section", "board-stage");
  boardStage.append(
    element("div", "stage-header", "Editor Board"),
    createBoard({
      readonly: false,
      cellAttribute: "cell",
      onCellClick: toggleMarker
    })
  );

  const inspector = element("aside", "panel right-panel");
  const savedAt = scenario.metadata.savedAt
    ? new Date(scenario.metadata.savedAt).toLocaleString()
    : "Not saved";
  const currentFilePath = getCurrentFilePath();
  inspector.append(
    element("p", "eyebrow", "Saved Game"),
    metric("State", dirty ? "Unsaved changes" : "Saved"),
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
    metric("Grid", `${scenario.space.width} x ${scenario.space.height}`),
    metric("Markers", String(scenario.pieces.length)),
    buttonElement("Close Runtime", () => navigate("editor"), "close-runtime")
  );

  const boardStage = element("section", "board-stage runtime-stage");
  boardStage.append(
    element("div", "stage-header", "Game Runtime"),
    createBoard({
      readonly: true,
      cellAttribute: "runtimeCell"
    })
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
    buttonElement("Open Scenario", () => openScenario(fileInput), "open-scenario"),
    buttonElement("Save Scenario", saveScenario, "save-scenario"),
    buttonElement(getSaveAsLabel(), saveScenarioAs, "save-as-scenario"),
    buttonElement("Launch Runtime", () => {
      rememberScenario(scenario);
      navigate("runtime");
    }, "launch-runtime"),
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
  const board = element("div", "board");
  board.style.setProperty("--grid-width", String(scenario.space.width));
  board.style.setProperty("--grid-height", String(scenario.space.height));

  const piecesByPosition = new Map(scenario.pieces.map((piece) => [`${piece.x},${piece.y}`, piece]));

  for (let y = 0; y < scenario.space.height; y += 1) {
    for (let x = 0; x < scenario.space.width; x += 1) {
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

function toggleMarker(x: number, y: number): void {
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
  testId?: string
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "action-button";
  button.textContent = label;
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
