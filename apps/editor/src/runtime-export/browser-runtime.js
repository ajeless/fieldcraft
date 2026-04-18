const homePadding = 40;
const minZoom = 0.04;
const maxZoom = 5;
const resizeRecoveryVisibleRatio = 0.08;
const imageResourceCache = new Map();

const app = document.querySelector("#app");
const bundleElement = document.querySelector("#fieldcraft-runtime-export-bundle");

if (!app) {
  throw new Error("Missing runtime export mount point.");
}

if (!(bundleElement instanceof HTMLScriptElement) || !bundleElement.textContent) {
  throw new Error("Missing runtime export bundle.");
}

const bundle = JSON.parse(bundleElement.textContent);
const scenario = bundle.scenario;
const bundledAssets = bundle.assets ?? {};

if (!scenario?.space) {
  renderError("This runtime export does not include a configured board.");
} else {
  renderRuntime();
}

function renderRuntime() {
  app.innerHTML = "";

  const shell = element("main", "runtime-export-shell");
  shell.dataset.view = "runtime-export";

  const sidebar = element("aside", "runtime-export-sidebar");
  const metrics = element("div", "runtime-export-metrics");
  metrics.append(
    createMetric("Board", getBoardLabel(scenario.space)),
    createMetric("Markers", String(scenario.pieces.length)),
    createMetric("Assets", String(scenario.assets.length)),
    createMetric("Generated", formatGeneratedAt(bundle.generatedAt))
  );
  sidebar.append(
    element("p", "runtime-export-eyebrow", "Fieldcraft Browser Runtime"),
    element("h1", "runtime-export-title", scenario.title),
    element(
      "p",
      "runtime-export-copy",
      "Self-contained export with inline scenario data and bundled asset payloads."
    ),
    metrics,
    element(
      "p",
      "runtime-export-meta",
      getBackgroundSummary(scenario, bundledAssets)
    )
  );

  const stage = element("section", "runtime-export-stage");
  const stageHeader = element("div", "runtime-export-stage-header");
  stageHeader.append(
    element("h2", "runtime-export-stage-title", "Runtime View"),
    element("p", "runtime-export-meta", "Read-only board preview")
  );
  stage.append(stageHeader, createBoardViewport());

  shell.append(sidebar, stage);
  app.append(shell);
}

function renderError(message) {
  app.innerHTML = "";

  const wrapper = element("main", "runtime-export-error");
  const panel = element("section", "runtime-export-error-panel");
  panel.append(
    element("h1", "", "Runtime export could not start"),
    element("p", "", message)
  );
  wrapper.append(panel);
  app.append(wrapper);
}

