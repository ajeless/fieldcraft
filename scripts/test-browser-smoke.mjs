#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { isProcessRunning, readState, repoRoot } from "./process-utils.mjs";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5173/";
const startScript = path.join(repoRoot, "scripts", "start.mjs");
const stopScript = path.join(repoRoot, "scripts", "stop.mjs");
const smokeDir = path.join(repoRoot, ".fieldcraft", "smoke");
const menuOpenFixturePath = path.join(smokeDir, "menu-open-scenario.fieldcraft.json");

fs.mkdirSync(smokeDir, { recursive: true });
fs.writeFileSync(menuOpenFixturePath, createMenuOpenFixture(), "utf8");

const before = await readState();
const beforePid = before?.pid;
const beforeWasRunning = beforePid ? isProcessRunning(beforePid) : false;

await runNodeScript(startScript);

const after = await readState();
const afterPid = after?.pid;
const startedForSmoke = Boolean(afterPid && (!beforeWasRunning || afterPid !== beforePid));

let browser;

try {
  const executablePath =
    process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH ??
    (fs.existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : undefined);

  browser = await chromium.launch({
    headless: true,
    executablePath
  });

  const page = await browser.newPage({
    viewport: { width: 1280, height: 820 },
    acceptDownloads: true
  });
  await page.goto(baseUrl);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.waitForSelector('[data-view="editor"]');
  await page.waitForFunction(() => {
    return document.querySelector('[data-testid="marker-count"]')?.textContent === "0";
  });
  await page.waitForSelector('[data-testid="mode-runtime"]:disabled');
  await page.click('[data-testid="theme-dark"]');
  await page.waitForFunction(() => document.documentElement.dataset.theme === "dark");
  await expectStoredTheme(page, "dark");
  await expectInputValue(page, '[data-testid="grid-line-color-input"]', "#536576");
  await expectInputValue(page, '[data-testid="board-background-input"]', "#162129");
  await page.reload();
  await page.waitForSelector('[data-view="editor"]');
  await page.waitForFunction(() => document.documentElement.dataset.theme === "dark");
  await page.waitForSelector('[data-testid="mode-runtime"]:disabled');
  await expectInputValue(page, '[data-testid="grid-line-color-input"]', "#536576");
  await expectInputValue(page, '[data-testid="board-background-input"]', "#162129");

  await createGrid(page, "square", 6, 5);
  await page.waitForSelector('[data-testid="board-surface"][data-view-ready="true"]');
  await expectSurfaceSpace(page, "board-surface", "square-grid");
  await expectCommandEnabled(page, "undo-scenario");
  await expectCommandDisabled(page, "redo-scenario");
  await page.click('[data-testid="undo-scenario"]');
  await expectBoardSetupVisible(page);
  await expectInputValue(page, '[data-testid="grid-width-input"]', "6");
  await expectInputValue(page, '[data-testid="grid-height-input"]', "5");
  await expectCommandDisabled(page, "undo-scenario");
  await expectCommandEnabled(page, "redo-scenario");
  await page.click('[data-testid="redo-scenario"]');
  await page.waitForSelector('[data-testid="board-surface"][data-view-ready="true"]');
  await expectSurfaceSpace(page, "board-surface", "square-grid");
  await placeMarkerFromPalette(page, "board-surface", 2, 1);
  await expectMarkerCount(page, "1");
  await waitForMarker(page, "board-surface", "2-1");
  await page.reload();
  await page.waitForSelector('[data-view="editor"]');
  await expectStatusLine(page, "Recovered session draft");
  await expectSurfaceSpace(page, "board-surface", "square-grid");
  await expectMarkerCount(page, "1");
  await waitForMarker(page, "board-surface", "2-1");
  await expectCommandDisabled(page, "undo-scenario");
  await expectCommandDisabled(page, "redo-scenario");
  await page.click('[data-testid="save-scenario"]');
  await expectStatusLine(page, "Scenario saved");
  const firstRecoveredSave = await page.evaluate(() =>
    window.localStorage.getItem("fieldcraft:last-scenario")
  );
  if (!firstRecoveredSave) {
    throw new Error("Recovered draft save did not update browser storage.");
  }
  const parsedFirstRecoveredSave = JSON.parse(firstRecoveredSave);
  if (
    parsedFirstRecoveredSave.pieces.length !== 1 ||
    !parsedFirstRecoveredSave.pieces.some((piece) => piece.id === "marker-2-1")
  ) {
    throw new Error("Recovered draft save did not preserve the saved marker set.");
  }
  await placeMarkerFromPalette(page, "board-surface", 4, 3);
  await expectMarkerCount(page, "2");
  await waitForMarker(page, "board-surface", "4-3");
  await page.reload();
  await page.waitForSelector('[data-view="editor"]');
  await expectStatusLine(page, "Recovered session draft");
  await expectSurfaceSpace(page, "board-surface", "square-grid");
  await expectMarkerCount(page, "2");
  await waitForMarker(page, "board-surface", "2-1");
  await waitForMarker(page, "board-surface", "4-3");
  const durableSquareSave = await page.evaluate(() =>
    window.localStorage.getItem("fieldcraft:last-scenario")
  );
  if (!durableSquareSave) {
    throw new Error("Saved browser scenario disappeared after draft recovery.");
  }
  const parsedDurableSquareSave = JSON.parse(durableSquareSave);
  if (
    parsedDurableSquareSave.pieces.length !== 1 ||
    !parsedDurableSquareSave.pieces.some((piece) => piece.id === "marker-2-1") ||
    parsedDurableSquareSave.pieces.some((piece) => piece.id === "marker-4-3")
  ) {
    throw new Error("Draft recovery overwrote the saved browser scenario.");
  }
  await dismissConfirm(page, () => page.click('[data-testid="new-scenario"]'));
  await expectSurfaceSpace(page, "board-surface", "square-grid");
  await expectMarkerCount(page, "2");
  await expectNoFileChooser(page, () =>
    dismissConfirm(page, () => page.click('[data-testid="open-scenario"]'))
  );
  await expectSurfaceSpace(page, "board-surface", "square-grid");
  await expectMarkerCount(page, "2");
  await acceptConfirm(page, () => page.click('[data-testid="new-scenario"]'));
  await page.waitForSelector('[data-testid="mode-runtime"]:disabled');

  await openScenarioFromShortcut(page, menuOpenFixturePath);
  await expectMarkerCount(page, "1");
  await expectSurfaceSpace(page, "board-surface", "square-grid");
  await waitForMarker(page, "board-surface", "1-2");
  await page.keyboard.press("Control+S");
  await page.waitForFunction(() => {
    return document.querySelector(".status-line")?.textContent === "Scenario saved";
  });
  const shortcutSavedScenario = await page.evaluate(() =>
    window.localStorage.getItem("fieldcraft:last-scenario")
  );
  if (!shortcutSavedScenario || !shortcutSavedScenario.includes('"title": "Menu Open Fixture"')) {
    throw new Error("Ctrl+S did not save the opened scenario.");
  }
  await page.keyboard.press("Control+N");
  await page.waitForSelector('[data-testid="mode-runtime"]:disabled');
  await expectMarkerCount(page, "0");

  await openScenarioFromSidebar(page, menuOpenFixturePath);
  await expectMarkerCount(page, "1");
  await expectSurfaceSpace(page, "board-surface", "square-grid");
  await waitForMarker(page, "board-surface", "1-2");
  await page.click('[data-testid="new-scenario"]');
  await page.waitForSelector('[data-testid="mode-runtime"]:disabled');
  await expectMarkerCount(page, "0");

  await openScenarioFromMenu(page, menuOpenFixturePath);
  await expectMarkerCount(page, "1");
  await expectSurfaceSpace(page, "board-surface", "square-grid");
  await waitForMarker(page, "board-surface", "1-2");
  await page.click('[data-testid="mode-runtime"]');
  await page.waitForSelector('[data-view="runtime"]');
  await waitForMarker(page, "runtime-board-surface", "1-2");
  await page.click('[data-testid="mode-editor"]');
  await page.waitForSelector('[data-view="editor"]');
  await clickMenuItem(page, "file", "menu-new-scenario");
  await page.waitForSelector('[data-testid="mode-runtime"]:disabled');
  await expectMarkerCount(page, "0");

  await expectInvalidSetupPreservesDraft(page);
  await createGrid(page, "square", 64, 64, {
    tileSize: 48,
    scaleDistance: 5,
    scaleUnit: "km",
    gridLineColor: "#405f73",
    gridLineOpacity: 0.55,
    backgroundColor: "#f4faf7"
  });
  await page.waitForSelector('[data-testid="board-surface"][data-view-ready="true"]');
  await expectSurfaceSpace(page, "board-surface", "square-grid");
  await expectCanvasHasRenderedBoard(page, "board-canvas");
  const cellCount = await page.locator("[data-cell]").count();
  if (cellCount !== 0) {
    throw new Error("Canvas board should not render empty tiles as DOM controls.");
  }
  const homeTransform = await getTransform(page, "board-surface");

  await clickTile(page, "board-surface", 2, 3);
  await page.waitForTimeout(100);
  await expectMarkerCount(page, "0");
  await expectNoSelectedMarker(page);
  await placeMarkerFromPalette(page, "board-surface", 32, 32);
  await expectMarkerCount(page, "1");
  await waitForMarker(page, "board-surface", "32-32");
  await expectSelectedMarker(page, {
    id: "marker-32-32",
    position: "Tile 32, 32"
  });
  await page.keyboard.press("Control+Z");
  await expectMarkerCount(page, "0");
  await expectMarkerMissing(page, "board-surface", "32-32");
  await expectNoSelectedMarker(page);
  await page.keyboard.press("Control+Shift+Z");
  await expectMarkerCount(page, "1");
  await waitForMarker(page, "board-surface", "32-32");
  await expectSelectedMarker(page, {
    id: "marker-32-32",
    position: "Tile 32, 32"
  });
  await updateSelectedMarkerId(page, "lead-marker");
  await expectSelectedMarker(page, {
    id: "lead-marker",
    position: "Tile 32, 32"
  });
  await page.keyboard.press("Control+Z");
  await expectSelectedMarker(page, {
    id: "marker-32-32",
    position: "Tile 32, 32"
  });
  await page.keyboard.press("Control+Shift+Z");
  await expectSelectedMarker(page, {
    id: "lead-marker",
    position: "Tile 32, 32"
  });
  await page.keyboard.press("Control+Z");
  await expectSelectedMarker(page, {
    id: "marker-32-32",
    position: "Tile 32, 32"
  });
  await placeMarkerFromPalette(page, "board-surface", 0, 0);
  await expectMarkerCount(page, "2");
  await waitForMarker(page, "board-surface", "0-0");
  await placeMarkerFromPalette(page, "board-surface", 63, 63);
  await expectMarkerCount(page, "3");
  await waitForMarker(page, "board-surface", "63-63");
  await clickTile(page, "board-surface", 32, 32, { x: 8, y: 0 });
  await expectSelectedMarker(page, {
    id: "marker-32-32",
    position: "Tile 32, 32"
  });
  await clickTile(page, "board-surface", 2, 3);
  await expectNoSelectedMarker(page);
  await clickTile(page, "board-surface", 63, 63);
  await expectSelectedMarker(page, {
    id: "marker-63-63",
    position: "Tile 63, 63"
  });
  await page.keyboard.press("Delete");
  await expectStatusLine(page, "Marker deleted");
  await expectNoSelectedMarker(page);
  await expectMarkerCount(page, "2");
  await expectMarkerMissing(page, "board-surface", "63-63");
  await page.click('[data-testid="undo-scenario"]');
  await expectMarkerCount(page, "3");
  await waitForMarker(page, "board-surface", "63-63");
  await expectSelectedMarker(page, {
    id: "marker-63-63",
    position: "Tile 63, 63"
  });
  await page.click('[data-testid="redo-scenario"]');
  await expectMarkerCount(page, "2");
  await expectMarkerMissing(page, "board-surface", "63-63");
  await expectNoSelectedMarker(page);

  await panSurface(page, "board-surface");
  const pannedTransform = await getTransform(page, "board-surface");
  if (
    Math.abs(pannedTransform.panX - homeTransform.panX) < 1 &&
    Math.abs(pannedTransform.panY - homeTransform.panY) < 1
  ) {
    throw new Error("Ctrl-drag did not pan the board.");
  }
  await zoomSurface(page, "board-surface");
  const zoomedTransform = await getTransform(page, "board-surface");
  if (Math.abs(zoomedTransform.scale - pannedTransform.scale) < 0.001) {
    throw new Error("Mouse wheel did not zoom the board.");
  }
  await page.click('[data-testid="reset-board-view"]');
  await waitForTransform(page, "board-surface", homeTransform);
  await middlePanSurface(page, "board-surface");
  const middlePannedTransform = await getTransform(page, "board-surface");
  if (
    Math.abs(middlePannedTransform.panX - homeTransform.panX) < 1 &&
    Math.abs(middlePannedTransform.panY - homeTransform.panY) < 1
  ) {
    throw new Error("Middle-button drag did not pan the board.");
  }
  await page.click('[data-testid="reset-board-view"]');
  await waitForTransform(page, "board-surface", homeTransform);

  await clickMenuItem(page, "file", "menu-save-scenario");

  const savedScenario = await page.evaluate(() => window.localStorage.getItem("fieldcraft:last-scenario"));
  if (!savedScenario || !savedScenario.includes('"schema": "fieldcraft.scenario.v0"')) {
    throw new Error("Scenario was not saved to browser storage.");
  }
  const parsedScenario = JSON.parse(savedScenario);
  expectTileSpaceSetup(parsedScenario.space, {
    type: "square-grid",
    width: 64,
    height: 64,
    tileSize: 48,
    distancePerTile: 5,
    scaleUnit: "km",
    gridLineColor: "#405f73",
    gridLineOpacity: 0.55,
    backgroundColor: "#f4faf7"
  });
  if (
    parsedScenario.pieces.length !== 2 ||
    !parsedScenario.pieces.some((piece) => piece.id === "marker-32-32") ||
    !parsedScenario.pieces.some((piece) => piece.id === "marker-0-0") ||
    parsedScenario.pieces.some((piece) => piece.id === "marker-63-63")
  ) {
    throw new Error("Saved scenario did not preserve marker deletion.");
  }

  await expectScenarioDownload(page, () => clickMenuItem(page, "file", "menu-save-as-scenario"));
  await expectScenarioDownload(page, () => page.click('[data-testid="save-as-scenario"]'));
  await expectScenarioDownload(page, () => page.keyboard.press("Control+Shift+S"));
  await page.waitForFunction(() => {
    return document.querySelector(".status-line")?.textContent === "Scenario downloaded";
  });

  await page.click('[data-testid="mode-runtime"]');
  await page.waitForSelector('[data-view="runtime"]');
  await waitForMarker(page, "runtime-board-surface", "32-32");
  await waitForMarker(page, "runtime-board-surface", "0-0");
  await expectMarkerMissing(page, "runtime-board-surface", "63-63");
  await page.click('[data-testid="mode-editor"]');
  await page.waitForSelector('[data-view="editor"]');

  await page.click('[data-testid="new-scenario"]');
  await page.waitForSelector('[data-testid="mode-runtime"]:disabled');
  await createGrid(page, "hex", 18, 14);
  await page.waitForSelector('[data-testid="board-surface"][data-view-ready="true"]');
  await expectSurfaceSpace(page, "board-surface", "hex-grid");
  await expectCanvasHasRenderedBoard(page, "board-canvas");
  const hexCellCount = await page.locator("[data-cell]").count();
  if (hexCellCount !== 0) {
    throw new Error("Hex canvas board should not render empty tiles as DOM controls.");
  }
  const hexHomeTransform = await getTransform(page, "board-surface");

  await clickTile(page, "board-surface", 3, 4);
  await page.waitForTimeout(100);
  await expectMarkerCount(page, "0");
  await placeMarkerFromPalette(page, "board-surface", 9, 7);
  await expectMarkerCount(page, "1");
  await waitForMarker(page, "board-surface", "9-7");
  await expectSelectedMarker(page, {
    id: "marker-9-7",
    position: "Tile 9, 7"
  });
  await placeMarkerFromPalette(page, "board-surface", 0, 0);
  await expectMarkerCount(page, "2");
  await waitForMarker(page, "board-surface", "0-0");
  await placeMarkerFromPalette(page, "board-surface", 17, 13);
  await expectMarkerCount(page, "3");
  await waitForMarker(page, "board-surface", "17-13");
  await placeMarkerFromPalette(page, "board-surface", 0, 13);
  await expectMarkerCount(page, "4");
  await waitForMarker(page, "board-surface", "0-13");
  await clickTile(page, "board-surface", 9, 7, { x: 7, y: 0 });
  await expectSelectedMarker(page, {
    id: "marker-9-7",
    position: "Tile 9, 7"
  });
  await clickTile(page, "board-surface", 17, 13);
  await expectSelectedMarker(page, {
    id: "marker-17-13",
    position: "Tile 17, 13"
  });
  await panBoardToBottomRightSliver(page, "board-surface");
  const extremePannedTransform = await getTransform(page, "board-surface");
  const extremeDropTile = await getVisibleUnmarkedTile(page, "board-surface");
  const extremeDropMarker = `${extremeDropTile.x}-${extremeDropTile.y}`;
  await placeMarkerFromPalette(page, "board-surface", extremeDropTile.x, extremeDropTile.y);
  await expectMarkerCount(page, "5");
  await waitForMarker(page, "board-surface", extremeDropMarker);
  await clickTile(page, "board-surface", extremeDropTile.x, extremeDropTile.y);
  await expectSelectedMarker(page, {
    id: `marker-${extremeDropMarker}`,
    position: `Tile ${extremeDropTile.x}, ${extremeDropTile.y}`
  });
  const afterExtremeDropTransform = await getTransform(page, "board-surface");
  if (!transformsAreClose(afterExtremeDropTransform, extremePannedTransform)) {
    throw new Error("Marker drop reset an extreme panned hex board.");
  }
  await page.click('[data-testid="reset-board-view"]');
  await waitForTransform(page, "board-surface", hexHomeTransform);

  await panSurface(page, "board-surface");
  const hexPannedTransform = await getTransform(page, "board-surface");
  if (
    Math.abs(hexPannedTransform.panX - hexHomeTransform.panX) < 1 &&
    Math.abs(hexPannedTransform.panY - hexHomeTransform.panY) < 1
  ) {
    throw new Error("Ctrl-drag did not pan the hex board.");
  }
  await zoomSurface(page, "board-surface");
  const hexZoomedTransform = await getTransform(page, "board-surface");
  if (Math.abs(hexZoomedTransform.scale - hexPannedTransform.scale) < 0.001) {
    throw new Error("Mouse wheel did not zoom the hex board.");
  }
  await page.click('[data-testid="reset-board-view"]');
  await waitForTransform(page, "board-surface", hexHomeTransform);
  await middlePanSurface(page, "board-surface");
  const hexMiddlePannedTransform = await getTransform(page, "board-surface");
  if (
    Math.abs(hexMiddlePannedTransform.panX - hexHomeTransform.panX) < 1 &&
    Math.abs(hexMiddlePannedTransform.panY - hexHomeTransform.panY) < 1
  ) {
    throw new Error("Middle-button drag did not pan the hex board.");
  }
  await page.click('[data-testid="reset-board-view"]');
  await waitForTransform(page, "board-surface", hexHomeTransform);

  await page.click('[data-testid="save-scenario"]');
  const savedHexScenario = await page.evaluate(() => window.localStorage.getItem("fieldcraft:last-scenario"));
  if (!savedHexScenario) {
    throw new Error("Hex scenario was not saved to browser storage.");
  }
  const parsedHexScenario = JSON.parse(savedHexScenario);
  expectTileSpaceSetup(parsedHexScenario.space, {
    type: "hex-grid",
    width: 18,
    height: 14,
    tileSize: 28,
    distancePerTile: 1,
    scaleUnit: "tile",
    gridLineColor: "#536576",
    gridLineOpacity: 1,
    backgroundColor: "#162129"
  });
  if (
    parsedHexScenario.space?.type !== "hex-grid" ||
    parsedHexScenario.pieces.length !== 5 ||
    !parsedHexScenario.pieces.some((piece) => piece.id === "marker-9-7") ||
    !parsedHexScenario.pieces.some((piece) => piece.id === "marker-0-0") ||
    !parsedHexScenario.pieces.some((piece) => piece.id === "marker-17-13") ||
    !parsedHexScenario.pieces.some((piece) => piece.id === "marker-0-13") ||
    !parsedHexScenario.pieces.some((piece) => piece.id === `marker-${extremeDropMarker}`)
  ) {
    throw new Error("Saved hex scenario did not preserve dragged markers.");
  }

  await page.click('[data-testid="mode-runtime"]');
  await page.waitForSelector('[data-view="runtime"]');
  await expectSurfaceSpace(page, "runtime-board-surface", "hex-grid");
  await expectCanvasHasRenderedBoard(page, "runtime-board-canvas");
  await waitForMarker(page, "runtime-board-surface", "9-7");
  await waitForMarker(page, "runtime-board-surface", "0-0");
  await waitForMarker(page, "runtime-board-surface", "17-13");
  await waitForMarker(page, "runtime-board-surface", "0-13");
  await waitForMarker(page, "runtime-board-surface", extremeDropMarker);
  await page.click('[data-testid="mode-editor"]');
  await page.waitForSelector('[data-view="editor"]');

  await page.click('[data-testid="new-scenario"]');
  await page.waitForSelector('[data-testid="mode-runtime"]:disabled');
  await createFreeCoordinateBoard(page, {
    x: -50,
    y: -25,
    width: 200,
    height: 120,
    scaleDistance: 10,
    scaleUnit: "m",
    backgroundColor: "#f6fbf3"
  });
  await page.waitForSelector('[data-testid="board-surface"][data-view-ready="true"]');
  await expectSurfaceSpace(page, "board-surface", "free-coordinate");
  await expectCanvasHasRenderedBoard(page, "board-canvas");
  const freeHomeTransform = await getTransform(page, "board-surface");

  await placeMarkerAtFreeCoordinate(page, "board-surface", 10, 10);
  await expectMarkerCount(page, "1");
  await waitForFreeMarkerNear(page, "board-surface", 10, 10);
  await page.click('[data-testid="undo-scenario"]');
  await expectMarkerCount(page, "0");
  await expectMarkerMissing(page, "board-surface", "10,10");
  await page.click('[data-testid="redo-scenario"]');
  await expectMarkerCount(page, "1");
  await waitForFreeMarkerNear(page, "board-surface", 10, 10);
  await page.click('[data-testid="undo-scenario"]');
  await expectMarkerCount(page, "0");
  await expectNoSelectedMarker(page);
  await placeMarkerAtFreeCoordinate(page, "board-surface", 0, 0);
  await expectMarkerCount(page, "1");
  await waitForFreeMarkerNear(page, "board-surface", 0, 0);
  await expectSelectedMarker(page, {
    near: { x: 0, y: 0, tolerance: 0.75 }
  });
  await placeMarkerAtFreeCoordinate(page, "board-surface", 73.25, 18.5);
  await expectMarkerCount(page, "2");
  await waitForFreeMarkerNear(page, "board-surface", 73.25, 18.5);
  await placeMarkerAtFreeCoordinate(page, "board-surface", -49.5, 94.75);
  await expectMarkerCount(page, "3");
  await waitForFreeMarkerNear(page, "board-surface", -49.5, 94.75);

  await panSurface(page, "board-surface");
  const freePannedTransform = await getTransform(page, "board-surface");
  if (
    Math.abs(freePannedTransform.panX - freeHomeTransform.panX) < 1 &&
    Math.abs(freePannedTransform.panY - freeHomeTransform.panY) < 1
  ) {
    throw new Error("Ctrl-drag did not pan the free-coordinate board.");
  }
  await zoomSurface(page, "board-surface");
  const freeZoomedTransform = await getTransform(page, "board-surface");
  if (Math.abs(freeZoomedTransform.scale - freePannedTransform.scale) < 0.001) {
    throw new Error("Mouse wheel did not zoom the free-coordinate board.");
  }
  await clickFreeCoordinate(page, "board-surface", 73.25, 18.5);
  await expectSelectedMarker(page, {
    near: { x: 73.25, y: 18.5, tolerance: 0.75 }
  });
  await page.click('[data-testid="reset-board-view"]');
  await waitForTransform(page, "board-surface", freeHomeTransform);

  await page.click('[data-testid="save-scenario"]');
  const savedFreeScenario = await page.evaluate(() => window.localStorage.getItem("fieldcraft:last-scenario"));
  if (!savedFreeScenario) {
    throw new Error("Free-coordinate scenario was not saved to browser storage.");
  }
  const parsedFreeScenario = JSON.parse(savedFreeScenario);
  expectFreeCoordinateSetup(parsedFreeScenario.space, {
    x: -50,
    y: -25,
    width: 200,
    height: 120,
    distancePerWorldUnit: 10,
    scaleUnit: "m",
    backgroundColor: "#f6fbf3"
  });
  const freeMarkerKeys = [
    freeMarkerKey(expectFreePieceNear(parsedFreeScenario.pieces, 0, 0)),
    freeMarkerKey(expectFreePieceNear(parsedFreeScenario.pieces, 73.25, 18.5)),
    freeMarkerKey(expectFreePieceNear(parsedFreeScenario.pieces, -49.5, 94.75))
  ];
  if (parsedFreeScenario.pieces.length !== 3) {
    throw new Error("Saved free-coordinate scenario did not preserve dragged markers.");
  }

  await page.click('[data-testid="mode-runtime"]');
  await page.waitForSelector('[data-view="runtime"]');
  await expectSurfaceSpace(page, "runtime-board-surface", "free-coordinate");
  await expectCanvasHasRenderedBoard(page, "runtime-board-canvas");
  for (const markerKey of freeMarkerKeys) {
    await waitForMarker(page, "runtime-board-surface", markerKey);
  }
  await page.click('[data-testid="mode-editor"]');
  await page.waitForSelector('[data-view="editor"]');

  console.log("Browser smoke passed: square, hex, and free-coordinate editor placement, persistence, and runtime checks passed.");
} finally {
  if (browser) {
    await browser.close();
  }

  if (startedForSmoke) {
    await runNodeScript(stopScript);
  }
}

