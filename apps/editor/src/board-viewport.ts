import type { ScenarioPiece, ScenarioSpace } from "./scenario";

type Point = {
  x: number;
  y: number;
};

type Size = {
  width: number;
  height: number;
};

type Bounds = Point & Size;

type TileCoordinate = {
  x: number;
  y: number;
};

type ViewportTransform = {
  panX: number;
  panY: number;
  scale: number;
  rotation: number;
};

export type BoardViewportState = {
  boardKey: string | null;
  transform: ViewportTransform | null;
  viewportSize: Size;
};

type GridColors = {
  boardFill: string;
  boardLine: string;
};

type GridGeometry = {
  key: string;
  bounds: Bounds;
  columns: number;
  rows: number;
  draw: (context: CanvasRenderingContext2D, colors: GridColors, scale: number) => void;
  markerRadius: (scale: number) => number;
  tileToWorldCenter: (tile: TileCoordinate) => Point;
  worldToTile: (point: Point) => TileCoordinate | null;
};

type BoardViewportOptions = {
  mode: "editor" | "runtime";
  readonly: boolean;
  space: ScenarioSpace;
  pieces: ScenarioPiece[];
  state: BoardViewportState;
  onTileClick?: (x: number, y: number) => void;
  onMarkerDrop?: (x: number, y: number) => void;
};

type DrawOptions = {
  recoverHiddenView?: boolean;
};

const squareTileSize = 48;
const homePadding = 40;
const minZoom = 0.04;
const maxZoom = 5;
const resizeRecoveryVisibleRatio = 0.08;

export const markerDragDataType = "application/x-fieldcraft-marker";

export function createBoardViewportState(): BoardViewportState {
  return {
    boardKey: null,
    transform: null,
    viewportSize: {
      width: 0,
      height: 0
    }
  };
}

export function resetBoardViewportState(state: BoardViewportState): void {
  state.boardKey = null;
  state.transform = null;
  state.viewportSize = {
    width: 0,
    height: 0
  };
}