function createBoardViewport() {
  const space = scenario.space;
  const geometry = createGridGeometry(space);
  const backgroundImageUrl = resolveBackgroundImageUrl();
  const backgroundImageResource = backgroundImageUrl
    ? getImageResource(backgroundImageUrl)
    : null;
  const pieceImageResources = createPieceImageResourceMap(scenario.pieces);
  const state = {
    boardKey: null,
    transform: null,
    viewportSize: {
      width: 0,
      height: 0
    }
  };
  const viewport = element("section", "runtime-export-board-viewport");
  const toolbar = element("div", "runtime-export-board-toolbar");
  const surface = element("div", "runtime-export-board-surface");
  const canvas = document.createElement("canvas");
  const zoomLabel = element("span", "runtime-export-zoom-label", "100%");
  const zoomOutButton = createButton("-", "Zoom out", "zoom-out-board");
  const resetButton = createButton("Reset View", "Reset board view", "reset-board-view");
  const zoomInButton = createButton("+", "Zoom in", "zoom-in-board");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas rendering is not available.");
  }

  viewport.dataset.testid = "runtime-board-viewport";
  canvas.className = "runtime-export-board-canvas";
  canvas.dataset.testid = "runtime-board-canvas";
  canvas.setAttribute("aria-label", getCanvasLabel(space));
  surface.dataset.testid = "runtime-board-surface";
  surface.dataset.markerPositions = getMarkerPositions(scenario.pieces, space.type);
  surface.dataset.backgroundImageStatus = backgroundImageResource ? "loading" : "none";
  surface.dataset.backgroundImagePath = getBackgroundImagePath();
  surface.dataset.boardSpaceType = space.type;

  zoomOutButton.addEventListener("click", () => {
    zoomAtViewportCenter(state, 1 / 1.18);
    draw();
  });
  zoomInButton.addEventListener("click", () => {
    zoomAtViewportCenter(state, 1.18);
    draw();
  });
  resetButton.addEventListener("click", () => {
    resetToHome(state, geometry);
    draw();
  });
  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      ensureTransform(state, geometry);
      const viewportPoint = screenPointToViewportPoint(
        {
          x: event.clientX,
          y: event.clientY
        },
        surface
      );
      zoomAtViewportPoint(state, viewportPoint, event.deltaY < 0 ? 1.12 : 1 / 1.12);
      draw();
    },
    { passive: false }
  );

  const pointerController = createPointerPanController({
    canvas,
    surface,
    state,
    geometry,
    draw
  });
  canvas.addEventListener("pointerdown", pointerController.handlePointerDown);
  canvas.addEventListener("pointermove", pointerController.handlePointerMove);
  canvas.addEventListener("pointerup", pointerController.handlePointerUp);
  canvas.addEventListener("pointercancel", pointerController.handlePointerCancel);
  canvas.addEventListener("auxclick", (event) => {
    if (event.button === 1) {
      event.preventDefault();
    }
  });

  toolbar.append(
    element("span", "runtime-export-board-size", getBoardSizeLabel(space)),
    zoomOutButton,
    resetButton,
    zoomInButton,
    zoomLabel
  );
  surface.append(canvas);
  viewport.append(toolbar, surface);

  const resizeObserver = new ResizeObserver(() => draw({ recoverHiddenView: true }));
  resizeObserver.observe(surface);
  const handleWindowResize = () => draw({ recoverHiddenView: true });
  window.addEventListener("resize", handleWindowResize);

  const handleBackgroundImageUpdate = () => {
    surface.dataset.backgroundImageStatus = backgroundImageResource?.status ?? "none";
    draw();
  };
  backgroundImageResource?.listeners.add(handleBackgroundImageUpdate);
  for (const resource of pieceImageResources.values()) {
    resource.listeners.add(handleBackgroundImageUpdate);
  }

  const cleanupObserver = new MutationObserver(() => {
    if (!viewport.isConnected) {
      resizeObserver.disconnect();
      cleanupObserver.disconnect();
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

  surface.dataset.backgroundImageStatus = backgroundImageResource?.status ?? "none";
  window.requestAnimationFrame(() => draw());

  return viewport;

  function draw(drawOptions = {}) {
    const size = syncCanvasSize(canvas, surface);
    if (size.width <= 0 || size.height <= 0) {
      return;
    }

    const previousSize = state.viewportSize;
    state.viewportSize = size;
    ensureTransform(state, geometry);

    let transform = state.transform;
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
      resetToHome(state, geometry);
      transform = state.transform;
      if (!transform) {
        return;
      }
    }

    const styles = getComputedStyle(document.documentElement);
    const colors = {
      boardFill: space.background.color || cssVariable(styles, "--runtime-stage", "#e8eef1"),
      boardLine: isTileSpace(space)
        ? space.grid.lineColor || cssVariable(styles, "--runtime-muted", "#9db2be")
        : cssVariable(styles, "--runtime-muted", "#9db2be"),
      boardLineOpacity: isTileSpace(space) ? space.grid.lineOpacity : 1
    };
    const markerFill = cssVariable(styles, "--runtime-marker", "#d24b3f");
    const markerRing = cssVariable(styles, "--runtime-marker-ring", "#61221e");
    const viewportFill = cssVariable(styles, "--runtime-stage", "#e8eef1");
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
    drawMarkers(context, geometry, scenario.pieces, {
      scale: transform.scale,
      markerFill,
      markerRing,
      pieceImageResources
    });
    context.restore();

    updateSurfaceData(
      surface,
      geometry,
      transform,
      scenario.pieces,
      backgroundImageResource,
      pieceImageResources
    );
    surface.dataset.backgroundImageStatus = backgroundImageResource?.status ?? "none";
    zoomLabel.textContent = `${Math.round(transform.scale * 100)}%`;
  }
}

function createGridGeometry(space) {
  switch (space.type) {
    case "square-grid":
      return createSquareGridGeometry(space);
    case "hex-grid":
      return createHexGridGeometry(space);
    case "free-coordinate":
      return createFreeCoordinateGeometry(space);
    default:
      throw new Error(`Unsupported space type: ${space.type}`);
  }
}

function createSquareGridGeometry(space) {
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
    pieceToWorldPoint: (piece) => ({
      x: (piece.x + 0.5) * tileSize,
      y: (piece.y + 0.5) * tileSize
    })
  };
}

function createHexGridGeometry(space) {
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

  const tileToWorldCenter = (tile) => ({
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
    pieceToWorldPoint: tileToWorldCenter
  };
}

function createFreeCoordinateGeometry(space) {
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
    })
  };
}

