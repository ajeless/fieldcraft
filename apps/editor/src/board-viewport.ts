import {
  isTileScenarioSpace,
  type ScenarioFreeCoordinateSpace,
  type ScenarioPiece,
  type ScenarioSpace,
  type ScenarioTileSpace
} from "./scenario";
import {
  isPointInFreeCoordinateBounds,
  roundFreeCoordinatePoint
} from "./spatial";

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

type BoardCoordinate = {
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
  boardLineOpacity: number;
};

type ImageResource = {
  image: HTMLImageElement;
  status: "loading" | "ready" | "error";
  listeners: Set<() => void>;
};

type GridGeometry = {
  key: string;
  spaceType: ScenarioSpace["type"];
  bounds: Bounds;
  columns: number | null;
  rows: number | null;
  draw: (
    context: CanvasRenderingContext2D,
    colors: GridColors,
    scale: number,
    backgroundImage: HTMLImageElement | null
  ) => void;
  markerRadius: (scale: number) => number;
  pieceToWorldPoint: (piece: ScenarioPiece) => Point;
  worldToPlacementPoint: (point: Point) => BoardCoordinate | null;
};

type BoardViewportOptions = {
  mode: "editor" | "runtime";
  readonly: boolean;
  space: ScenarioSpace;
  pieces: ScenarioPiece[];
  backgroundImageUrl?: string | null;
  getPieceImageUrl?: (piece: ScenarioPiece) => string | null;
  selectedPieceId?: string | null;
  state: BoardViewportState;
  onPieceSelect?: (pieceId: string | null) => void;
  onMarkerDrop?: (x: number, y: number) => void;
  onPointerBoardCoordinateChange?: (
    coordinate: {
      readonly x: number;
      readonly y: number;
    } | null
  ) => void;
};

type DrawOptions = {
  recoverHiddenView?: boolean;
};

type PieceRenderLayout = {
  center: Point;
  radius: number;
};

const homePadding = 40;
const minZoom = 0.04;
const maxZoom = 5;
const resizeRecoveryVisibleRatio = 0.08;
const pointerClickMovementThreshold = 8;
const markerHitSlopPixels = 8;
const imageResourceCache = new Map<string, ImageResource>();

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
  const backgroundImageResource = options.backgroundImageUrl
    ? getImageResource(options.backgroundImageUrl)
    : null;
  const pieceImageResources = createPieceImageResourceMap(
    options.pieces,
    options.getPieceImageUrl
  );
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
  surface.dataset.markerPositions = getMarkerPositions(options.pieces, geometry.spaceType);

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
    element("span", "board-size-label", getBoardSizeLabel(options.space)),
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
    pieces: options.pieces,
    draw,
    onPieceSelect: options.onPieceSelect
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
  if (options.onPointerBoardCoordinateChange) {
    canvas.addEventListener("pointermove", (event) => {
      ensureTransform(options.state, geometry);
      const viewportPoint = screenPointToViewportPoint(
        {
          x: event.clientX,
          y: event.clientY
        },
        surface
      );
      const worldPoint = viewportPointToWorldPoint(viewportPoint, options.state.transform);
      options.onPointerBoardCoordinateChange?.(
        worldPoint ? geometry.worldToPlacementPoint(worldPoint) : null
      );
    });
    canvas.addEventListener("pointerleave", () => {
      options.onPointerBoardCoordinateChange?.(null);
    });
  }
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
  const handleBackgroundImageUpdate = () => draw();
  backgroundImageResource?.listeners.add(handleBackgroundImageUpdate);
  for (const resource of pieceImageResources.values()) {
    resource.listeners.add(handleBackgroundImageUpdate);
  }
  const cleanupObserver = new MutationObserver(() => {
    if (!viewport.isConnected) {
      resizeObserver.disconnect();
      cleanupObserver.disconnect();
      window.removeEventListener("keydown", keyController.handleKeyDown);
      window.removeEventListener("keyup", keyController.handleKeyUp);
      window.removeEventListener("blur", keyController.handleBlur);
      window.removeEventListener("resize", handleWindowResize);
      backgroundImageResource?.listeners.delete(handleBackgroundImageUpdate);
      for (const resource of pieceImageResources.values()) {
        resource.listeners.delete(handleBackgroundImageUpdate);
      }
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
      boardFill:
        options.space.background.color || cssVariable(styles, "--fc-board-bg", "#e8ebe6"),
      boardLine: isTileScenarioSpace(options.space)
        ? options.space.grid.lineColor || cssVariable(styles, "--fc-board-grid", "#c4c8c0")
        : cssVariable(styles, "--fc-board-grid-strong", "#9ea29a"),
      boardLineOpacity: isTileScenarioSpace(options.space)
        ? options.space.grid.lineOpacity
        : 1
    };
    const markerFill = cssVariable(styles, "--fc-marker", "#c85448");
    const markerRing = cssVariable(styles, "--fc-marker-ring", "#7a2a22");
    const markerSelectionGlow = cssVariable(
      styles,
      "--fc-marker-selection-glow",
      "rgba(31, 122, 104, 0.18)"
    );
    const markerSelectionRing = cssVariable(
      styles,
      "--fc-marker-selection-ring",
      "#0f7c68"
    );
    const viewportFill = cssVariable(styles, "--fc-bg0", "#f5f6f4");
    const devicePixelRatio = window.devicePixelRatio || 1;

    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    context.clearRect(0, 0, size.width, size.height);
    context.fillStyle = viewportFill;
    context.fillRect(0, 0, size.width, size.height);
    context.save();
    applyViewportTransform(context, transform);
    geometry.draw(
      context,
      colors,
      transform.scale,
      backgroundImageResource?.status === "ready" ? backgroundImageResource.image : null
    );
    drawMarkers(context, geometry, options.pieces, {
      scale: transform.scale,
      markerFill,
      markerRing,
      pieceImageResources,
      selectionGlow: markerSelectionGlow,
      selectionRing: markerSelectionRing,
      selectedPieceId: options.selectedPieceId ?? null
    });
    context.restore();

    updateSurfaceData(
      surface,
      geometry,
      transform,
      options.pieces,
      options.selectedPieceId ?? null,
      backgroundImageResource,
      pieceImageResources
    );
    zoomLabel.textContent = `${Math.round(transform.scale * 100)}%`;
  }
}

