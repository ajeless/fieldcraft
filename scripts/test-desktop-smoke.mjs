#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import {
  checkPort,
  pnpmCommand,
  repoRoot,
  stopProcessTree,
  wait,
  waitForUrl,
  withCargoBin
} from "./process-utils.mjs";

const tauriConfigPath = path.join(repoRoot, "apps", "editor", "src-tauri", "tauri.conf.json");
const tauriConfig = JSON.parse(await fs.readFile(tauriConfigPath, "utf8"));
const baseDevUrl = new URL(tauriConfig.build?.devUrl ?? "http://127.0.0.1:5173/");
const cargoEnv = withCargoBin(process.env);
const smokePort = Number.parseInt(process.env.FIELDCRAFT_DESKTOP_SMOKE_PORT ?? "5183", 10);
const smokeUrl = new URL(baseDevUrl.href);
smokeUrl.port = String(smokePort);
const scratchRoot = path.join(os.tmpdir(), "fieldcraft-desktop-smoke");
const packageAPath = path.join(scratchRoot, "package-a");
const packageBPath = path.join(scratchRoot, "package-b");
const exportPath = path.join(scratchRoot, "exports");
const resultPathPhase1 = path.join(scratchRoot, "phase1-result.json");
const resultPathPhase2 = path.join(scratchRoot, "phase2-result.json");
const specPathPhase1 = path.join(scratchRoot, "phase1-spec.json");
const specPathPhase2 = path.join(scratchRoot, "phase2-spec.json");
const squareScenarioPath = path.join(packageAPath, "desktop-square.fieldcraft.json");
const hexScenarioPath = path.join(packageAPath, "desktop-hex.fieldcraft.json");
const freeScenarioPath = path.join(packageAPath, "desktop-free.fieldcraft.json");
const squareCopyPath = path.join(packageBPath, "desktop-square-copy.fieldcraft.json");
const runtimeExportPath = path.join(exportPath, "desktop-square.fieldcraft.runtime.html");
const imageFixturePath = path.join(
  repoRoot,
  "apps",
  "editor",
  "test-fixtures",
  "assets",
  "checkerboard-32.png"
);
const audioFixturePath = path.join(
  repoRoot,
  "apps",
  "editor",
  "test-fixtures",
  "assets",
  "test-tone-440hz.wav"
);

await fs.rm(scratchRoot, { recursive: true, force: true });
await fs.mkdir(packageAPath, { recursive: true });
await fs.mkdir(packageBPath, { recursive: true });
await fs.mkdir(exportPath, { recursive: true });

const frontend = await startFrontendServer();

let freeScenarioOnDiskBeforeRecovery = "";

try {
  await fs.writeFile(
    specPathPhase1,
    `${JSON.stringify(
      createDesktopSmokeSpec({
        phase: "phase1",
        resultPath: resultPathPhase1
      }),
      null,
      2
    )}\n`
  );
  const phase1Run = await startDesktopAutomation("phase1", specPathPhase1);
  const phase1Result = await waitForAutomationResult(resultPathPhase1, phase1Run, 120000);
  if (!phase1Result.ok) {
    throw new Error(`Desktop smoke phase 1 failed: ${phase1Result.summary}`);
  }

  await wait(1500);
  await stopProcessTree(phase1Run.pid);
  await verifyPhase1Artifacts();
  freeScenarioOnDiskBeforeRecovery = await fs.readFile(freeScenarioPath, "utf8");

  await fs.writeFile(
    specPathPhase2,
    `${JSON.stringify(
      createDesktopSmokeSpec({
        phase: "phase2",
        resultPath: resultPathPhase2
      }),
      null,
      2
    )}\n`
  );
  const phase2Run = await startDesktopAutomation("phase2", specPathPhase2);
  const phase2Result = await waitForAutomationResult(resultPathPhase2, phase2Run, 120000);
  if (!phase2Result.ok) {
    throw new Error(`Desktop smoke phase 2 failed: ${phase2Result.summary}`);
  }

  await stopProcessTree(phase2Run.pid);
  const freeScenarioOnDiskAfterRecovery = await fs.readFile(freeScenarioPath, "utf8");
  if (freeScenarioOnDiskAfterRecovery !== freeScenarioOnDiskBeforeRecovery) {
    throw new Error("Recovered draft changed the free-coordinate file on disk before an explicit save.");
  }

  console.log(
    "Desktop smoke passed: Tauri desktop semantics, package assets, save/open flows, export, and draft recovery checks passed."
  );
} finally {
  await stopProcessTree(frontend.pid);
}

function createDesktopSmokeSpec({ phase, resultPath }) {
  return {
    kind: "desktop-smoke",
    phase,
    resultPath,
    paths: {
      squareScenarioPath,
      squareCopyPath,
      hexScenarioPath,
      freeScenarioPath,
      exportPath: runtimeExportPath,
      imageFixturePath,
      audioFixturePath
    },
    saveResponses:
      phase === "phase1"
        ? [squareScenarioPath, squareCopyPath, hexScenarioPath, freeScenarioPath]
        : [],
    exportResponses: phase === "phase1" ? [runtimeExportPath] : [],
    openResponses: phase === "phase1" ? [squareScenarioPath] : [],
    importResponses:
      phase === "phase1"
        ? {
            image: [imageFixturePath],
            audio: [audioFixturePath]
          }
        : {},
    confirmResponses: phase === "phase1" ? [true] : []
  };
}

