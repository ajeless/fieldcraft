#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import {
  checkPort,
  pnpmCommand,
  repoRoot,
  stopProcessTree,
  waitForUrl
} from "./process-utils.mjs";

const browserSmokePort = Number.parseInt(process.env.FIELDCRAFT_BROWSER_SMOKE_PORT ?? "5182", 10);
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${browserSmokePort}/`;
const smokeDir = path.join(repoRoot, ".fieldcraft", "smoke");
const menuOpenFixturePath = path.join(smokeDir, "menu-open-scenario.fieldcraft.json");
const oversizedGridFixturePath = path.join(
  smokeDir,
  "oversized-grid-scenario.fieldcraft.json"
);
const duplicateMarkerIdFixturePath = path.join(
  smokeDir,
  "duplicate-marker-id-scenario.fieldcraft.json"
);
const legacyV0FixturePath = path.join(smokeDir, "legacy-v0-scenario.fieldcraft.json");
const currentSchemaVersion = 2;

fs.mkdirSync(smokeDir, { recursive: true });
fs.writeFileSync(menuOpenFixturePath, createMenuOpenFixture(), "utf8");
fs.writeFileSync(oversizedGridFixturePath, createOversizedGridFixture(), "utf8");
fs.writeFileSync(duplicateMarkerIdFixturePath, createDuplicateMarkerIdFixture(), "utf8");
fs.writeFileSync(legacyV0FixturePath, createLegacyV0Fixture(), "utf8");

const frontend = process.env.PLAYWRIGHT_BASE_URL ? null : await startFrontendServer();

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
  await page.waitForSelector('[data-testid="document-command-bar"]');
  await page.waitForFunction(() => {
    return document.querySelector('[data-testid="marker-count"]')?.textContent === "0";
  });
  await page.waitForSelector('[data-testid="mode-runtime"]:disabled');
  await expectCommandDisabled(page, "palette-marker");
  await expectCommandDisabled(page, "export-runtime-scenario");
  if (!(await page.locator('[data-testid="import-image-asset"]').isDisabled())) {
    throw new Error("Browser mode should not enable desktop image imports.");
  }
  if (!(await page.locator('[data-testid="import-audio-asset"]').isDisabled())) {
    throw new Error("Browser mode should not enable desktop audio imports.");
  }
  await page.click('[data-testid="theme-dark"]');
  await page.waitForFunction(() => document.documentElement.dataset.theme === "dark");
  await expectStoredTheme(page, "dark");
  await expectInputValue(page, '[data-testid="grid-line-color-input"]', "#1e2a36");
  await expectInputValue(page, '[data-testid="board-background-input"]', "#0d131a");
  await page.reload();
  await page.waitForSelector('[data-view="editor"]');
  await page.waitForFunction(() => document.documentElement.dataset.theme === "dark");
  await page.waitForSelector('[data-testid="mode-runtime"]:disabled');
  await expectInputValue(page, '[data-testid="grid-line-color-input"]', "#1e2a36");
  await expectInputValue(page, '[data-testid="board-background-input"]', "#0d131a");

  await createGrid(page, "square", 6, 5);
  await page.waitForSelector('[data-testid="board-surface"][data-view-ready="true"]');
  await expectSurfaceSpace(page, "board-surface", "square-grid");
  await expectCommandEnabled(page, "undo-scenario");
  await expectCommandDisabled(page, "redo-scenario");
  await expectCommandEnabled(page, "export-runtime-scenario");
  await page.click('[data-testid="undo-scenario"]');
  await expectBoardSetupVisible(page);
  await expectInputValue(page, '[data-testid="grid-width-input"]', "6");
  await expectInputValue(page, '[data-testid="grid-height-input"]', "5");
  await expectCommandDisabled(page, "undo-scenario");
  await expectCommandEnabled(page, "redo-scenario");
  await page.click('[data-testid="redo-scenario"]');
  await page.waitForSelector('[data-testid="board-surface"][data-view-ready="true"]');
  await expectSurfaceSpace(page, "board-surface", "square-grid");
  await expectCommandEnabled(page, "palette-marker");
  await placeMarkerFromPalette(page, "board-surface", 2, 1);
  await expectMarkerCount(page, "1");
  await waitForMarker(page, "board-surface", "2-1");
  await page.reload();
  await page.waitForSelector('[data-view="editor"]');
  await expectStatusLine(page, "Recovered session draft");
  await expectSurfaceSpace(page, "board-surface", "square-grid");
  await expectCommandEnabled(page, "palette-marker");
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
    !parsedFirstRecoveredSave.pieces.some((piece) => piece.x === 2 && piece.y === 1)
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
    !parsedDurableSquareSave.pieces.some((piece) => piece.x === 2 && piece.y === 1) ||
    parsedDurableSquareSave.pieces.some((piece) => piece.x === 4 && piece.y === 3)
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
  await openScenarioFromSidebar(page, oversizedGridFixturePath);
  await expectStatusLine(page, "File is not a Fieldcraft scenario.");
  await expectMarkerCount(page, "1");
  await expectSurfaceSpace(page, "board-surface", "square-grid");
  await waitForMarker(page, "board-surface", "1-2");
  await openScenarioFromSidebar(page, duplicateMarkerIdFixturePath);
  await expectStatusLine(page, "Scenario contains duplicate marker ID: piece_FIXT01");
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

  // Exercise the v0 → v1 upgrade path on file open.
  await openScenarioFromMenu(page, legacyV0FixturePath);
  await expectStatusLine(page, `Loaded ${path.basename(legacyV0FixturePath)} (upgraded to current format)`);
  await expectMarkerCount(page, "2");
  await expectSurfaceSpace(page, "board-surface", "square-grid");
  await waitForMarker(page, "board-surface", "0-0");
  await waitForMarker(page, "board-surface", "2-1");

  await page.click('[data-testid="save-scenario"]');
  await expectStatusLine(page, "Scenario saved");

  const upgradedScenarioText = await page.evaluate(() =>
    window.localStorage.getItem("fieldcraft:last-scenario")
  );
  if (!upgradedScenarioText) {
    throw new Error("Upgraded scenario did not write to browser storage.");
  }
  const upgradedScenario = JSON.parse(upgradedScenarioText);
  if (
    upgradedScenario.schema !== "fieldcraft.scenario" ||
    upgradedScenario.schemaVersion !== currentSchemaVersion
  ) {
    throw new Error(
      `Saved upgraded scenario has wrong schema fields: ${upgradedScenario.schema} / ${upgradedScenario.schemaVersion}`
    );
  }
  if (
    !upgradedScenario.pieces.every(
      (piece) => typeof piece.label === "string" && /^piece_[0-9A-Z]{6}$/.test(piece.id)
    )
  ) {
    throw new Error("Upgraded scenario pieces missing opaque id or label field.");
  }
  const labels = upgradedScenario.pieces.map((piece) => piece.label);
  if (!labels.includes("marker-0-0") || !labels.includes("scout-alpha")) {
    throw new Error(`Upgraded scenario lost original ids as labels: ${JSON.stringify(labels)}`);
  }

  await page.click('[data-testid="new-scenario"]');
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
    id: "",
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
    id: "",
    position: "Tile 32, 32"
  });
  await updateSelectedMarkerLabel(page, "lead-marker");
  await expectSelectedMarker(page, {
    id: "lead-marker",
    position: "Tile 32, 32"
  });
  await page.keyboard.press("Control+Z");
  await expectSelectedMarker(page, {
    id: "",
    position: "Tile 32, 32"
  });
  await page.keyboard.press("Control+Shift+Z");
  await expectSelectedMarker(page, {
    id: "lead-marker",
    position: "Tile 32, 32"
  });
  await page.keyboard.press("Control+Z");
  await expectSelectedMarker(page, {
    id: "",
    position: "Tile 32, 32"
  });
  await placeMarkerFromPalette(page, "board-surface", 32, 32);
  await expectMarkerCount(page, "2");
  await expectMarkerPositionOccurrences(page, "board-surface", "32-32", 2);
  await placeMarkerFromPalette(page, "board-surface", 32, 32);
  await expectMarkerCount(page, "3");
  await expectMarkerPositionOccurrences(page, "board-surface", "32-32", 3);
  await clickStackedTileMarker(page, "board-surface", 32, 32, 0);
  const stackedSelectionA = await getSelectedMarkerId(page);
  await clickStackedTileMarker(page, "board-surface", 32, 32, 1);
  const stackedSelectionB = await getSelectedMarkerId(page);
  await clickStackedTileMarker(page, "board-surface", 32, 32, 2);
  const stackedSelectionC = await getSelectedMarkerId(page);
  if (
    !stackedSelectionA ||
    !stackedSelectionB ||
    !stackedSelectionC ||
    new Set([stackedSelectionA, stackedSelectionB, stackedSelectionC]).size !== 3
  ) {
    throw new Error("Colocated square-grid markers were not independently selectable.");
  }
  const deletedStackedMarkerId = stackedSelectionC;
  await page.keyboard.press("Delete");
  await expectStatusLine(page, "Marker deleted");
  await expectNoSelectedMarker(page);
  await expectMarkerCount(page, "2");
  await expectMarkerPositionOccurrences(page, "board-surface", "32-32", 2);
  await clickStackedTileMarker(page, "board-surface", 32, 32, 0);
  const remainingStackSelection = await getSelectedMarkerId(page);
  if (!remainingStackSelection || remainingStackSelection === deletedStackedMarkerId) {
    throw new Error("Deleting one colocated square-grid marker removed stack inspection.");
  }
  await placeMarkerFromPalette(page, "board-surface", 0, 0);
  await expectMarkerCount(page, "3");
  await waitForMarker(page, "board-surface", "0-0");
  await placeMarkerFromPalette(page, "board-surface", 63, 63);
  await expectMarkerCount(page, "4");
  await waitForMarker(page, "board-surface", "63-63");
  await clickTile(page, "board-surface", 2, 3);
  await expectNoSelectedMarker(page);
  await clickTile(page, "board-surface", 63, 63);
  await expectSelectedMarker(page, {
    position: "Tile 63, 63"
  });
  await page.keyboard.press("Delete");
  await expectStatusLine(page, "Marker deleted");
  await expectNoSelectedMarker(page);
  await expectMarkerCount(page, "3");
  await expectMarkerMissing(page, "board-surface", "63-63");
  await page.click('[data-testid="undo-scenario"]');
  await expectMarkerCount(page, "4");
  await waitForMarker(page, "board-surface", "63-63");
  await expectSelectedMarker(page, {
    position: "Tile 63, 63"
  });
  await page.keyboard.press("Control+Y");
  await expectMarkerCount(page, "3");
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

  await updateSourceEditorJson(page, (scenario) => {
    scenario.title = "Source Applied Fixture";
    scenario.pieces.push({
      id: "source-stack-marker",
      label: "source-stack-marker",
      kind: "marker",
      side: "neutral",
      x: 32,
      y: 32
    });
    return scenario;
  });
  await page.click('[data-testid="apply-source"]');
  await expectStatusLine(page, "Source applied");
  await expectInputValue(page, '[data-testid="scenario-title-input"]', "Source Applied Fixture");
  await expectMarkerCount(page, "4");
  await expectMarkerPositionOccurrences(page, "board-surface", "32-32", 3);
  await page.click('[data-testid="scenario-source-input"]');
  await page.keyboard.press("Control+Z");
  await expectInputValue(
    page,
    '[data-testid="scenario-title-input"]',
    "Untitled Fieldcraft Scenario"
  );
  await expectMarkerCount(page, "3");
  await expectMarkerPositionOccurrences(page, "board-surface", "32-32", 2);
  await page.keyboard.press("Control+Shift+Z");
  await expectInputValue(page, '[data-testid="scenario-title-input"]', "Source Applied Fixture");
  await expectMarkerCount(page, "4");
  await expectMarkerPositionOccurrences(page, "board-surface", "32-32", 3);
  const appliedSquareSource = await readSourceEditorValue(page);
  await setSourceEditorSelection(page, 0, 0);
  await expectSourceEditorFocused(page);
  await page.keyboard.press("Tab");
  await expectSourceEditorFocused(page);
  const indentedSquareSource = await readSourceEditorValue(page);
  if (!indentedSquareSource.startsWith("  {")) {
    throw new Error("Tab did not indent the source editor.");
  }
  await page.keyboard.press("Shift+Tab");
  await expectSourceEditorFocused(page);
  if ((await readSourceEditorValue(page)) !== appliedSquareSource) {
    throw new Error("Shift+Tab did not restore the source editor indentation.");
  }

  await updateSourceEditorJson(page, (scenario) => {
    scenario.assets = [
      {
        id: "test-board-image",
        kind: "image",
        path: "export-fixtures/checkerboard-32.png"
      },
      {
        id: "test-tone",
        kind: "audio",
        path: "export-fixtures/test-tone-440hz.wav"
      }
    ];
    scenario.space.background.imageAssetId = "test-board-image";
    return scenario;
  });
  await page.click('[data-testid="apply-source"]');
  await expectStatusLine(page, "Source applied");
  await expectMetricValue(page, "asset-count", "2");
  await expectMetricValue(page, "board-background-image-asset", "test-board-image");

  await updateSourceEditorJson(page, (scenario) => {
    scenario.space.background.imageAssetId = "test-tone";
    return scenario;
  });
  await page.click('[data-testid="apply-source"]');
  await expectStatusLine(page, "Scenario background asset must be an image: test-tone");
  await expectSourceEditorErrorState(page, true);
  await expectMetricValue(page, "asset-count", "2");
  await expectMetricValue(page, "board-background-image-asset", "test-board-image");
  await page.click('[data-testid="reset-source"]');
  await expectStatusLine(page, "Source reset to editor state");
  await expectSourceEditorErrorState(page, false);
  await clickTile(page, "board-surface", 0, 0);
  await expectSelectedMarker(page, {
    position: "Tile 0, 0"
  });
  const squareImageMarkerId = await page.locator('[data-testid="selected-marker-id"]').textContent();
  if (!squareImageMarkerId) {
    throw new Error("Could not read the selected square marker id.");
  }
  await page.selectOption('[data-testid="selected-marker-image-select"]', "test-board-image");
  await expectStatusLine(page, "Marker image updated");
  await page.waitForFunction(
    (pieceId) => {
      const states =
        document.querySelector('[data-testid="board-surface"]')?.dataset.markerImageStates ?? "";
      return states.split(" ").includes(`${pieceId}:ready`);
    },
    squareImageMarkerId
  );

  await page.click('[data-testid="save-scenario"]');
  await expectStatusLine(page, "Scenario saved");

  const savedScenario = await page.evaluate(() =>
    window.localStorage.getItem("fieldcraft:last-scenario")
  );
  if (
    !savedScenario ||
    !savedScenario.includes('"schema": "fieldcraft.scenario"') ||
    !savedScenario.includes(`"schemaVersion": ${currentSchemaVersion}`)
  ) {
    throw new Error("Scenario was not saved to browser storage.");
  }
  const parsedScenario = JSON.parse(savedScenario);
  if (parsedScenario.title !== "Source Applied Fixture") {
    throw new Error(`Saved square scenario title was ${JSON.stringify(parsedScenario.title)}.`);
  }
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
    parsedScenario.assets.length !== 2 ||
    !parsedScenario.assets.some(
      (asset) => asset.id === "test-board-image" && asset.kind === "image"
    ) ||
    !parsedScenario.assets.some((asset) => asset.id === "test-tone" && asset.kind === "audio") ||
    parsedScenario.space?.background?.imageAssetId !== "test-board-image" ||
    parsedScenario.pieces.length !== 4 ||
    parsedScenario.pieces.filter((piece) => piece.x === 32 && piece.y === 32).length !== 3 ||
    !parsedScenario.pieces.some((piece) => piece.x === 0 && piece.y === 0) ||
    !parsedScenario.pieces.some(
      (piece) => piece.id === squareImageMarkerId && piece.imageAssetId === "test-board-image"
    ) ||
    !parsedScenario.pieces.some((piece) => piece.label === "source-stack-marker") ||
    parsedScenario.pieces.some((piece) => piece.id === deletedStackedMarkerId) ||
    parsedScenario.pieces.some((piece) => piece.x === 63 && piece.y === 63)
  ) {
    throw new Error("Saved scenario did not preserve colocated marker deletion.");
  }

  const invalidSquareSource = '{\n  "schema": "fieldcraft.scenario"\n';
  await setSourceEditorValue(page, invalidSquareSource);
  await page.click('[data-testid="apply-source"]');
  await expectStatusLine(page, "Source is not valid JSON at line 3, column 1.");
  await expectSourceEditorErrorState(page, true);
  await expectMarkerCount(page, "4");
  await expectMarkerPositionOccurrences(page, "board-surface", "32-32", 3);
  await dismissConfirm(page, () => page.click('[data-testid="new-scenario"]'));
  await expectMarkerCount(page, "4");
  await expectInputValue(page, '[data-testid="scenario-source-input"]', invalidSquareSource);
  await page.reload();
  await page.waitForSelector('[data-view="editor"]');
  await expectStatusLine(page, "Recovered session draft");
  await expectSurfaceSpace(page, "board-surface", "square-grid");
  await expectSourceEditorErrorState(page, false);
  await expectMarkerCount(page, "4");
  await expectMarkerPositionOccurrences(page, "board-surface", "32-32", 3);
  await expectInputValue(page, '[data-testid="scenario-source-input"]', invalidSquareSource);
  await page.click('[data-testid="reset-source"]');
  await expectStatusLine(page, "Source reset to editor state");
  await expectSourceEditorErrorState(page, false);
  const resetSquareSource = JSON.parse(await readSourceEditorValue(page));
  if (
    resetSquareSource.title !== "Source Applied Fixture" ||
    resetSquareSource.pieces.length !== 4
  ) {
    throw new Error("Source reset did not restore the applied square scenario.");
  }
  await updateSourceEditorJson(page, (scenario) => {
    scenario.pieces.push({
      ...scenario.pieces[scenario.pieces.length - 1]
    });
    return scenario;
  });
  await page.click('[data-testid="apply-source"]');
  await expectStatusLine(page, "Scenario contains duplicate marker ID: source-stack-marker");
  await expectSourceEditorErrorState(page, true);
  await expectMarkerCount(page, "4");
  await expectMarkerPositionOccurrences(page, "board-surface", "32-32", 3);
  await page.click('[data-testid="reset-source"]');
  await expectStatusLine(page, "Source reset to editor state");
  await expectSourceEditorErrorState(page, false);

  await expectScenarioDownload(page, () => clickMenuItem(page, "file", "menu-save-as-scenario"));
  await expectScenarioDownload(page, () => page.click('[data-testid="save-as-scenario"]'));
  await expectScenarioDownload(page, () => page.keyboard.press("Control+Shift+S"));
  await page.waitForFunction(() => {
    return document.querySelector(".status-line")?.textContent === "Scenario downloaded";
  });

  await page.click('[data-testid="mode-runtime"]');
  await page.waitForSelector('[data-view="runtime"]');
  await waitForMarker(page, "runtime-board-surface", "32-32");
  await expectMarkerPositionOccurrences(page, "runtime-board-surface", "32-32", 3);
  await waitForMarker(page, "runtime-board-surface", "0-0");
  await page.waitForFunction(
    (pieceId) => {
      const states =
        document.querySelector('[data-testid="runtime-board-surface"]')?.dataset
          .markerImageStates ?? "";
      return states.split(" ").includes(`${pieceId}:ready`);
    },
    squareImageMarkerId
  );
  await expectMarkerMissing(page, "runtime-board-surface", "63-63");
  await page.click('[data-testid="mode-editor"]');
  await page.waitForSelector('[data-view="editor"]');

  await updateSourceEditorJson(page, (scenario) => {
    scenario.assets = [
      {
        id: "export-board-image",
        kind: "image",
        path: "export-fixtures/checkerboard-32.png"
      },
      {
        id: "export-tone",
        kind: "audio",
        path: "export-fixtures/test-tone-440hz.wav"
      }
    ];
    scenario.space.background.imageAssetId = "export-board-image";
    scenario.pieces = scenario.pieces.map((piece) =>
      piece.id === squareImageMarkerId
        ? {
            ...piece,
            imageAssetId: "export-board-image"
          }
        : piece
    );
    return scenario;
  });
  await page.click('[data-testid="apply-source"]');
  await expectStatusLine(page, "Source applied");
  const squareRuntimeExport = await expectRuntimeExportDownload(page, () =>
    page.click('[data-testid="export-runtime-scenario"]')
  );
  await verifyRuntimeExportDownload(page, squareRuntimeExport, {
    spaceType: "square-grid",
    backgroundImagePath: "export-fixtures/checkerboard-32.png",
    markerKeys: ["0-0", "32-32"],
    markerOccurrences: [
      {
        markerKey: "32-32",
        count: 3
      }
    ],
    assetChecks: [
      {
        path: "export-fixtures/checkerboard-32.png",
        dataUrlPrefix: "data:image/png;base64,"
      },
      {
        path: "export-fixtures/test-tone-440hz.wav",
        dataUrlPrefix: "data:audio/wav;base64,"
      }
    ]
  });

  await acceptConfirm(page, () => page.click('[data-testid="new-scenario"]'));
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
    position: "Tile 9, 7"
  });
  await clickTile(page, "board-surface", 17, 13);
  await expectSelectedMarker(page, {
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
    gridLineColor: "#1e2a36",
    gridLineOpacity: 1,
    backgroundColor: "#0d131a"
  });
  if (
    parsedHexScenario.space?.type !== "hex-grid" ||
    parsedHexScenario.pieces.length !== 5 ||
    !parsedHexScenario.pieces.some((piece) => piece.x === 9 && piece.y === 7) ||
    !parsedHexScenario.pieces.some((piece) => piece.x === 0 && piece.y === 0) ||
    !parsedHexScenario.pieces.some((piece) => piece.x === 17 && piece.y === 13) ||
    !parsedHexScenario.pieces.some((piece) => piece.x === 0 && piece.y === 13) ||
    !parsedHexScenario.pieces.some((piece) => piece.x === extremeDropTile.x && piece.y === extremeDropTile.y)
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
  await placeMarkerAtFreeCoordinate(page, "board-surface", 73.25, 18.5);
  await expectMarkerCount(page, "3");
  await expectFreeMarkerCountNear(page, "board-surface", 73.25, 18.5, 2);
  await placeMarkerAtFreeCoordinate(page, "board-surface", -49.5, 94.75);
  await expectMarkerCount(page, "4");
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

  await updateSourceEditorJson(page, (scenario) => {
    scenario.pieces.push({
      id: "source-free-marker",
      label: "source-free-marker",
      kind: "marker",
      side: "neutral",
      x: 73.25,
      y: 18.5
    });
    return scenario;
  });
  await page.click('[data-testid="apply-source"]');
  await expectStatusLine(page, "Source applied");
  await expectMarkerCount(page, "5");
  await expectFreeMarkerCountNear(page, "board-surface", 73.25, 18.5, 3);

  await page.click('[data-testid="save-scenario"]');
  const savedFreeScenario = await page.evaluate(() =>
    window.localStorage.getItem("fieldcraft:last-scenario")
  );
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
  if (
    parsedFreeScenario.pieces.length !== 5 ||
    parsedFreeScenario.pieces.filter(
      (piece) => Math.abs(piece.x - 73.25) <= 0.75 && Math.abs(piece.y - 18.5) <= 0.75
    ).length !== 3 ||
    !parsedFreeScenario.pieces.some((piece) => piece.label === "source-free-marker")
  ) {
    throw new Error("Saved free-coordinate scenario did not preserve colocated markers.");
  }

  await page.click('[data-testid="mode-runtime"]');
  await page.waitForSelector('[data-view="runtime"]');
  await expectSurfaceSpace(page, "runtime-board-surface", "free-coordinate");
  await expectCanvasHasRenderedBoard(page, "runtime-board-canvas");
  await expectFreeMarkerCountNear(page, "runtime-board-surface", 73.25, 18.5, 3);
  for (const markerKey of freeMarkerKeys) {
    await waitForMarker(page, "runtime-board-surface", markerKey);
  }
  await page.click('[data-testid="mode-editor"]');
  await page.waitForSelector('[data-view="editor"]');

  await updateSourceEditorJson(page, (scenario) => {
    scenario.assets = [
      {
        id: "free-export-board-image",
        kind: "image",
        path: "export-fixtures/checkerboard-32.png"
      },
      {
        id: "free-export-tone",
        kind: "audio",
        path: "export-fixtures/test-tone-440hz.wav"
      }
    ];
    scenario.space.background.imageAssetId = "free-export-board-image";
    return scenario;
  });
  await page.click('[data-testid="apply-source"]');
  await expectStatusLine(page, "Source applied");
  const freeRuntimeExport = await expectRuntimeExportDownload(page, () =>
    clickMenuItem(page, "file", "menu-export-runtime-scenario")
  );
  await verifyRuntimeExportDownload(page, freeRuntimeExport, {
    spaceType: "free-coordinate",
    backgroundImagePath: "export-fixtures/checkerboard-32.png",
    markerKeys: freeMarkerKeys,
    freeMarkerCounts: [
      {
        x: 73.25,
        y: 18.5,
        count: 3
      }
    ],
    assetChecks: [
      {
        path: "export-fixtures/checkerboard-32.png",
        dataUrlPrefix: "data:image/png;base64,"
      },
      {
        path: "export-fixtures/test-tone-440hz.wav",
        dataUrlPrefix: "data:audio/wav;base64,"
      }
    ]
  });

  console.log(
    "Browser smoke passed: square, hex, and free-coordinate placement, runtime checks, and standalone runtime export checks passed."
  );
} finally {
  if (browser) {
    await browser.close();
  }

  if (frontend) {
    await stopProcessTree(frontend.pid);
  }
}

async function startFrontendServer() {
  const smokeUrl = new URL(baseUrl);
  const port = Number.parseInt(smokeUrl.port, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid browser smoke port: ${smokeUrl.port}`);
  }

  const portCheck = await checkPort(smokeUrl.hostname, port);
  if (!portCheck.available) {
    throw new Error(
      `Browser smoke port ${port} is unavailable: ${portCheck.message ?? "already in use"}`
    );
  }

  const frontend = pnpmCommand([
    "--dir",
    "apps/editor",
    "exec",
    "vite",
    "--host",
    smokeUrl.hostname,
    "--port",
    String(port),
    "--strictPort"
  ]);
  const child = spawn(frontend.command, frontend.args, {
    cwd: repoRoot,
    detached: process.platform !== "win32",
    shell: process.platform === "win32",
    stdio: "ignore"
  });

  await waitForUrl(smokeUrl.href, 20000);
  return {
    pid: child.pid
  };
}