function createGridGeometry(space: ScenarioSpace): GridGeometry {
  switch (space.type) {
    case "square-grid":
      return createSquareGridGeometry(space);
    case "hex-grid":
      return createHexGridGeometry(space);
    case "free-coordinate":
      return createFreeCoordinateGeometry(space);
  }
}

function createSquareGridGeometry(space: ScenarioTileSpace): GridGeometry {
  const tileSize = space.tileSize;
  const bounds = {
    x: 0,
    y: 0,
    width: space.width * tileSize,
    height: space.height * tileSize
  };

  return {
    key: `${space.type}:${space.width}x${space.height}:${tileSize}`,
    spaceType: space.type,
    bounds,
    columns: space.width,
    rows: space.height,
    draw: (context, colors, scale, backgroundImage) => {
      context.fillStyle = colors.boardFill;
      context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
      if (backgroundImage) {
        context.drawImage(backgroundImage, bounds.x, bounds.y, bounds.width, bounds.height);
      }
      context.strokeStyle = colorWithOpacity(colors.boardLine, colors.boardLineOpacity);
      context.lineWidth = Math.max(1 / scale, 0.75);
      context.beginPath();

      for (let column = 0; column <= space.width; column += 1) {
        const x = column * tileSize;
        context.moveTo(x, 0);
        context.lineTo(x, bounds.height);
      }

      for (let row = 0; row <= space.height; row += 1) {
        const y = row * tileSize;
        context.moveTo(0, y);
        context.lineTo(bounds.width, y);
      }

      context.stroke();
    },
    markerRadius: (scale) =>
      Math.min(tileSize * 0.42, Math.max(tileSize * 0.24, 5 / scale)),
    pieceToWorldPoint: (tile) => ({
      x: (tile.x + 0.5) * tileSize,
      y: (tile.y + 0.5) * tileSize
    }),
    worldToPlacementPoint: (point) => {
      if (
        point.x < bounds.x ||
        point.y < bounds.y ||
        point.x >= bounds.width ||
        point.y >= bounds.height
      ) {
        return null;
      }

      const x = Math.floor(point.x / tileSize);
      const y = Math.floor(point.y / tileSize);

      if (x < 0 || y < 0 || x >= space.width || y >= space.height) {
        return null;
      }

      return { x, y };
    }
  };
}