export function createBoardViewport(options: BoardViewportOptions): HTMLElement {
  const geometry = createGridGeometry(options.space);
  const viewport = document.createElement("section");
  const toolbar = document.createElement("div");
  const surface = document.createElement("div");
  const canvas = document.createElement("canvas");
  const zoomLabel = document.createElement("span");
  const resetButton = viewportButton("Reset View", "Reset board view", "reset-board-view");
  const zoomOutButton = viewportButton("-", "Zoom out", "zoom-out-board");
  const zoomInButton = viewportButton("+", "Zoom in", "zoom-in-board");
  const maybeContext = canvas.getContext("2d");

  if (!maybeContext) {
    throw new Error("Canvas rendering is not available.");
  }
  const context: CanvasRenderingContext2D = maybeContext;

  viewport.className = "board-viewport";
  viewport.dataset.testid =
    options.mode === "runtime" ? "runtime-board-viewport" : "board-viewport";
  viewport.dataset.boardMode = options.mode;

  toolbar.className = "board-toolbar";
  zoomLabel.className = "zoom-label";
  zoomLabel.dataset.testid =
    options.mode === "runtime" ? "runtime-board-zoom" : "board-zoom";

  surface.className = "board-surface";
  surface.dataset.testid =
    options.mode === "runtime" ? "runtime-board-surface" : "board-surface";
  surface.dataset.markerPositions = getMarkerPositions(options.pieces);

  canvas.className = "board-canvas";
  canvas.dataset.testid =
    options.mode === "runtime" ? "runtime-board-canvas" : "board-canvas";
  canvas.tabIndex = 0;
  canvas.setAttribute("aria-label", getCanvasLabel(options.space, options.readonly));

  zoomOutButton.addEventListener("click", () => {
    zoomAtViewportCenter(options.state, 1 / 1.18);
    draw();
  });
  zoomInButton.addEventListener("click", () => {
    zoomAtViewportCenter(options.state, 1.18);
    draw();
  });
  resetButton.addEventListener("click", () => {
    resetToHome(options.state, geometry);
    draw();
  });

  toolbar.append(
    element("span", "board-size-label", `${options.space.width} x ${options.space.height}`),
    zoomOutButton,
    resetButton,
    zoomInButton,
    zoomLabel
  );
  surface.append(canvas);
  viewport.append(toolbar, surface);

  const pointerController = createPointerController({
    canvas,
    surface,
    state: options.state,
    readonly: options.readonly,
    geometry,
    draw,
    onTileClick: options.onTileClick
  });
  const markerDropController = createMarkerDropController({
    surface,
    state: options.state,
    readonly: options.readonly,
    geometry,
    onMarkerDrop: options.onMarkerDrop
  });
  canvas.addEventListener("pointerdown", pointerController.handlePointerDown);
  canvas.addEventListener("pointermove", pointerController.handlePointerMove);
  canvas.addEventListener("pointerup", pointerController.handlePointerUp);
  canvas.addEventListener("pointercancel", pointerController.handlePointerCancel);
  surface.addEventListener("dragover", markerDropController.handleDragOver);
  surface.addEventListener("dragleave", markerDropController.handleDragLeave);
  surface.addEventListener("drop", markerDropController.handleDrop);
  canvas.addEventListener("auxclick", (event) => {
    if (event.button === 1) {
      event.preventDefault();
    }
  });
  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      ensureTransform(options.state, geometry);
      const viewportPoint = screenPointToViewportPoint(
        {
          x: event.clientX,
          y: event.clientY
        },
        surface
      );
      zoomAtViewportPoint(options.state, viewportPoint, event.deltaY < 0 ? 1.12 : 1 / 1.12);
      draw();
    },
    { passive: false }
  );

  const keyController = createPanKeyController(surface, options.readonly);
  window.addEventListener("keydown", keyController.handleKeyDown);
  window.addEventListener("keyup", keyController.handleKeyUp);
  window.addEventListener("blur", keyController.handleBlur);

  const handleWindowResize = () => draw({ recoverHiddenView: true });
  window.addEventListener("resize", handleWindowResize);

  const resizeObserver = new ResizeObserver(() => draw({ recoverHiddenView: true }));
  resizeObserver.observe(surface);
  const cleanupObserver = new MutationObserver(() => {
    if (!viewport.isConnected) {
      resizeObserver.disconnect();
      cleanupObserver.disconnect();
      window.removeEventListener("keydown", keyController.handleKeyDown);
      window.removeEventListener("keyup", keyController.handleKeyUp);
      window.removeEventListener("blur", keyController.handleBlur);
      window.removeEventListener("resize", handleWindowResize);
    }
  });
  cleanupObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
  window.requestAnimationFrame(() => draw());

  return viewport;

  function draw(drawOptions: DrawOptions = {}): void {
    const size = syncCanvasSize(canvas, surface);
    if (size.width <= 0 || size.height <= 0) {
      return;
    }

    const previousSize = options.state.viewportSize;
    options.state.viewportSize = size;
    ensureTransform(options.state, geometry);

    let transform = options.state.transform;
    if (!transform) {
      return;
    }
    if (
      shouldRecoverViewAfterResize(
        previousSize,
        size,
        geometry,
        transform,
        drawOptions.recoverHiddenView === true
      )
    ) {
      resetToHome(options.state, geometry);
      transform = options.state.transform;
      if (!transform) {
        return;
      }
    }

    const styles = getComputedStyle(viewport);
    const colors = {
      boardFill: cssVariable(styles, "--board-fill", "#f9fbfb"),
      boardLine: cssVariable(styles, "--board-line", "#aeb8c1")
    };
    const markerFill = cssVariable(styles, "--marker", "#d24b3f");
    const markerRing = cssVariable(styles, "--marker-ring", "#61221e");
    const viewportFill = cssVariable(styles, "--viewport-fill", "#e7ecef");
    const devicePixelRatio = window.devicePixelRatio || 1;

    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    context.clearRect(0, 0, size.width, size.height);
    context.fillStyle = viewportFill;
    context.fillRect(0, 0, size.width, size.height);
    context.save();
    applyViewportTransform(context, transform);
    geometry.draw(context, colors, transform.scale);
    drawMarkers(context, geometry, options.pieces, transform.scale, markerFill, markerRing);
    context.restore();

    updateSurfaceData(surface, geometry, transform, options.pieces);
    zoomLabel.textContent = `${Math.round(transform.scale * 100)}%`;
  }
}

