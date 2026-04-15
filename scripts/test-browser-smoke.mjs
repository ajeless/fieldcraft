#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { isProcessRunning, readState, repoRoot } from "./process-utils.mjs";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5173/";
const startScript = path.join(repoRoot, "scripts", "start.mjs");
const stopScript = path.join(repoRoot, "scripts", "stop.mjs");

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

  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  await page.goto(baseUrl);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.waitForSelector('[data-view="editor"]');
  await page.waitForFunction(() => {
    return document.querySelector('[data-testid="marker-count"]')?.textContent === "0";
  });
  await page.waitForSelector('[data-testid="launch-runtime"]:disabled');
  await page.click('[data-testid="create-square-grid"]');
  await page.waitForSelector('[data-testid="board-surface"][data-view-ready="true"]');
  const cellCount = await page.locator("[data-cell]").count();
  if (cellCount !== 0) {
    throw new Error("Canvas board should not render empty tiles as DOM controls.");
  }
  await clickTile(page, "board-surface", 2, 3);
  await page.waitForFunction(() => {
    return document.querySelector('[data-testid="marker-count"]')?.textContent === "1";
  });
  await waitForMarker(page, "board-surface", "2-3");
  await page.click('[data-testid="save-scenario"]');

  const savedScenario = await page.evaluate(() => window.localStorage.getItem("fieldcraft:last-scenario"));
  if (!savedScenario || !savedScenario.includes('"schema": "fieldcraft.scenario.v0"')) {
    throw new Error("Scenario was not saved to browser storage.");
  }

  await page.click('[data-testid="launch-runtime"]');
  await page.waitForSelector('[data-view="runtime"]');
  await waitForMarker(page, "runtime-board-surface", "2-3");
  await page.click('[data-testid="close-runtime"]');
  await page.waitForSelector('[data-view="editor"]');

  console.log("Browser smoke passed: editor loaded, scenario saved, runtime launched and closed.");
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

async function clickTile(page, surfaceTestId, x, y) {
  await waitForSurfaceReady(page, surfaceTestId);
  const surface = page.locator(`[data-testid="${surfaceTestId}"]`);
  await surface.waitFor({ state: "visible" });
  const point = await surface.evaluate((node, tile) => {
    const element = node;
    const scale = Number(element.dataset.viewScale);
    const rotation = Number(element.dataset.viewRotation);
    const panX = Number(element.dataset.viewPanX);
    const panY = Number(element.dataset.viewPanY);
    const worldWidth = Number(element.dataset.boardWorldWidth);
    const worldHeight = Number(element.dataset.boardWorldHeight);
    const columns = Number(element.dataset.boardColumns);
    const rows = Number(element.dataset.boardRows);

    if (
      !Number.isFinite(scale) ||
      !Number.isFinite(rotation) ||
      !Number.isFinite(panX) ||
      !Number.isFinite(panY) ||
      !Number.isFinite(worldWidth) ||
      !Number.isFinite(worldHeight) ||
      !Number.isFinite(columns) ||
      !Number.isFinite(rows)
    ) {
      throw new Error("Board viewport did not expose coordinate metadata.");
    }

    const worldX = (tile.x + 0.5) * (worldWidth / columns);
    const worldY = (tile.y + 0.5) * (worldHeight / rows);
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);

    return {
      x: worldX * scale * cos - worldY * scale * sin + panX,
      y: worldX * scale * sin + worldY * scale * cos + panY
    };
  }, { x, y });

  await surface.click({ position: point });
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

async function waitForSurfaceReady(page, surfaceTestId) {
  await page.waitForFunction((testId) => {
    const surface = document.querySelector(`[data-testid="${testId}"]`);

    return (
      hasFiniteAttribute(surface, "data-view-scale") &&
      hasFiniteAttribute(surface, "data-view-rotation") &&
      hasFiniteAttribute(surface, "data-view-pan-x") &&
      hasFiniteAttribute(surface, "data-view-pan-y") &&
      hasFiniteAttribute(surface, "data-board-world-width") &&
      hasFiniteAttribute(surface, "data-board-world-height") &&
      hasFiniteAttribute(surface, "data-board-columns") &&
      hasFiniteAttribute(surface, "data-board-rows")
    );

    function hasFiniteAttribute(element, name) {
      const value = element?.getAttribute(name);

      return value !== null && Number.isFinite(Number(value));
    }
  }, surfaceTestId);
}
