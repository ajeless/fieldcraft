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
  await page.click('[data-cell="2-3"]');
  await page.waitForFunction(() => {
    return document.querySelector('[data-testid="marker-count"]')?.textContent === "1";
  });
  await page.click('[data-testid="save-scenario"]');

  const savedScenario = await page.evaluate(() => window.localStorage.getItem("fieldcraft:last-scenario"));
  if (!savedScenario || !savedScenario.includes('"schema": "fieldcraft.scenario.v0"')) {
    throw new Error("Scenario was not saved to browser storage.");
  }

  await page.click('[data-testid="launch-runtime"]');
  await page.waitForSelector('[data-view="runtime"]');
  await page.waitForSelector('[data-runtime-cell="2-3"].occupied');
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