function createHexGridGeometry(space: ScenarioTileSpace): GridGeometry {
  const hexRadius = space.tileSize;
  const hexWidth = Math.sqrt(3) * hexRadius;
  const hexHeight = hexRadius * 2;
  const hexRowStep = hexRadius * 1.5;
  const bounds = {
    x: 0,
    y: 0,
    width: space.width * hexWidth + (space.height > 1 ? hexWidth / 2 : 0),
    height: hexHeight + (space.height - 1) * hexRowStep
  };

  const tileToWorldCenter = (tile: TileCoordinate): Point => ({
    x: hexWidth / 2 + tile.x * hexWidth + getHexRowOffset(tile.y, hexWidth),
    y: hexRadius + tile.y * hexRowStep
  });

  return {
    key: `${space.type}:${space.width}x${space.height}:${hexRadius}`,
    spaceType: space.type,
    bounds,
    columns: space.width,
    rows: space.height,
    draw: (context, colors, scale, backgroundImage) => {
      context.fillStyle = colors.boardFill;
      context.beginPath();
      tracePointyHexGrid(context, space, tileToWorldCenter, hexRadius);
      context.fill();
      if (backgroundImage) {
        context.save();
        context.beginPath();
        tracePointyHexGrid(context, space, tileToWorldCenter, hexRadius);
        context.clip();
        context.drawImage(backgroundImage, bounds.x, bounds.y, bounds.width, bounds.height);
        context.restore();
      }
      context.strokeStyle = colorWithOpacity(colors.boardLine, colors.boardLineOpacity);
      context.lineWidth = Math.max(1 / scale, 0.75);
      context.lineJoin = "round";
      context.beginPath();
      tracePointyHexGrid(context, space, tileToWorldCenter, hexRadius);
      context.stroke();
    },
    markerRadius: (scale) =>
      Math.min(hexRadius * 0.56, Math.max(hexRadius * 0.34, 5 / scale)),
    pieceToWorldPoint: tileToWorldCenter,
    worldToPlacementPoint: (point) => {
      if (
        point.x < bounds.x ||
        point.y < bounds.y ||
        point.x >= bounds.width ||
        point.y >= bounds.height
      ) {
        return null;
      }

      const likelyRow = Math.round((point.y - hexRadius) / hexRowStep);
      for (let row = likelyRow - 1; row <= likelyRow + 1; row += 1) {
        if (row < 0 || row >= space.height) {
          continue;
        }

        const likelyColumn = Math.round(
          (point.x - hexWidth / 2 - getHexRowOffset(row, hexWidth)) / hexWidth
        );
        for (let column = likelyColumn - 1; column <= likelyColumn + 1; column += 1) {
          if (column < 0 || column >= space.width) {
            continue;
          }

          const tile = { x: column, y: row };
          if (isPointInsidePointyHex(point, tileToWorldCenter(tile), hexRadius, hexWidth)) {
            return tile;
          }
        }
      }

      return null;
    }
  };
}

function createFreeCoordinateGeometry(space: ScenarioFreeCoordinateSpace): GridGeometry {
  const bounds = {
    x: space.bounds.x,
    y: space.bounds.y,
    width: space.bounds.width,
    height: space.bounds.height
  };
  const shortestSide = Math.min(bounds.width, bounds.height);
  const naturalMarkerRadius = Math.max(shortestSide * 0.018, 1);
  const maxMarkerRadius = Math.max(shortestSide * 0.04, 2);

  return {
    key: `${space.type}:${bounds.x},${bounds.y}:${bounds.width}x${bounds.height}`,
    spaceType: space.type,
    bounds,
    columns: null,
    rows: null,
    draw: (context, colors, scale, backgroundImage) => {
      context.fillStyle = colors.boardFill;
      context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
      if (backgroundImage) {
        context.drawImage(backgroundImage, bounds.x, bounds.y, bounds.width, bounds.height);
      }
      context.strokeStyle = colorWithOpacity(colors.boardLine, colors.boardLineOpacity);
      context.lineWidth = Math.max(1.5 / scale, 0.75);
      context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    },
    markerRadius: (scale) =>
      Math.min(maxMarkerRadius, Math.max(naturalMarkerRadius, 5 / scale)),
    pieceToWorldPoint: (piece) => ({
      x: piece.x,
      y: piece.y
    }),
    worldToPlacementPoint: (point) =>
      isPointInFreeCoordinateBounds(point, bounds)
        ? roundFreeCoordinatePoint(point)
        : null
  };
}

function getImageResource(url: string): ImageResource {
  const cached = imageResourceCache.get(url);
  if (cached) {
    return cached;
  }

  const image = new Image();
  const resource: ImageResource = {
    image,
    status: "loading",
    listeners: new Set()
  };
  const notifyListeners = () => {
    for (const listener of resource.listeners) {
      listener();
    }
  };

  image.addEventListener("load", () => {
    resource.status = "ready";
    notifyListeners();
  });
  image.addEventListener("error", () => {
    resource.status = "error";
    notifyListeners();
  });
  image.src = url;
  imageResourceCache.set(url, resource);

  return resource;
}