function createGridGeometry(space: ScenarioSpace): GridGeometry {
  switch (space.type) {
    case "square-grid":
      return createSquareGridGeometry(space);
  }
}

function createSquareGridGeometry(space: ScenarioSpace): GridGeometry {
  const bounds = {
    x: 0,
    y: 0,
    width: space.width * squareTileSize,
    height: space.height * squareTileSize
  };

  return {
    key: `${space.type}:${space.width}x${space.height}`,
    bounds,
    columns: space.width,
    rows: space.height,
    draw: (context, colors, scale) => {
      context.fillStyle = colors.boardFill;
      context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
      context.strokeStyle = colors.boardLine;
      context.lineWidth = Math.max(1 / scale, 0.75);
      context.beginPath();

      for (let column = 0; column <= space.width; column += 1) {
        const x = column * squareTileSize;
        context.moveTo(x, 0);
        context.lineTo(x, bounds.height);
      }

      for (let row = 0; row <= space.height; row += 1) {
        const y = row * squareTileSize;
        context.moveTo(0, y);
        context.lineTo(bounds.width, y);
      }

      context.stroke();
    },
    markerRadius: (scale) =>
      Math.min(squareTileSize * 0.42, Math.max(squareTileSize * 0.24, 5 / scale)),
    tileToWorldCenter: (tile) => ({
      x: (tile.x + 0.5) * squareTileSize,
      y: (tile.y + 0.5) * squareTileSize
    }),
    worldToTile: (point) => {
      if (
        point.x < bounds.x ||
        point.y < bounds.y ||
        point.x >= bounds.width ||
        point.y >= bounds.height
      ) {
        return null;
      }

      const x = Math.floor(point.x / squareTileSize);
      const y = Math.floor(point.y / squareTileSize);

      if (x < 0 || y < 0 || x >= space.width || y >= space.height) {
        return null;
      }

      return { x, y };
    }
  };
}

function createPointerController(options: {
  canvas: HTMLCanvasElement;
  surface: HTMLElement;
  state: BoardViewportState;
  readonly: boolean;
  geometry: GridGeometry;
  draw: () => void;
  onTileClick?: (x: number, y: number) => void;
}): {
  handlePointerDown: (event: PointerEvent) => void;
  handlePointerMove: (event: PointerEvent) => void;
  handlePointerUp: (event: PointerEvent) => void;
  handlePointerCancel: (event: PointerEvent) => void;
} {
  let drag: {
    mode: "click" | "pan";
    pointerId: number;
    startPoint: Point;
    startPan: Point;
    moved: boolean;
  } | null = null;

  return {
    handlePointerDown: (event) => {
      const mode = getPointerDragMode(event);
      if (!mode) {
        return;
      }
      if (mode === "pan") {
        event.preventDefault();
        options.surface.classList.add("is-panning");
      }

      ensureTransform(options.state, options.geometry);
      const transform = options.state.transform;
      if (!transform) {
        options.surface.classList.remove("is-panning");
        return;
      }

      const startPoint = screenPointToViewportPoint(
        {
          x: event.clientX,
          y: event.clientY
        },
        options.surface
      );
      drag = {
        mode,
        pointerId: event.pointerId,
        startPoint,
        startPan: {
          x: transform.panX,
          y: transform.panY
        },
        moved: false
      };
      options.canvas.setPointerCapture(event.pointerId);
    },
    handlePointerMove: (event) => {
      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }

      const currentPoint = screenPointToViewportPoint(
        {
          x: event.clientX,
          y: event.clientY
        },
        options.surface
      );
      const totalDelta = {
        x: currentPoint.x - drag.startPoint.x,
        y: currentPoint.y - drag.startPoint.y
      };

      if (!drag.moved && Math.hypot(totalDelta.x, totalDelta.y) < 4) {
        return;
      }

      drag.moved = true;
      if (drag.mode !== "pan") {
        return;
      }
      const transform = options.state.transform;
      if (transform) {
        transform.panX = drag.startPan.x + totalDelta.x;
        transform.panY = drag.startPan.y + totalDelta.y;
        options.draw();
      }
    },
    handlePointerUp: (event) => {
      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }

      const wasClick = !drag.moved;
      const dragMode = drag.mode;
      const currentPoint = screenPointToViewportPoint(
        {
          x: event.clientX,
          y: event.clientY
        },
        options.surface
      );
      options.canvas.releasePointerCapture(event.pointerId);
      options.surface.classList.remove("is-panning");
      drag = null;

      if (dragMode === "pan" || !wasClick || options.readonly || !options.onTileClick) {
        return;
      }

      const worldPoint = viewportPointToWorldPoint(currentPoint, options.state.transform);
      const tile = worldPoint ? options.geometry.worldToTile(worldPoint) : null;
      if (tile) {
        options.onTileClick(tile.x, tile.y);
      }
    },
    handlePointerCancel: (event) => {
      if (drag?.pointerId === event.pointerId) {
        drag = null;
        options.surface.classList.remove("is-panning");
      }
    }
  };
}