function runNodeScript(scriptPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: repoRoot,
      stdio: "inherit"
    });

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${path.basename(scriptPath)} exited with code ${code}`));
      }
    });
  });
}

function createMenuOpenFixture() {
  return `${JSON.stringify(
    {
      schema: "fieldcraft.scenario.v0",
      title: "Menu Open Fixture",
      space: {
        type: "square-grid",
        width: 4,
        height: 4,
        tileSize: 48,
        scale: {
          distancePerTile: 1,
          unit: "tile"
        },
        grid: {
          lineColor: "#aeb8c1",
          lineOpacity: 1
        },
        background: {
          color: "#f9fbfb"
        }
      },
      pieces: [
        {
          id: "marker-1-2",
          kind: "marker",
          side: "neutral",
          x: 1,
          y: 2
        }
      ],
      metadata: {
        editorVersion: "0.1.0-experiment",
        savedAt: null
      }
    },
    null,
    2
  )}\n`;
}

async function createGrid(page, gridType, width, height, options = {}) {
  await page.check(`[data-testid="space-${gridType}-grid"]`);
  await page.fill('[data-testid="grid-width-input"]', String(width));
  await page.fill('[data-testid="grid-height-input"]', String(height));
  if (options.tileSize !== undefined) {
    await page.fill('[data-testid="tile-size-input"]', String(options.tileSize));
  }
  if (options.scaleDistance !== undefined) {
    await page.fill('[data-testid="scale-distance-input"]', String(options.scaleDistance));
  }
  if (options.scaleUnit !== undefined) {
    await page.fill('[data-testid="scale-unit-input"]', String(options.scaleUnit));
  }
  if (options.gridLineColor !== undefined) {
    await setInputValue(page, '[data-testid="grid-line-color-input"]', options.gridLineColor);
  }
  if (options.gridLineOpacity !== undefined) {
    await page.fill('[data-testid="grid-line-opacity-input"]', String(options.gridLineOpacity));
  }
  if (options.backgroundColor !== undefined) {
    await setInputValue(page, '[data-testid="board-background-input"]', options.backgroundColor);
  }
  await page.click('[data-testid="create-board"]');
}

async function createFreeCoordinateBoard(page, options) {
  await page.check('[data-testid="space-free-coordinate"]');
  await page.waitForSelector('[data-testid="free-x-input"]');
  await page.fill('[data-testid="free-x-input"]', String(options.x));
  await page.fill('[data-testid="free-y-input"]', String(options.y));
  await page.fill('[data-testid="free-width-input"]', String(options.width));
  await page.fill('[data-testid="free-height-input"]', String(options.height));
  await page.fill('[data-testid="free-scale-distance-input"]', String(options.scaleDistance));
  await page.fill('[data-testid="free-scale-unit-input"]', String(options.scaleUnit));
  await setInputValue(page, '[data-testid="free-background-input"]', options.backgroundColor);
  await page.click('[data-testid="create-board"]');
}

async function expectInvalidSetupPreservesDraft(page) {
  await page.check('[data-testid="space-hex-grid"]');
  await page.fill('[data-testid="grid-width-input"]', "18");
  await page.fill('[data-testid="grid-height-input"]', "14");
  await page.fill('[data-testid="scale-unit-input"]', "km");
  await setInputValue(page, '[data-testid="tile-size-input"]', "");
  await page.click('[data-testid="create-board"]');
  await page.waitForFunction(() => {
    return document.querySelector(".status-line")?.textContent === "Board setup values are out of range";
  });
  if (!(await page.locator('[data-testid="space-hex-grid"]').isChecked())) {
    throw new Error("Invalid setup reset the selected hex grid choice.");
  }
  await expectInputValue(page, '[data-testid="grid-width-input"]', "18");
  await expectInputValue(page, '[data-testid="grid-height-input"]', "14");
  await expectInputValue(page, '[data-testid="scale-unit-input"]', "km");
  await expectInputValue(page, '[data-testid="tile-size-input"]', "");
}

async function expectInputValue(page, selector, expectedValue) {
  const value = await page.locator(selector).inputValue();
  if (value !== expectedValue) {
    throw new Error(`${selector} was reset to ${JSON.stringify(value)}.`);
  }
}

async function expectStatusLine(page, expectedValue) {
  await page.waitForFunction((value) => {
    return document.querySelector(".status-line")?.textContent === value;
  }, expectedValue);
}

async function expectStoredTheme(page, expectedTheme) {
  const storedTheme = await page.evaluate(() => window.localStorage.getItem("fieldcraft:theme"));
  if (storedTheme !== expectedTheme) {
    throw new Error(`Theme preference was ${JSON.stringify(storedTheme)}.`);
  }
}

async function acceptConfirm(page, action) {
  await Promise.all([
    page.waitForEvent("dialog").then(async (dialog) => {
      if (dialog.type() !== "confirm") {
        throw new Error(`Expected confirm dialog, got ${dialog.type()}.`);
      }
      await dialog.accept();
    }),
    action()
  ]);
}

async function dismissConfirm(page, action) {
  await Promise.all([
    page.waitForEvent("dialog").then(async (dialog) => {
      if (dialog.type() !== "confirm") {
        throw new Error(`Expected confirm dialog, got ${dialog.type()}.`);
      }
      await dialog.dismiss();
    }),
    action()
  ]);
}

async function expectNoFileChooser(page, action) {
  const fileChooserOpened = page
    .waitForEvent("filechooser", { timeout: 300 })
    .then(() => true)
    .catch(() => false);

  await action();

  if (await fileChooserOpened) {
    throw new Error("File chooser opened unexpectedly.");
  }
}

async function clickMenuItem(page, menuId, itemTestId) {
  await page.click(`[data-testid="menu-${menuId}"]`);
  await page.click(`[data-testid="${itemTestId}"]`);
}

async function openScenarioFromMenu(page, filePath) {
  const fileChooserPromise = page.waitForEvent("filechooser");
  await clickMenuItem(page, "file", "menu-open-scenario");
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(filePath);
}

async function openScenarioFromShortcut(page, filePath) {
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.keyboard.press("Control+O");
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(filePath);
}

async function openScenarioFromSidebar(page, filePath) {
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.click('[data-testid="open-scenario"]');
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(filePath);
}

async function expectScenarioDownload(page, action) {
  const downloadPromise = page.waitForEvent("download");
  await action();
  const download = await downloadPromise;
  if (download.suggestedFilename() !== "fieldcraft-scenario.json") {
    throw new Error(`Unexpected scenario download filename: ${download.suggestedFilename()}`);
  }
  await download.delete();
}

async function setInputValue(page, selector, value) {
  await page.locator(selector).evaluate((input, nextValue) => {
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Target is not an input.");
    }

    input.value = nextValue;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

function expectTileSpaceSetup(space, expected) {
  if (
    space?.type !== expected.type ||
    space.width !== expected.width ||
    space.height !== expected.height ||
    space.tileSize !== expected.tileSize ||
    space.scale?.distancePerTile !== expected.distancePerTile ||
    space.scale?.unit !== expected.scaleUnit ||
    space.grid?.lineColor !== expected.gridLineColor ||
    Math.abs(space.grid?.lineOpacity - expected.gridLineOpacity) > 0.0001 ||
    space.background?.color !== expected.backgroundColor
  ) {
    throw new Error(`Scenario space setup was not saved readably: ${JSON.stringify(space)}`);
  }
}

function expectFreeCoordinateSetup(space, expected) {
  if (
    space?.type !== "free-coordinate" ||
    space.bounds?.x !== expected.x ||
    space.bounds?.y !== expected.y ||
    space.bounds?.width !== expected.width ||
    space.bounds?.height !== expected.height ||
    space.scale?.distancePerWorldUnit !== expected.distancePerWorldUnit ||
    space.scale?.unit !== expected.scaleUnit ||
    space.background?.color !== expected.backgroundColor
  ) {
    throw new Error(`Free-coordinate setup was not saved readably: ${JSON.stringify(space)}`);
  }
}

function expectFreePieceNear(pieces, x, y, tolerance = 0.75) {
  const piece = pieces.find((candidate) =>
    closeTo(candidate.x, x, tolerance) && closeTo(candidate.y, y, tolerance)
  );

  if (!piece) {
    throw new Error(`Expected a free-coordinate marker near ${x},${y}: ${JSON.stringify(pieces)}`);
  }

  return piece;
}

function freeMarkerKey(piece) {
  return `${piece.x},${piece.y}`;
}

function closeTo(value, target, tolerance) {
  return Number.isFinite(value) && Math.abs(value - target) <= tolerance;
}

async function clickTile(page, surfaceTestId, x, y, offset = { x: 0, y: 0 }) {
  await waitForSurfaceReady(page, surfaceTestId);
  const surface = page.locator(`[data-testid="${surfaceTestId}"]`);
  await surface.waitFor({ state: "visible" });
  const point = await getTileViewportPoint(page, surfaceTestId, x, y);

  await surface.click({
    position: {
      x: point.x + offset.x,
      y: point.y + offset.y
    }
  });
}

async function placeMarkerFromPalette(page, surfaceTestId, x, y) {
  await waitForSurfaceReady(page, surfaceTestId);
  const point = await getTileViewportPoint(page, surfaceTestId, x, y);

  await page.dragAndDrop('[data-testid="palette-marker"]', `[data-testid="${surfaceTestId}"]`, {
    targetPosition: point
  });
}

async function placeMarkerAtFreeCoordinate(page, surfaceTestId, x, y) {
  await waitForSurfaceReady(page, surfaceTestId);
  const point = await getFreeCoordinateViewportPoint(page, surfaceTestId, x, y);

  await page.dragAndDrop('[data-testid="palette-marker"]', `[data-testid="${surfaceTestId}"]`, {
    targetPosition: point
  });
}

async function clickFreeCoordinate(page, surfaceTestId, x, y) {
  await waitForSurfaceReady(page, surfaceTestId);
  const surface = page.locator(`[data-testid="${surfaceTestId}"]`);
  const point = await getFreeCoordinateViewportPoint(page, surfaceTestId, x, y);

  await surface.click({ position: point });
}

async function panBoardToBottomRightSliver(page, surfaceTestId) {
  await waitForSurfaceReady(page, surfaceTestId);
  const target = await page.locator(`[data-testid="${surfaceTestId}"]`).evaluate((surface) => {
    const rect = surface.getBoundingClientRect();

    return {
      deltaX: rect.width - 130 - Number(surface.getAttribute("data-view-pan-x")),
      deltaY: rect.height - 180 - Number(surface.getAttribute("data-view-pan-y"))
    };
  });

  await panSurfaceBy(page, surfaceTestId, target.deltaX, target.deltaY);
}

async function panSurfaceBy(page, surfaceTestId, deltaX, deltaY) {
  const box = await getSurfaceBox(page, surfaceTestId);
  const start = {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2
  };

  await page.keyboard.down("Control");
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + deltaX, start.y + deltaY, { steps: 10 });
  await page.mouse.up();
  await page.keyboard.up("Control");
}

async function getVisibleUnmarkedTile(page, surfaceTestId) {
  await waitForSurfaceReady(page, surfaceTestId);
  const surface = page.locator(`[data-testid="${surfaceTestId}"]`);
  const board = await surface.evaluate((element) => {
    const rect = element.getBoundingClientRect();

    return {
      width: rect.width,
      height: rect.height,
      columns: Number(element.getAttribute("data-board-columns")),
      rows: Number(element.getAttribute("data-board-rows")),
      markedTiles: (element.getAttribute("data-marker-positions") ?? "")
        .split(" ")
        .filter(Boolean)
    };
  });

  for (let y = board.rows - 1; y >= 0; y -= 1) {
    for (let x = board.columns - 1; x >= 0; x -= 1) {
      if (board.markedTiles.includes(`${x}-${y}`)) {
        continue;
      }

      const point = await getTileViewportPoint(page, surfaceTestId, x, y);
      if (
        point.x >= 14 &&
        point.y >= 14 &&
        point.x <= board.width - 14 &&
        point.y <= board.height - 14
      ) {
        return { x, y };
      }
    }
  }

  throw new Error("Could not find a visible unmarked tile for marker placement.");
}

async function getTileViewportPoint(page, surfaceTestId, x, y) {
  const surface = page.locator(`[data-testid="${surfaceTestId}"]`);

  return surface.evaluate((node, tile) => {
    const element = node;
    const scale = Number(element.dataset.viewScale);
    const rotation = Number(element.dataset.viewRotation);
    const panX = Number(element.dataset.viewPanX);
    const panY = Number(element.dataset.viewPanY);
    const worldWidth = Number(element.dataset.boardWorldWidth);
    const worldHeight = Number(element.dataset.boardWorldHeight);
    const columns = Number(element.dataset.boardColumns);
    const rows = Number(element.dataset.boardRows);
    const spaceType = element.dataset.boardSpaceType;

    if (
      !Number.isFinite(scale) ||
      !Number.isFinite(rotation) ||
      !Number.isFinite(panX) ||
      !Number.isFinite(panY) ||
      !Number.isFinite(worldWidth) ||
      !Number.isFinite(worldHeight) ||
      !Number.isFinite(columns) ||
      !Number.isFinite(rows) ||
      !spaceType
    ) {
      throw new Error("Board viewport did not expose coordinate metadata.");
    }

    let worldX;
    let worldY;
    if (spaceType === "hex-grid") {
      const radius = worldHeight / (rows * 1.5 + 0.5);
      const hexWidth = Math.sqrt(3) * radius;

      worldX = hexWidth / 2 + tile.x * hexWidth + (tile.y % 2 === 1 ? hexWidth / 2 : 0);
      worldY = radius + tile.y * radius * 1.5;
    } else if (spaceType === "square-grid") {
      worldX = (tile.x + 0.5) * (worldWidth / columns);
      worldY = (tile.y + 0.5) * (worldHeight / rows);
    } else {
      throw new Error(`Unsupported board space type: ${spaceType}`);
    }
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);

    return {
      x: worldX * scale * cos - worldY * scale * sin + panX,
      y: worldX * scale * sin + worldY * scale * cos + panY
    };
  }, { x, y });
}

async function getFreeCoordinateViewportPoint(page, surfaceTestId, x, y) {
  const surface = page.locator(`[data-testid="${surfaceTestId}"]`);

  return surface.evaluate((node, point) => {
    const element = node;
    const scale = Number(element.dataset.viewScale);
    const rotation = Number(element.dataset.viewRotation);
    const panX = Number(element.dataset.viewPanX);
    const panY = Number(element.dataset.viewPanY);
    const worldWidth = Number(element.dataset.boardWorldWidth);
    const worldHeight = Number(element.dataset.boardWorldHeight);
    const boundsX = Number(element.dataset.boardBoundsX);
    const boundsY = Number(element.dataset.boardBoundsY);
    const spaceType = element.dataset.boardSpaceType;

    if (
      spaceType !== "free-coordinate" ||
      !Number.isFinite(scale) ||
      !Number.isFinite(rotation) ||
      !Number.isFinite(panX) ||
      !Number.isFinite(panY) ||
      !Number.isFinite(worldWidth) ||
      !Number.isFinite(worldHeight) ||
      !Number.isFinite(boundsX) ||
      !Number.isFinite(boundsY)
    ) {
      throw new Error("Free-coordinate board viewport did not expose coordinate metadata.");
    }

    if (
      point.x < boundsX ||
      point.y < boundsY ||
      point.x > boundsX + worldWidth ||
      point.y > boundsY + worldHeight
    ) {
      throw new Error(`Free-coordinate point is outside board bounds: ${JSON.stringify(point)}`);
    }

    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);

    return {
      x: point.x * scale * cos - point.y * scale * sin + panX,
      y: point.x * scale * sin + point.y * scale * cos + panY
    };
  }, { x, y });
}

async function expectSurfaceSpace(page, surfaceTestId, expectedType) {
  await page.waitForFunction(
    ({ testId, type }) => {
      return document.querySelector(`[data-testid="${testId}"]`)?.getAttribute("data-board-space-type") === type;
    },
    {
      testId: surfaceTestId,
      type: expectedType
    }
  );
}

async function expectCanvasHasRenderedBoard(page, canvasTestId) {
  await page.waitForFunction((testId) => {
    const canvas = document.querySelector(`[data-testid="${testId}"]`);
    if (!(canvas instanceof HTMLCanvasElement) || canvas.width <= 0 || canvas.height <= 0) {
      return false;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return false;
    }

    const colors = new Set();
    const samples = 16;
    for (let yIndex = 0; yIndex < samples; yIndex += 1) {
      const y = Math.min(
        canvas.height - 1,
        Math.max(0, Math.floor(((yIndex + 0.5) / samples) * canvas.height))
      );
      for (let xIndex = 0; xIndex < samples; xIndex += 1) {
        const x = Math.min(
          canvas.width - 1,
          Math.max(0, Math.floor(((xIndex + 0.5) / samples) * canvas.width))
        );
        const [red, green, blue, alpha] = context.getImageData(x, y, 1, 1).data;

        if (alpha > 0) {
          colors.add(`${red}-${green}-${blue}`);
        }
        if (colors.size > 1) {
          return true;
        }
      }
    }

    return false;
  }, canvasTestId);
}

async function expectMarkerCount(page, count) {
  await page.waitForFunction((expectedCount) => {
    return document.querySelector('[data-testid="marker-count"]')?.textContent === expectedCount;
  }, count);
}

async function expectCommandEnabled(page, testId) {
  await page.waitForFunction((commandTestId) => {
    const button = document.querySelector(`[data-testid="${commandTestId}"]`);
    return button instanceof HTMLButtonElement && !button.disabled;
  }, testId);
}

async function expectCommandDisabled(page, testId) {
  await page.waitForFunction((commandTestId) => {
    const button = document.querySelector(`[data-testid="${commandTestId}"]`);
    return button instanceof HTMLButtonElement && button.disabled;
  }, testId);
}

async function expectBoardSetupVisible(page) {
  await page.waitForSelector('[data-testid="create-board"]');
  await page.waitForFunction(() => !document.querySelector('[data-testid="board-surface"]'));
}

async function expectSelectedMarker(page, expected = {}) {
  await page.waitForFunction(({ id, position, near }) => {
    const emptyState = document.querySelector('[data-testid="selected-marker-empty"]');
    const kind = document.querySelector('[data-testid="selected-marker-kind"]')?.textContent;
    const selectedId = document.querySelector('[data-testid="selected-marker-id"]')?.textContent;
    const selectedPosition = document.querySelector(
      '[data-testid="selected-marker-position"]'
    )?.textContent;
    const deleteButton = document.querySelector('[data-testid="delete-selected-marker"]');
    const matchesNearPosition =
      near === null ||
      matchesCoordinateText(selectedPosition, near.x, near.y, near.tolerance);

    return (
      !emptyState &&
      kind === "Marker" &&
      (id === null || selectedId === id) &&
      (position === null || selectedPosition === position) &&
      matchesNearPosition &&
      deleteButton instanceof HTMLButtonElement &&
      !deleteButton.disabled
    );

    function matchesCoordinateText(text, x, y, tolerance) {
      if (typeof text !== "string") {
        return false;
      }

      const match = text.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
      if (!match) {
        return false;
      }

      return (
        Math.abs(Number(match[1]) - x) <= tolerance &&
        Math.abs(Number(match[2]) - y) <= tolerance
      );
    }
  }, {
    id: expected.id ?? null,
    position: expected.position ?? null,
    near: expected.near ?? null
  });
}

async function expectNoSelectedMarker(page) {
  await page.waitForFunction(() => {
    const emptyState = document.querySelector('[data-testid="selected-marker-empty"]');
    const deleteButton = document.querySelector('[data-testid="delete-selected-marker"]');

    return (
      emptyState instanceof HTMLElement &&
      deleteButton instanceof HTMLButtonElement &&
      deleteButton.disabled
    );
  });
}

async function updateSelectedMarkerId(page, value) {
  const input = page.locator('[data-testid="selected-marker-id-input"]');
  await input.fill(value);
  await input.blur();
}

async function panSurface(page, surfaceTestId) {
  const box = await getSurfaceBox(page, surfaceTestId);
  const start = {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2
  };

  await page.keyboard.down("Control");
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 80, start.y + 48, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.up("Control");
}

async function middlePanSurface(page, surfaceTestId) {
  const box = await getSurfaceBox(page, surfaceTestId);
  const start = {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2
  };

  await page.mouse.move(start.x, start.y);
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(start.x - 72, start.y - 40, { steps: 6 });
  await page.mouse.up({ button: "middle" });
}

async function zoomSurface(page, surfaceTestId) {
  const box = await getSurfaceBox(page, surfaceTestId);

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -360);
}

async function getTransform(page, surfaceTestId) {
  await waitForSurfaceReady(page, surfaceTestId);

  return page.locator(`[data-testid="${surfaceTestId}"]`).evaluate((surface) => ({
    scale: Number(surface.getAttribute("data-view-scale")),
    panX: Number(surface.getAttribute("data-view-pan-x")),
    panY: Number(surface.getAttribute("data-view-pan-y"))
  }));
}

async function waitForTransform(page, surfaceTestId, expected) {
  await page.waitForFunction(
    ({ testId, expectedTransform }) => {
      const surface = document.querySelector(`[data-testid="${testId}"]`);

      return (
        closeTo(Number(surface?.getAttribute("data-view-scale")), expectedTransform.scale) &&
        closeTo(Number(surface?.getAttribute("data-view-pan-x")), expectedTransform.panX) &&
        closeTo(Number(surface?.getAttribute("data-view-pan-y")), expectedTransform.panY)
      );

      function closeTo(actual, target) {
        return Number.isFinite(actual) && Math.abs(actual - target) < 0.01;
      }
    },
    {
      testId: surfaceTestId,
      expectedTransform: expected
    }
  );
}

function transformsAreClose(actual, expected) {
  return (
    closeTo(actual.scale, expected.scale) &&
    closeTo(actual.panX, expected.panX) &&
    closeTo(actual.panY, expected.panY)
  );

  function closeTo(value, target) {
    return Number.isFinite(value) && Math.abs(value - target) < 0.01;
  }
}

async function getSurfaceBox(page, surfaceTestId) {
  const surface = page.locator(`[data-testid="${surfaceTestId}"]`);
  const box = await surface.boundingBox();

  if (!box) {
    throw new Error(`Board surface ${surfaceTestId} is not visible.`);
  }

  return box;
}

async function waitForMarker(page, surfaceTestId, markerPosition) {
  await page.waitForFunction(
    ({ testId, marker }) => {
      const surface = document.querySelector(`[data-testid="${testId}"]`);
      const positions = surface?.getAttribute("data-marker-positions");

      return (
        hasFiniteAttribute(surface, "data-view-scale") &&
        hasFiniteAttribute(surface, "data-view-pan-x") &&
        hasFiniteAttribute(surface, "data-view-pan-y") &&
        positions?.split(" ").includes(marker)
      );

      function hasFiniteAttribute(element, name) {
        const value = element?.getAttribute(name);

        return value !== null && Number.isFinite(Number(value));
      }
    },
    {
      testId: surfaceTestId,
      marker: markerPosition
    }
  );
}

async function expectMarkerMissing(page, surfaceTestId, markerPosition) {
  await page.waitForFunction(
    ({ testId, marker }) => {
      const surface = document.querySelector(`[data-testid="${testId}"]`);
      const positions = (surface?.getAttribute("data-marker-positions") ?? "")
        .split(" ")
        .filter(Boolean);

      return (
        hasFiniteAttribute(surface, "data-view-scale") &&
        hasFiniteAttribute(surface, "data-view-pan-x") &&
        hasFiniteAttribute(surface, "data-view-pan-y") &&
        !positions.includes(marker)
      );

      function hasFiniteAttribute(element, name) {
        const value = element?.getAttribute(name);

        return value !== null && Number.isFinite(Number(value));
      }
    },
    {
      testId: surfaceTestId,
      marker: markerPosition
    }
  );
}

async function waitForFreeMarkerNear(page, surfaceTestId, x, y, tolerance = 0.75) {
  await page.waitForFunction(
    ({ testId, point, allowedDrift }) => {
      const surface = document.querySelector(`[data-testid="${testId}"]`);
      const positions = (surface?.getAttribute("data-marker-positions") ?? "")
        .split(" ")
        .filter(Boolean)
        .map((position) => {
          const [markerX, markerY] = position.split(",").map(Number);

          return { x: markerX, y: markerY };
        });

      return (
        hasFiniteAttribute(surface, "data-view-scale") &&
        hasFiniteAttribute(surface, "data-view-pan-x") &&
        hasFiniteAttribute(surface, "data-view-pan-y") &&
        positions.some((marker) =>
          Number.isFinite(marker.x) &&
          Number.isFinite(marker.y) &&
          Math.abs(marker.x - point.x) <= allowedDrift &&
          Math.abs(marker.y - point.y) <= allowedDrift
        )
      );

      function hasFiniteAttribute(element, name) {
        const value = element?.getAttribute(name);

        return value !== null && Number.isFinite(Number(value));
      }
    },
    {
      testId: surfaceTestId,
      point: { x, y },
      allowedDrift: tolerance
    }
  );
}

async function waitForSurfaceReady(page, surfaceTestId) {
  await page.waitForFunction((testId) => {
    const surface = document.querySelector(`[data-testid="${testId}"]`);
    const spaceType = surface?.getAttribute("data-board-space-type");

    return (
      hasFiniteAttribute(surface, "data-view-scale") &&
      hasFiniteAttribute(surface, "data-view-rotation") &&
      hasFiniteAttribute(surface, "data-view-pan-x") &&
      hasFiniteAttribute(surface, "data-view-pan-y") &&
      hasKnownSpaceType(spaceType) &&
      hasFiniteAttribute(surface, "data-board-bounds-x") &&
      hasFiniteAttribute(surface, "data-board-bounds-y") &&
      hasFiniteAttribute(surface, "data-board-world-width") &&
      hasFiniteAttribute(surface, "data-board-world-height") &&
      hasExpectedGridMetadata(surface, spaceType)
    );

    function hasFiniteAttribute(element, name) {
      const value = element?.getAttribute(name);

      return value !== null && Number.isFinite(Number(value));
    }

    function hasKnownSpaceType(value) {
      return value === "square-grid" || value === "hex-grid" || value === "free-coordinate";
    }

    function hasExpectedGridMetadata(element, value) {
      if (value === "free-coordinate") {
        return true;
      }

      return (
        hasFiniteAttribute(element, "data-board-columns") &&
        hasFiniteAttribute(element, "data-board-rows")
      );
    }
  }, surfaceTestId);
}