function getImageResource(url) {
  const cached = imageResourceCache.get(url);
  if (cached) {
    return cached;
  }

  const image = new Image();
  const resource = {
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

function createPieceImageResourceMap(pieces) {
  const resources = new Map();

  for (const piece of pieces) {
    const imageUrl = resolvePieceImageUrl(piece);
    if (!imageUrl) {
      continue;
    }

    resources.set(piece.id, getImageResource(imageUrl));
  }

  return resources;
}

function createPointerPanController(options) {
  let drag = null;

  return {
    handlePointerDown: (event) => {
      if (event.button !== 0 && event.button !== 1) {
        return;
      }

      event.preventDefault();
      options.surface.classList.add("is-panning");
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
        pointerId: event.pointerId,
        startPoint,
        startPan: {
          x: transform.panX,
          y: transform.panY
        }
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
      const transform = options.state.transform;
      if (!transform) {
        return;
      }

      transform.panX = drag.startPan.x + currentPoint.x - drag.startPoint.x;
      transform.panY = drag.startPan.y + currentPoint.y - drag.startPoint.y;
      options.draw();
    },
    handlePointerUp: (event) => {
      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }

      options.canvas.releasePointerCapture(event.pointerId);
      options.surface.classList.remove("is-panning");
      drag = null;
    },
    handlePointerCancel: (event) => {
      if (drag?.pointerId === event.pointerId) {
        drag = null;
        options.surface.classList.remove("is-panning");
      }
    }
  };
}

function ensureTransform(state, geometry) {
  if (state.boardKey !== geometry.key || !state.transform) {
    state.boardKey = geometry.key;
    resetToHome(state, geometry);
  }
}

function resetToHome(state, geometry) {
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

function zoomAtViewportCenter(state, factor) {
  zoomAtViewportPoint(
    state,
    {
      x: state.viewportSize.width / 2,
      y: state.viewportSize.height / 2
    },
    factor
  );
}

function zoomAtViewportPoint(state, viewportPoint, factor) {
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

function shouldRecoverViewAfterResize(previousSize, size, geometry, transform, recoverHiddenView) {
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

function getViewportBoardVisibleArea(size, geometry, transform) {
  const bounds = getTransformedBounds(geometry.bounds, transform);
  const left = Math.max(0, bounds.x);
  const top = Math.max(0, bounds.y);
  const right = Math.min(size.width, bounds.x + bounds.width);
  const bottom = Math.min(size.height, bounds.y + bounds.height);
  return Math.max(0, right - left) * Math.max(0, bottom - top);
}

function getTransformedBounds(bounds, transform) {
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

function drawMarkers(context, geometry, pieces, options) {
  const layouts = createPieceRenderLayouts(pieces, geometry, options.scale);
  const baseRadius = geometry.markerRadius(options.scale);

  for (const piece of pieces) {
    const layout = layouts.get(piece.id);
    const center = layout?.center ?? geometry.pieceToWorldPoint(piece);
    const radius = layout?.radius ?? baseRadius;

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

function drawDefaultMarker(context, center, radius, scale, markerFill, markerRing) {
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

function drawMarkerImage(context, center, radius, image) {
  context.save();
  context.beginPath();
  context.arc(center.x, center.y, radius, 0, Math.PI * 2);
  context.clip();
  context.drawImage(image, center.x - radius, center.y - radius, radius * 2, radius * 2);
  context.restore();
}

function createPieceRenderLayouts(pieces, geometry, scale) {
  const layouts = new Map();
  const groups = new Map();

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

function syncCanvasSize(canvas, surface) {
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
  surface,
  geometry,
  transform,
  pieces,
  backgroundImageResource,
  pieceImageResources
) {
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
}

function getMarkerImageStates(pieces, pieceImageResources) {
  return pieces
    .filter((piece) => piece.imageAssetId)
    .map((piece) => `${piece.id}:${pieceImageResources.get(piece.id)?.status ?? "missing"}`)
    .sort((left, right) => left.localeCompare(right))
    .join(" ");
}

function getMarkerPositions(pieces, spaceType) {
  return pieces
    .map((piece) => (spaceType === "free-coordinate" ? `${piece.x},${piece.y}` : `${piece.x}-${piece.y}`))
    .sort((left, right) => left.localeCompare(right))
    .join(" ");
}

function getPieceOccupancyKey(piece, spaceType) {
  return spaceType === "free-coordinate" ? `${piece.x},${piece.y}` : `${piece.x}:${piece.y}`;
}

function getColocatedMarkerRadius(baseRadius, scale, groupSize) {
  const factor = groupSize <= 2 ? 0.68 : groupSize <= 6 ? 0.6 : 0.52;
  return Math.max(baseRadius * factor, 4 / Math.max(scale, minZoom));
}

function getColocatedMarkerOrbit(baseRadius, scale, groupSize) {
  const factor = groupSize <= 3 ? 0.66 : groupSize <= 6 ? 0.76 : 0.88;
  return Math.max(baseRadius * factor, 6 / Math.max(scale, minZoom));
}

function createColocatedMarkerOffsets(count, orbitStep) {
  const offsets = [];
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

function applyViewportTransform(context, transform) {
  context.translate(transform.panX, transform.panY);
  context.rotate(transform.rotation);
  context.scale(transform.scale, transform.scale);
}

function viewportPointToWorldPoint(point, transform) {
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

function worldPointToViewportPoint(point, transform) {
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

function screenPointToViewportPoint(point, surface) {
  const rect = surface.getBoundingClientRect();
  return {
    x: point.x - rect.left,
    y: point.y - rect.top
  };
}

function tracePointyHexGrid(context, space, tileToWorldCenter, hexRadius) {
  for (let row = 0; row < space.height; row += 1) {
    for (let column = 0; column < space.width; column += 1) {
      tracePointyHexPath(context, tileToWorldCenter({ x: column, y: row }), hexRadius);
    }
  }
}

function tracePointyHexPath(context, center, hexRadius) {
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

function getHexRowOffset(row, hexWidth) {
  return row % 2 === 1 ? hexWidth / 2 : 0;
}

function getBackgroundSummary(scenarioValue, assetsByPath) {
  const backgroundAsset = getBackgroundImageAsset(scenarioValue);
  if (!backgroundAsset) {
    return "No bundled background image.";
  }

  return assetsByPath[backgroundAsset.path]
    ? `Bundled background image: ${backgroundAsset.id}`
    : `Background image missing from export payload: ${backgroundAsset.id}`;
}

function resolveBackgroundImageUrl() {
  const backgroundAsset = getBackgroundImageAsset(scenario);
  if (!backgroundAsset) {
    return null;
  }

  return bundledAssets[backgroundAsset.path]?.dataUrl ?? null;
}

function resolvePieceImageUrl(piece) {
  const imageAsset = getPieceImageAsset(piece);
  if (!imageAsset) {
    return null;
  }

  return bundledAssets[imageAsset.path]?.dataUrl ?? null;
}

function getBackgroundImageAsset(scenarioValue) {
  const backgroundImageAssetId = scenarioValue?.space?.background?.imageAssetId;
  if (!backgroundImageAssetId) {
    return null;
  }

  return scenarioValue.assets.find((asset) => asset.id === backgroundImageAssetId) ?? null;
}

function getPieceImageAsset(piece) {
  if (!piece?.imageAssetId) {
    return null;
  }

  return scenario.assets.find((asset) => asset.id === piece.imageAssetId) ?? null;
}

function getBackgroundImagePath() {
  return getBackgroundImageAsset(scenario)?.path ?? "";
}

function isTileSpace(space) {
  return space.type === "square-grid" || space.type === "hex-grid";
}

function getBoardLabel(space) {
  if (!isTileSpace(space)) {
    return `${space.bounds.width} x ${space.bounds.height} free @ ${space.bounds.x},${space.bounds.y}`;
  }

  const gridType = space.type === "hex-grid" ? "hex" : "square";
  return `${space.width} x ${space.height} ${gridType}, ${space.tileSize}px`;
}

function getBoardSizeLabel(space) {
  if (!isTileSpace(space)) {
    return `${space.bounds.width} x ${space.bounds.height} free board`;
  }

  return `${space.width} x ${space.height} ${space.type}`;
}

function getCanvasLabel(space) {
  if (space.type === "free-coordinate") {
    return `${space.bounds.width} by ${space.bounds.height} free-coordinate board`;
  }

  return `${space.width} by ${space.height} ${space.type} board`;
}

function formatGeneratedAt(value) {
  if (typeof value !== "string" || value.length === 0) {
    return "Unknown";
  }

  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? "Unknown" : timestamp.toLocaleString();
}

function createMetric(label, value) {
  const item = element("div", "runtime-export-metric");
  item.append(
    element("span", "runtime-export-metric-label", label),
    element("strong", "runtime-export-metric-value", value)
  );
  return item;
}

function createButton(label, ariaLabel, testId) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "runtime-export-button";
  button.textContent = label;
  button.setAttribute("aria-label", ariaLabel);
  button.title = ariaLabel;
  button.dataset.testid = testId;
  return button;
}

function element(tagName, className, text) {
  const node = document.createElement(tagName);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

function cssVariable(styles, name, fallback) {
  const value = styles.getPropertyValue(name).trim();
  return value.length > 0 ? value : fallback;
}

function colorWithOpacity(color, opacity) {
  if (opacity >= 1) {
    return color;
  }

  const parsed = /^#([0-9a-f]{6})$/i.exec(color);
  if (!parsed) {
    return color;
  }

  const hex = parsed[1];
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