function createMarkerDropController(options: {
  surface: HTMLElement;
  state: BoardViewportState;
  readonly: boolean;
  geometry: GridGeometry;
  onMarkerDrop?: (x: number, y: number) => void;
}): {
  handleDragOver: (event: DragEvent) => void;
  handleDragLeave: (event: DragEvent) => void;
  handleDrop: (event: DragEvent) => void;
} {
  return {
    handleDragOver: (event) => {
      if (!canAcceptMarkerDrop(event, options.readonly, options.onMarkerDrop)) {
        return;
      }

      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "copy";
      }
      options.surface.classList.add("is-marker-drop-target");
    },
    handleDragLeave: (event) => {
      if (
        event.relatedTarget instanceof Node &&
        options.surface.contains(event.relatedTarget)
      ) {
        return;
      }

      options.surface.classList.remove("is-marker-drop-target");
    },
    handleDrop: (event) => {
      if (!canAcceptMarkerDrop(event, options.readonly, options.onMarkerDrop)) {
        return;
      }

      event.preventDefault();
      options.surface.classList.remove("is-marker-drop-target");
      ensureTransform(options.state, options.geometry);
      const viewportPoint = screenPointToViewportPoint(
        {
          x: event.clientX,
          y: event.clientY
        },
        options.surface
      );
      const worldPoint = viewportPointToWorldPoint(viewportPoint, options.state.transform);
      const tile = worldPoint ? options.geometry.worldToTile(worldPoint) : null;
      if (tile) {
        options.onMarkerDrop?.(tile.x, tile.y);
      }
    }
  };
}

function canAcceptMarkerDrop(
  event: DragEvent,
  readonly: boolean,
  onMarkerDrop: ((x: number, y: number) => void) | undefined
): boolean {
  return (
    !readonly &&
    Boolean(onMarkerDrop) &&
    Array.from(event.dataTransfer?.types ?? []).includes(markerDragDataType)
  );
}

function createPanKeyController(
  surface: HTMLElement,
  readonly: boolean
): {
  handleKeyDown: (event: KeyboardEvent) => void;
  handleKeyUp: (event: KeyboardEvent) => void;
  handleBlur: () => void;
} {
  return {
    handleKeyDown: (event) => {
      if (!readonly && event.key === "Control") {
        surface.classList.add("is-pan-modifier-active");
      }
    },
    handleKeyUp: (event) => {
      if (event.key === "Control") {
        surface.classList.remove("is-pan-modifier-active");
      }
    },
    handleBlur: () => {
      surface.classList.remove("is-pan-modifier-active", "is-panning");
    }
  };
}

function getPointerDragMode(event: PointerEvent): "click" | "pan" | null {
  if (event.button === 1) {
    return "pan";
  }

  if (event.button === 0 && event.ctrlKey) {
    return "pan";
  }

  if (event.button === 0) {
    return "click";
  }

  return null;
}