function createPieceImageResourceMap(
  pieces: ScenarioPiece[],
  getPieceImageUrl?: (piece: ScenarioPiece) => string | null
): Map<string, ImageResource> {
  const resources = new Map<string, ImageResource>();
  if (!getPieceImageUrl) {
    return resources;
  }

  for (const piece of pieces) {
    const imageUrl = getPieceImageUrl(piece);
    if (!imageUrl) {
      continue;
    }

    resources.set(piece.id, getImageResource(imageUrl));
  }

  return resources;
}

function getHexRowOffset(row: number, hexWidth: number): number {
  return row % 2 === 1 ? hexWidth / 2 : 0;
}

function tracePointyHexGrid(
  context: CanvasRenderingContext2D,
  space: ScenarioTileSpace,
  tileToWorldCenter: (tile: TileCoordinate) => Point,
  hexRadius: number
): void {
  for (let row = 0; row < space.height; row += 1) {
    for (let column = 0; column < space.width; column += 1) {
      tracePointyHexPath(context, tileToWorldCenter({ x: column, y: row }), hexRadius);
    }
  }
}

function tracePointyHexPath(
  context: CanvasRenderingContext2D,
  center: Point,
  hexRadius: number
): void {
  for (let side = 0; side < 6; side += 1) {
    const angle = -Math.PI / 2 + side * (Math.PI / 3);
    const point = {
      x: center.x + hexRadius * Math.cos(angle),
      y: center.y + hexRadius * Math.sin(angle)
    };

    if (side === 0) {
      context.moveTo(point.x, point.y);
    } else {
      context.lineTo(point.x, point.y);
    }
  }

  context.closePath();
}

function isPointInsidePointyHex(
  point: Point,
  center: Point,
  hexRadius: number,
  hexWidth: number
): boolean {
  const dx = Math.abs(point.x - center.x);
  const dy = Math.abs(point.y - center.y);
  const halfWidth = hexWidth / 2;
  const epsilon = 0.001;

  if (dy > hexRadius + epsilon || dx > halfWidth + epsilon) {
    return false;
  }

  if (dy <= hexRadius / 2 + epsilon) {
    return true;
  }

  return dx <= (hexRadius - dy) * (hexWidth / hexRadius) + epsilon;
}