function createMenuOpenFixture() {
  return `${JSON.stringify(
    {
      schema: "fieldcraft.scenario",
      schemaVersion: currentSchemaVersion,
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
          id: "piece_FIXT01",
          label: "marker-1-2",
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

function createOversizedGridFixture() {
  return `${JSON.stringify(
    {
      schema: "fieldcraft.scenario",
      schemaVersion: currentSchemaVersion,
      title: "Oversized Grid Fixture",
      space: {
        type: "square-grid",
        width: 65,
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
      pieces: [],
      metadata: {
        editorVersion: "0.1.0-experiment",
        savedAt: null
      }
    },
    null,
    2
  )}\n`;
}

function createDuplicateMarkerIdFixture() {
  return `${JSON.stringify(
    {
      schema: "fieldcraft.scenario",
      schemaVersion: currentSchemaVersion,
      title: "Duplicate Marker Id Fixture",
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
          id: "piece_FIXT01",
          label: "marker-1-2",
          kind: "marker",
          side: "neutral",
          x: 1,
          y: 2
        },
        {
          id: "piece_FIXT01",
          label: "marker-2-2",
          kind: "marker",
          side: "neutral",
          x: 2,
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

function createLegacyV0Fixture() {
  return JSON.stringify(
    {
      schema: "fieldcraft.scenario.v0",
      title: "Legacy upgrade sample",
      space: {
        type: "square-grid",
        width: 4,
        height: 3,
        tileSize: 48,
        scale: { distancePerTile: 1, unit: "tile" },
        grid: { lineColor: "#aeb8c1", lineOpacity: 1 },
        background: { color: "#f9fbfb" }
      },
      assets: [],
      pieces: [
        { id: "marker-0-0", kind: "marker", side: "neutral", x: 0, y: 0 },
        { id: "scout-alpha", kind: "marker", side: "neutral", x: 2, y: 1 }
      ],
      metadata: { editorVersion: "0.1.0-experiment", savedAt: "2026-03-01T00:00:00.000Z" }
    },
    null,
    2
  );
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

async function expectMetricValue(page, testId, expectedValue) {
  await page.waitForFunction(
    ([nextTestId, nextValue]) => {
      return document.querySelector(`[data-testid="${nextTestId}"]`)?.textContent === nextValue;
    },
    [testId, expectedValue]
  );
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

async function expectRuntimeExportDownload(page, action) {
  const downloadPromise = page.waitForEvent("download");
  await action();
  const download = await downloadPromise;
  if (!download.suggestedFilename().endsWith(".fieldcraft.runtime.html")) {
    throw new Error(
      `Unexpected runtime export filename: ${download.suggestedFilename()}`
    );
  }

  const filePath = path.join(smokeDir, download.suggestedFilename());
  await download.saveAs(filePath);

  return {
    download,
    filePath,
    html: fs.readFileSync(filePath, "utf8")
  };
}

async function verifyRuntimeExportDownload(page, runtimeExport, options) {
  for (const assetCheck of options.assetChecks ?? []) {
    if (!runtimeExport.html.includes(assetCheck.path)) {
      throw new Error(`Runtime export is missing bundled asset path ${assetCheck.path}.`);
    }
    if (!runtimeExport.html.includes(assetCheck.dataUrlPrefix)) {
      throw new Error(
        `Runtime export is missing bundled asset payload ${assetCheck.dataUrlPrefix} for ${assetCheck.path}.`
      );
    }
  }

  const browser = page.context().browser();
  if (!browser) {
    throw new Error("Could not access the browser for runtime export verification.");
  }

  const runtimeContext = await browser.newContext({
    viewport: { width: 1280, height: 820 }
  });
  const runtimePage = await runtimeContext.newPage();
  const pageErrors = [];
  const consoleErrors = [];

  try {
    runtimePage.on("pageerror", (error) => {
      pageErrors.push(String(error));
    });
    runtimePage.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });
    await runtimePage.goto(pathToFileURL(runtimeExport.filePath).href);
    try {
      await runtimePage.waitForSelector('[data-view="runtime-export"]');
    } catch (error) {
      const pageContent = await runtimePage.content();
      throw new Error(
        `Runtime export did not boot. Page errors: ${JSON.stringify(pageErrors)}. Console errors: ${JSON.stringify(consoleErrors)}. Body: ${pageContent.slice(0, 1200)}`,
        { cause: error }
      );
    }
    await expectSurfaceSpace(runtimePage, "runtime-board-surface", options.spaceType);
    await runtimePage.waitForSelector(
      '[data-testid="runtime-board-surface"][data-background-image-status="ready"]'
    );
    await expectCanvasHasRenderedBoard(runtimePage, "runtime-board-canvas");

    const backgroundImagePath = await runtimePage
      .locator('[data-testid="runtime-board-surface"]')
      .getAttribute("data-background-image-path");
    if (backgroundImagePath !== options.backgroundImagePath) {
      throw new Error(
        `Runtime export background path was ${JSON.stringify(backgroundImagePath)} instead of ${JSON.stringify(options.backgroundImagePath)}.`
      );
    }

    for (const markerKey of options.markerKeys ?? []) {
      await waitForMarker(runtimePage, "runtime-board-surface", markerKey);
    }
    for (const markerOccurrence of options.markerOccurrences ?? []) {
      await expectMarkerPositionOccurrences(
        runtimePage,
        "runtime-board-surface",
        markerOccurrence.markerKey,
        markerOccurrence.count
      );
    }
    for (const freeMarkerCount of options.freeMarkerCounts ?? []) {
      await expectFreeMarkerCountNear(
        runtimePage,
        "runtime-board-surface",
        freeMarkerCount.x,
        freeMarkerCount.y,
        freeMarkerCount.count
      );
    }
  } finally {
    await runtimeContext.close();
  }

  await runtimeExport.download.delete();
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

async function readSourceEditorValue(page) {
  return page.locator('[data-testid="scenario-source-input"]').inputValue();
}

async function setSourceEditorSelection(page, start, end = start) {
  await page.locator('[data-testid="scenario-source-input"]').evaluate((input, selection) => {
    if (!(input instanceof HTMLTextAreaElement)) {
      throw new Error("Target is not a textarea.");
    }

    input.focus();
    input.setSelectionRange(selection.start, selection.end);
  }, { start, end });
}

async function setSourceEditorValue(page, value) {
  await page.locator('[data-testid="scenario-source-input"]').evaluate((input, nextValue) => {
    if (!(input instanceof HTMLTextAreaElement)) {
      throw new Error("Target is not a textarea.");
    }

    input.value = nextValue;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function updateSourceEditorJson(page, mutate) {
  const source = JSON.parse(await readSourceEditorValue(page));
  const nextSource = mutate(source);
  await setSourceEditorValue(page, `${JSON.stringify(nextSource, null, 2)}\n`);
}

async function expectSourceEditorErrorState(page, expected) {
  await page.waitForFunction((hasError) => {
    const input = document.querySelector('[data-testid="scenario-source-input"]');
    return (
      input instanceof HTMLTextAreaElement &&
      input.classList.contains("has-error") === hasError
    );
  }, expected);
}

async function expectSourceEditorFocused(page) {
  await page.waitForFunction(() => {
    const input = document.querySelector('[data-testid="scenario-source-input"]');
    return input instanceof HTMLTextAreaElement && document.activeElement === input;
  });
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

async function clickStackedTileMarker(page, surfaceTestId, x, y, occurrenceIndex) {
  await waitForSurfaceReady(page, surfaceTestId);
  const surface = page.locator(`[data-testid="${surfaceTestId}"]`);
  const point = await getStackedTileMarkerViewportPoint(
    page,
    surfaceTestId,
    x,
    y,
    occurrenceIndex
  );

  await surface.click({ position: point });
}

async function getStackedTileMarkerViewportPoint(
  page,
  surfaceTestId,
  x,
  y,
  occurrenceIndex
) {
  const surface = page.locator(`[data-testid="${surfaceTestId}"]`);

  return surface.evaluate((node, marker) => {
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
    const positions = (element.getAttribute("data-marker-positions") ?? "")
      .split(" ")
      .filter(Boolean);
    const markerKey = `${marker.x}-${marker.y}`;
    const occurrenceCount = positions.filter((position) => position === markerKey).length;

    if (
      !Number.isFinite(scale) ||
      !Number.isFinite(rotation) ||
      !Number.isFinite(panX) ||
      !Number.isFinite(panY) ||
      !Number.isFinite(worldWidth) ||
      !Number.isFinite(worldHeight) ||
      !Number.isFinite(columns) ||
      !Number.isFinite(rows) ||
      (spaceType !== "square-grid" && spaceType !== "hex-grid")
    ) {
      throw new Error("Tile board viewport did not expose coordinate metadata.");
    }

    if (occurrenceCount < 2) {
      throw new Error(`Tile ${markerKey} does not contain colocated markers.`);
    }

    if (marker.occurrenceIndex < 0 || marker.occurrenceIndex >= occurrenceCount) {
      throw new Error(`Invalid colocated marker index ${marker.occurrenceIndex} for ${markerKey}.`);
    }

    let worldX;
    let worldY;
    let baseRadius;
    if (spaceType === "hex-grid") {
      const radius = worldHeight / (rows * 1.5 + 0.5);
      const hexWidth = Math.sqrt(3) * radius;

      worldX = hexWidth / 2 + marker.x * hexWidth + (marker.y % 2 === 1 ? hexWidth / 2 : 0);
      worldY = radius + marker.y * radius * 1.5;
      baseRadius = Math.min(radius * 0.56, Math.max(radius * 0.34, 5 / scale));
    } else {
      const tileSize = worldWidth / columns;

      worldX = (marker.x + 0.5) * tileSize;
      worldY = (marker.y + 0.5) * (worldHeight / rows);
      baseRadius = Math.min(tileSize * 0.42, Math.max(tileSize * 0.24, 5 / scale));
    }

    const orbitStep = getColocatedMarkerOrbit(baseRadius, scale, occurrenceCount);
    const offset = getColocatedMarkerOffset(
      occurrenceCount,
      marker.occurrenceIndex,
      orbitStep
    );
    const worldPoint = {
      x: worldX + offset.x,
      y: worldY + offset.y
    };
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);

    return {
      x: worldPoint.x * scale * cos - worldPoint.y * scale * sin + panX,
      y: worldPoint.x * scale * sin + worldPoint.y * scale * cos + panY
    };

    function getColocatedMarkerOrbit(base, zoomScale, count) {
      const factor = count <= 3 ? 0.66 : count <= 6 ? 0.76 : 0.88;

      return Math.max(base * factor, 6 / Math.max(zoomScale, 0.04));
    }

    function getColocatedMarkerOffset(count, index, orbitStepValue) {
      let remaining = count;
      let ring = 1;
      let ringIndex = index;

      while (remaining > 0) {
        const ringCapacity = ring * 6;
        const ringCount = Math.min(remaining, ringCapacity);

        if (ringIndex < ringCount) {
          const angle = -Math.PI / 2 + (ringIndex / ringCount) * Math.PI * 2;

          return {
            x: Math.cos(angle) * orbitStepValue * ring,
            y: Math.sin(angle) * orbitStepValue * ring
          };
        }

        ringIndex -= ringCount;
        remaining -= ringCount;
        ring += 1;
      }

      throw new Error("Could not resolve colocated marker offset.");
    }
  }, { x, y, occurrenceIndex });
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
    const selectedIdInput = document.querySelector('[data-testid="selected-marker-label-input"]');
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
      selectedIdInput instanceof HTMLInputElement &&
      (id === null || selectedIdInput.value === id) &&
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

async function getSelectedMarkerId(page) {
  return page.evaluate(() => {
    const code = document.querySelector('[data-testid="selected-marker-id"]');

    return code instanceof HTMLElement ? code.textContent : null;
  });
}

async function updateSelectedMarkerLabel(page, value) {
  const input = page.locator('[data-testid="selected-marker-label-input"]');
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

async function expectMarkerPositionOccurrences(page, surfaceTestId, markerPosition, count) {
  await page.waitForFunction(
    ({ testId, marker, expectedCount }) => {
      const surface = document.querySelector(`[data-testid="${testId}"]`);
      const positions = (surface?.getAttribute("data-marker-positions") ?? "")
        .split(" ")
        .filter(Boolean);

      return (
        hasFiniteAttribute(surface, "data-view-scale") &&
        hasFiniteAttribute(surface, "data-view-pan-x") &&
        hasFiniteAttribute(surface, "data-view-pan-y") &&
        positions.filter((position) => position === marker).length === expectedCount
      );

      function hasFiniteAttribute(element, name) {
        const value = element?.getAttribute(name);

        return value !== null && Number.isFinite(Number(value));
      }
    },
    {
      testId: surfaceTestId,
      marker: markerPosition,
      expectedCount: count
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

async function expectFreeMarkerCountNear(
  page,
  surfaceTestId,
  x,
  y,
  count,
  tolerance = 0.75
) {
  await page.waitForFunction(
    ({ testId, point, expectedCount, allowedDrift }) => {
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
        positions.filter(
          (marker) =>
            Number.isFinite(marker.x) &&
            Number.isFinite(marker.y) &&
            Math.abs(marker.x - point.x) <= allowedDrift &&
            Math.abs(marker.y - point.y) <= allowedDrift
        ).length === expectedCount
      );

      function hasFiniteAttribute(element, name) {
        const value = element?.getAttribute(name);

        return value !== null && Number.isFinite(Number(value));
      }
    },
    {
      testId: surfaceTestId,
      point: { x, y },
      expectedCount: count,
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