function ensureTransform(state: BoardViewportState, geometry: GridGeometry): void {
  if (state.boardKey !== geometry.key || !state.transform) {
    state.boardKey = geometry.key;
    resetToHome(state, geometry);
  }
}

function shouldRecoverViewAfterResize(
  previousSize: Size,
  size: Size,
  geometry: GridGeometry,
  transform: ViewportTransform,
  recoverHiddenView: boolean
): boolean {
  if (previousSize.width <= 0 || previousSize.height <= 0) {
    return false;
  }

  const resizedSmaller = size.width < previousSize.width || size.height < previousSize.height;
  if (!resizedSmaller && !recoverHiddenView) {
    return false;
  }

  const visibleArea = getViewportBoardVisibleArea(size, geometry, transform);
  const minimumVisibleArea = size.width * size.height * resizeRecoveryVisibleRatio;

  return visibleArea < minimumVisibleArea;
}

function getViewportBoardVisibleArea(
  size: Size,
  geometry: GridGeometry,
  transform: ViewportTransform
): number {
  const bounds = getTransformedBounds(geometry.bounds, transform);
  const left = Math.max(0, bounds.x);
  const top = Math.max(0, bounds.y);
  const right = Math.min(size.width, bounds.x + bounds.width);
  const bottom = Math.min(size.height, bounds.y + bounds.height);

  return Math.max(0, right - left) * Math.max(0, bottom - top);
}

function getTransformedBounds(bounds: Bounds, transform: ViewportTransform): Bounds {
  const corners = [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height }
  ].map((point) => worldPointToViewportPoint(point, transform));
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const right = Math.max(...xs);
  const bottom = Math.max(...ys);

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top
  };
}

function resetToHome(state: BoardViewportState, geometry: GridGeometry): void {
  const width = Math.max(state.viewportSize.width, 1);
  const height = Math.max(state.viewportSize.height, 1);
  const padding = Math.min(homePadding, Math.max(12, Math.min(width, height) * 0.08));
  const usableWidth = Math.max(width - padding * 2, 1);
  const usableHeight = Math.max(height - padding * 2, 1);
  const scale = clamp(
    Math.min(usableWidth / geometry.bounds.width, usableHeight / geometry.bounds.height),
    minZoom,
    maxZoom
  );
  const transform = {
    panX: 0,
    panY: 0,
    scale,
    rotation: 0
  };
  const boardCenter = {
    x: geometry.bounds.x + geometry.bounds.width / 2,
    y: geometry.bounds.y + geometry.bounds.height / 2
  };
  const viewportCenter = {
    x: width / 2,
    y: height / 2
  };
  const projectedBoardCenter = worldPointToViewportPoint(boardCenter, transform);
  transform.panX += viewportCenter.x - projectedBoardCenter.x;
  transform.panY += viewportCenter.y - projectedBoardCenter.y;
  state.transform = transform;
}

function zoomAtViewportCenter(state: BoardViewportState, factor: number): void {
  zoomAtViewportPoint(
    state,
    {
      x: state.viewportSize.width / 2,
      y: state.viewportSize.height / 2
    },
    factor
  );
}

function zoomAtViewportPoint(state: BoardViewportState, viewportPoint: Point, factor: number): void {
  const transform = state.transform;
  if (!transform) {
    return;
  }

  const worldPoint = viewportPointToWorldPoint(viewportPoint, transform);
  if (!worldPoint) {
    return;
  }

  transform.scale = clamp(transform.scale * factor, minZoom, maxZoom);
  const projectedPoint = worldPointToViewportPoint(worldPoint, transform);
  transform.panX += viewportPoint.x - projectedPoint.x;
  transform.panY += viewportPoint.y - projectedPoint.y;
}

function screenPointToViewportPoint(point: Point, surface: HTMLElement): Point {
  const rect = surface.getBoundingClientRect();

  return {
    x: point.x - rect.left,
    y: point.y - rect.top
  };
}