async function verifyPhase1Artifacts() {
  const squareScenario = JSON.parse(await fs.readFile(squareScenarioPath, "utf8"));
  const squareCopyScenario = JSON.parse(await fs.readFile(squareCopyPath, "utf8"));
  const hexScenario = JSON.parse(await fs.readFile(hexScenarioPath, "utf8"));
  const freeScenario = JSON.parse(await fs.readFile(freeScenarioPath, "utf8"));

  await assertExists(squareScenarioPath, "square scenario");
  await assertExists(path.join(packageAPath, "assets", "checkerboard-32.png"), "square image asset");
  await assertExists(path.join(packageAPath, "assets", "test-tone-440hz.wav"), "square audio asset");
  await assertExists(squareCopyPath, "square copy scenario");
  await assertExists(path.join(packageBPath, "assets", "checkerboard-32.png"), "copied image asset");
  await assertExists(path.join(packageBPath, "assets", "test-tone-440hz.wav"), "copied audio asset");
  await assertExists(hexScenarioPath, "hex scenario");
  await assertExists(freeScenarioPath, "free scenario");
  await assertExists(runtimeExportPath, "runtime export");

  assertRelativeAssetPaths(squareScenario, "square scenario");
  assertRelativeAssetPaths(squareCopyScenario, "square copy scenario");

  if (
    squareScenario.title !== "Desktop Smoke Square" ||
    squareScenario.space?.background?.imageAssetId == null ||
    squareScenario.assets.length !== 2
  ) {
    throw new Error("Square desktop smoke scenario did not persist the expected asset state.");
  }

  if (
    !squareScenario.pieces.some((piece) => typeof piece.imageAssetId === "string") ||
    squareScenario.pieces.length < 3
  ) {
    throw new Error("Square desktop smoke scenario did not persist marker artwork or marker count.");
  }

  if (hexScenario.title !== "Desktop Smoke Hex" || hexScenario.space?.type !== "hex-grid") {
    throw new Error("Hex desktop smoke scenario did not persist correctly.");
  }

  if (
    freeScenario.title !== "Desktop Smoke Free" ||
    freeScenario.space?.type !== "free-coordinate"
  ) {
    throw new Error("Free-coordinate desktop smoke scenario did not persist correctly.");
  }

  await verifyRuntimeExport(runtimeExportPath);
}

async function verifyRuntimeExport(exportFilePath) {
  const executablePath =
    process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH ??
    (await fileExists("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : undefined);
  const browser = await chromium.launch({
    headless: true,
    executablePath
  });

  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 820 }
    });
    await page.goto(pathToFileURL(exportFilePath).href);
    await page.waitForSelector('[data-view="runtime-export"]');
    await page.waitForSelector('[data-testid="runtime-board-surface"]');
    await page.waitForFunction(() => {
      const status =
        document.querySelector('[data-testid="runtime-board-surface"]')?.dataset
          .backgroundImageStatus ?? "";
      return status === "ready";
    });
    const title = await page.locator(".runtime-export-title").textContent();
    if (title !== "Desktop Smoke Square") {
      throw new Error(`Unexpected runtime export title: ${JSON.stringify(title)}`);
    }
  } finally {
    await browser.close();
  }
}

function assertRelativeAssetPaths(scenario, label) {
  for (const asset of scenario.assets ?? []) {
    if (typeof asset.path !== "string" || !asset.path.startsWith("assets/")) {
      throw new Error(`${label} contains a non-relative asset path: ${JSON.stringify(asset.path)}`);
    }
  }
}

async function assertExists(filePath, label) {
  if (!(await fileExists(filePath))) {
    throw new Error(`Missing ${label}: ${filePath}`);
  }
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function startDesktopAutomation(phase, specPath) {
  const automationUrl = new URL(smokeUrl.href);
  automationUrl.searchParams.set("fieldcraftAutomation", `desktop-smoke-${phase}`);
  automationUrl.searchParams.set("fieldcraftAutomationSpec", specPath);

  const desktop = pnpmCommand([
    "--dir",
    "apps/editor",
    "exec",
    "tauri",
    "dev",
    "--config",
    JSON.stringify({
      build: {
        beforeDevCommand: null,
        devUrl: automationUrl.href
      }
    })
  ]);
  const child = spawn(desktop.command, desktop.args, {
    cwd: repoRoot,
    detached: process.platform !== "win32",
    env: cargoEnv,
    shell: process.platform === "win32",
    stdio: "inherit"
  });

  let exitResult = null;
  child.once("exit", (code, signal) => {
    exitResult = { code, signal };
  });

  return {
    pid: child.pid,
    getExitResult: () => exitResult
  };
}

async function startFrontendServer() {
  const portCheck = await checkPort(smokeUrl.hostname, smokePort);
  if (!portCheck.available) {
    throw new Error(
      `Desktop smoke port ${smokePort} is unavailable: ${portCheck.message ?? "already in use"}`
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
    String(smokePort),
    "--strictPort"
  ]);
  const child = spawn(frontend.command, frontend.args, {
    cwd: repoRoot,
    detached: process.platform !== "win32",
    env: cargoEnv,
    shell: process.platform === "win32",
    stdio: "ignore"
  });

  await waitForUrl(smokeUrl.href, 20000);
  return {
    pid: child.pid
  };
}

async function waitForAutomationResult(resultPath, run, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await fileExists(resultPath)) {
      return JSON.parse(await fs.readFile(resultPath, "utf8"));
    }

    const exitResult = run.getExitResult();
    if (exitResult) {
      throw new Error(
        `Desktop automation exited before writing ${path.basename(resultPath)}: ${JSON.stringify(
          exitResult
        )}`
      );
    }

    await wait(250);
  }

  throw new Error(`Timed out waiting for desktop automation result ${resultPath}`);
}