function createPointerController(options: {
  canvas: HTMLCanvasElement;
  surface: HTMLElement;
  state: BoardViewportState;
  readonly: boolean;
  geometry: GridGeometry;
  pieces: ScenarioPiece[];
  draw: () => void;
  onPieceSelect?: (pieceId: string | null) => void;
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

      if (
        !drag.moved &&
        Math.hypot(totalDelta.x, totalDelta.y) < pointerClickMovementThreshold
      ) {
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

      if (dragMode === "pan" || !wasClick || options.readonly || !options.onPieceSelect) {
        return;
      }

      const worldPoint = viewportPointToWorldPoint(currentPoint, options.state.transform);
      const selectedPieceId =
        worldPoint && options.state.transform
          ? findPieceAtWorldPoint(
              options.pieces,
              worldPoint,
              options.geometry,
              options.state.transform.scale
            )?.id ?? null
          : null;
      options.onPieceSelect(selectedPieceId);
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
      const boardPoint = worldPoint
        ? options.geometry.worldToPlacementPoint(worldPoint)
        : null;
      if (boardPoint) {
        options.onMarkerDrop?.(boardPoint.x, boardPoint.y);
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

  const sizeChanged = previousSize.width !== size.width || previousSize.height !== size.height;
  if (!sizeChanged) {
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
  options: {
    scale: number;
    markerFill: string;
    markerRing: string;
    pieceImageResources: Map<string, ImageResource>;
    selectionGlow: string;
    selectionRing: string;
    selectedPieceId: string | null;
  }
): void {
  const layouts = createPieceRenderLayouts(pieces, geometry, options.scale);
  const baseRadius = geometry.markerRadius(options.scale);

  for (const piece of pieces) {
    const layout = layouts.get(piece.id);
    const center = layout?.center ?? geometry.pieceToWorldPoint(piece);
    const radius = layout?.radius ?? baseRadius;

    if (piece.id === options.selectedPieceId) {
      context.beginPath();
      context.arc(center.x, center.y, radius + Math.max(4 / options.scale, 2), 0, Math.PI * 2);
      context.fillStyle = options.selectionGlow;
      context.fill();
      context.lineWidth = Math.max(3 / options.scale, 2);
      context.strokeStyle = options.selectionRing;
      context.stroke();
    }

    const imageResource = options.pieceImageResources.get(piece.id);
    if (imageResource?.status === "ready") {
      drawMarkerImage(context, center, radius, imageResource.image);
      context.beginPath();
      context.arc(center.x, center.y, radius, 0, Math.PI * 2);
      context.lineWidth = Math.max(2 / options.scale, 1.5);
      context.strokeStyle = options.markerRing;
      context.stroke();
      context.beginPath();
      context.arc(center.x, center.y, radius * 0.84, 0, Math.PI * 2);
      context.strokeStyle = "rgba(255, 255, 255, 0.34)";
      context.stroke();
      continue;
    }

    drawDefaultMarker(context, center, radius, options.scale, options.markerFill, options.markerRing);
  }
}

function drawDefaultMarker(
  context: CanvasRenderingContext2D,
  center: Point,
  radius: number,
  scale: number,
  markerFill: string,
  markerRing: string
): void {
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

function drawMarkerImage(
  context: CanvasRenderingContext2D,
  center: Point,
  radius: number,
  image: HTMLImageElement
): void {
  context.save();
  context.beginPath();
  context.arc(center.x, center.y, radius, 0, Math.PI * 2);
  context.clip();
  context.drawImage(image, center.x - radius, center.y - radius, radius * 2, radius * 2);
  context.restore();
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
  pieces: ScenarioPiece[],
  selectedPieceId: string | null,
  backgroundImageResource: ImageResource | null,
  pieceImageResources: Map<string, ImageResource>
): void {
  surface.dataset.viewReady = "true";
  surface.dataset.viewScale = String(transform.scale);
  surface.dataset.viewRotation = String(transform.rotation);
  surface.dataset.viewPanX = String(transform.panX);
  surface.dataset.viewPanY = String(transform.panY);
  surface.dataset.backgroundImageStatus = backgroundImageResource?.status ?? "none";
  surface.dataset.boardSpaceType = geometry.spaceType;
  surface.dataset.boardBoundsX = String(geometry.bounds.x);
  surface.dataset.boardBoundsY = String(geometry.bounds.y);
  surface.dataset.boardWorldWidth = String(geometry.bounds.width);
  surface.dataset.boardWorldHeight = String(geometry.bounds.height);
  if (geometry.columns === null || geometry.rows === null) {
    delete surface.dataset.boardColumns;
    delete surface.dataset.boardRows;
  } else {
    surface.dataset.boardColumns = String(geometry.columns);
    surface.dataset.boardRows = String(geometry.rows);
  }
  surface.dataset.markerPositions = getMarkerPositions(pieces, geometry.spaceType);
  const markerImageStates = getMarkerImageStates(pieces, pieceImageResources);
  if (markerImageStates) {
    surface.dataset.markerImageStates = markerImageStates;
  } else {
    delete surface.dataset.markerImageStates;
  }
  if (selectedPieceId) {
    surface.dataset.selectedMarkerId = selectedPieceId;
  } else {
    delete surface.dataset.selectedMarkerId;
  }
}

function getMarkerImageStates(
  pieces: ScenarioPiece[],
  pieceImageResources: Map<string, ImageResource>
): string {
  return pieces
    .filter((piece) => piece.imageAssetId)
    .map((piece) => `${piece.id}:${pieceImageResources.get(piece.id)?.status ?? "missing"}`)
    .sort((left, right) => left.localeCompare(right))
    .join(" ");
}

function findPieceAtWorldPoint(
  pieces: ScenarioPiece[],
  worldPoint: Point,
  geometry: GridGeometry,
  scale: number
): ScenarioPiece | null {
  const layouts = createPieceRenderLayouts(pieces, geometry, scale);
  const baseRadius = geometry.markerRadius(scale);
  let closestPiece: ScenarioPiece | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (let index = pieces.length - 1; index >= 0; index -= 1) {
    const piece = pieces[index];
    const layout = layouts.get(piece.id);
    const center = layout?.center ?? geometry.pieceToWorldPoint(piece);
    const hitRadius =
      (layout?.radius ?? baseRadius) + markerHitSlopPixels / Math.max(scale, minZoom);
    const distance = Math.hypot(worldPoint.x - center.x, worldPoint.y - center.y);
    if (distance > hitRadius || distance >= closestDistance) {
      continue;
    }

    closestPiece = piece;
    closestDistance = distance;
  }

  return closestPiece;
}

function createPieceRenderLayouts(
  pieces: ScenarioPiece[],
  geometry: GridGeometry,
  scale: number
): Map<string, PieceRenderLayout> {
  const layouts = new Map<string, PieceRenderLayout>();
  const groups = new Map<string, ScenarioPiece[]>();

  for (const piece of pieces) {
    const key = getPieceOccupancyKey(piece, geometry.spaceType);
    const group = groups.get(key);
    if (group) {
      group.push(piece);
    } else {
      groups.set(key, [piece]);
    }
  }

  const baseRadius = geometry.markerRadius(scale);

  for (const group of groups.values()) {
    const anchor = geometry.pieceToWorldPoint(group[0]);

    if (group.length === 1) {
      layouts.set(group[0].id, {
        center: anchor,
        radius: baseRadius
      });
      continue;
    }

    const radius = getColocatedMarkerRadius(baseRadius, scale, group.length);
    const offsets = createColocatedMarkerOffsets(
      group.length,
      getColocatedMarkerOrbit(baseRadius, scale, group.length)
    );

    group.forEach((piece, index) => {
      const offset = offsets[index] ?? { x: 0, y: 0 };
      layouts.set(piece.id, {
        center: {
          x: anchor.x + offset.x,
          y: anchor.y + offset.y
        },
        radius
      });
    });
  }

  return layouts;
}

function getPieceOccupancyKey(
  piece: ScenarioPiece,
  spaceType: ScenarioSpace["type"]
): string {
  return spaceType === "free-coordinate" ? `${piece.x},${piece.y}` : `${piece.x}:${piece.y}`;
}

function getColocatedMarkerRadius(
  baseRadius: number,
  scale: number,
  groupSize: number
): number {
  const factor = groupSize <= 2 ? 0.68 : groupSize <= 6 ? 0.6 : 0.52;

  return Math.max(baseRadius * factor, 4 / Math.max(scale, minZoom));
}

function getColocatedMarkerOrbit(
  baseRadius: number,
  scale: number,
  groupSize: number
): number {
  const factor = groupSize <= 3 ? 0.66 : groupSize <= 6 ? 0.76 : 0.88;

  return Math.max(baseRadius * factor, 6 / Math.max(scale, minZoom));
}

function createColocatedMarkerOffsets(count: number, orbitStep: number): Point[] {
  const offsets: Point[] = [];
  let remaining = count;
  let ring = 1;

  while (remaining > 0) {
    const ringCapacity = ring * 6;
    const ringCount = Math.min(remaining, ringCapacity);
    const ringRadius = orbitStep * ring;

    for (let index = 0; index < ringCount; index += 1) {
      const angle = -Math.PI / 2 + (index / ringCount) * Math.PI * 2;
      offsets.push({
        x: Math.cos(angle) * ringRadius,
        y: Math.sin(angle) * ringRadius
      });
    }

    remaining -= ringCount;
    ring += 1;
  }

  return offsets;
}

function getMarkerPositions(pieces: ScenarioPiece[], spaceType: ScenarioSpace["type"]): string {
  return pieces
    .map((piece) =>
      spaceType === "free-coordinate" ? `${piece.x},${piece.y}` : `${piece.x}-${piece.y}`
    )
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

  if (space.type === "free-coordinate") {
    return `${space.bounds.width} by ${space.bounds.height} free-coordinate ${mode}`;
  }

  return `${space.width} by ${space.height} ${space.type} ${mode}`;
}

function getBoardSizeLabel(space: ScenarioSpace): string {
  if (space.type === "free-coordinate") {
    return `${space.bounds.width} x ${space.bounds.height} free, ${space.scale.distancePerWorldUnit} ${space.scale.unit}/unit`;
  }

  const gridType = space.type === "hex-grid" ? "hex" : "square";

  return `${space.width} x ${space.height} ${gridType}, ${space.tileSize}px`;
}

function cssVariable(styles: CSSStyleDeclaration, name: string, fallback: string): string {
  return styles.getPropertyValue(name).trim() || fallback;
}

function colorWithOpacity(color: string, opacity: number): string {
  const match = /^#([0-9a-fA-F]{6})$/.exec(color);
  if (!match) {
    return color;
  }

  const hex = match[1];
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${clamp(opacity, 0, 1)})`;
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