function viewportPointToWorldPoint(
  point: Point,
  transform: ViewportTransform | null
): Point | null {
  if (!transform) {
    return null;
  }

  const translated = {
    x: point.x - transform.panX,
    y: point.y - transform.panY
  };
  const cos = Math.cos(-transform.rotation);
  const sin = Math.sin(-transform.rotation);

  return {
    x: (translated.x * cos - translated.y * sin) / transform.scale,
    y: (translated.x * sin + translated.y * cos) / transform.scale
  };
}

function worldPointToViewportPoint(point: Point, transform: ViewportTransform): Point {
  const scaled = {
    x: point.x * transform.scale,
    y: point.y * transform.scale
  };
  const cos = Math.cos(transform.rotation);
  const sin = Math.sin(transform.rotation);

  return {
    x: scaled.x * cos - scaled.y * sin + transform.panX,
    y: scaled.x * sin + scaled.y * cos + transform.panY
  };
}

function applyViewportTransform(
  context: CanvasRenderingContext2D,
  transform: ViewportTransform
): void {
  context.translate(transform.panX, transform.panY);
  context.rotate(transform.rotation);
  context.scale(transform.scale, transform.scale);
}

function drawMarkers(
  context: CanvasRenderingContext2D,
  geometry: GridGeometry,
  pieces: ScenarioPiece[],
  scale: number,
  markerFill: string,
  markerRing: string
): void {
  for (const piece of pieces) {
    const center = geometry.tileToWorldCenter(piece);
    const radius = geometry.markerRadius(scale);

    context.beginPath();
    context.arc(center.x, center.y, radius, 0, Math.PI * 2);
    context.fillStyle = markerFill;
    context.fill();
    context.lineWidth = Math.max(2 / scale, 1.5);
    context.strokeStyle = markerRing;
    context.stroke();
    context.beginPath();
    context.arc(center.x, center.y, radius * 0.58, 0, Math.PI * 2);
    context.strokeStyle = "rgba(255, 255, 255, 0.58)";
    context.stroke();
  }
}

function syncCanvasSize(canvas: HTMLCanvasElement, surface: HTMLElement): Size {
  const rect = surface.getBoundingClientRect();
  const width = Math.max(0, Math.floor(rect.width));
  const height = Math.max(0, Math.floor(rect.height));
  const devicePixelRatio = window.devicePixelRatio || 1;
  const pixelWidth = Math.max(1, Math.floor(width * devicePixelRatio));
  const pixelHeight = Math.max(1, Math.floor(height * devicePixelRatio));

  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  return { width, height };
}

function updateSurfaceData(
  surface: HTMLElement,
  geometry: GridGeometry,
  transform: ViewportTransform,
  pieces: ScenarioPiece[]
): void {
  surface.dataset.viewReady = "true";
  surface.dataset.viewScale = String(transform.scale);
  surface.dataset.viewRotation = String(transform.rotation);
  surface.dataset.viewPanX = String(transform.panX);
  surface.dataset.viewPanY = String(transform.panY);
  surface.dataset.boardWorldWidth = String(geometry.bounds.width);
  surface.dataset.boardWorldHeight = String(geometry.bounds.height);
  surface.dataset.boardColumns = String(geometry.columns);
  surface.dataset.boardRows = String(geometry.rows);
  surface.dataset.markerPositions = getMarkerPositions(pieces);
}

function getMarkerPositions(pieces: ScenarioPiece[]): string {
  return pieces
    .map((piece) => `${piece.x}-${piece.y}`)
    .sort((a, b) => a.localeCompare(b))
    .join(" ");
}

function viewportButton(label: string, ariaLabel: string, testId: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "viewport-button";
  button.textContent = label;
  button.setAttribute("aria-label", ariaLabel);
  button.title = ariaLabel;
  button.dataset.testid = testId;
  return button;
}

function getCanvasLabel(space: ScenarioSpace, readonly: boolean): string {
  const mode = readonly ? "read-only board" : "interactive board";

  return `${space.width} by ${space.height} ${space.type} ${mode}`;
}

function cssVariable(styles: CSSStyleDeclaration, name: string, fallback: string): string {
  return styles.getPropertyValue(name).trim() || fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
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
