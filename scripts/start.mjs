#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import {
  checkPort,
  isProcessRunning,
  logDir,
  readState,
  removeState,
  repoRoot,
  statePath,
  pnpmCommand,
  stopProcessTree,
  waitForUrl,
  writeState
} from "./process-utils.mjs";

const host = process.env.FIELDCRAFT_DEV_HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.FIELDCRAFT_DEV_PORT ?? "5173", 10);
const url = `http://${host}:${port}/`;

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid FIELDCRAFT_DEV_PORT: ${process.env.FIELDCRAFT_DEV_PORT}`);
}

await fsp.mkdir(logDir, { recursive: true });

const existing = await readState();

if (existing && isProcessRunning(existing.pid)) {
  try {
    await waitForUrl(existing.url, 3000);
    console.log(`Fieldcraft dev server already running at ${existing.url}`);
    process.exit(0);
  } catch {
    console.log(`Stopping unresponsive tracked dev server with pid ${existing.pid}`);
    await stopProcessTree(existing.pid);
    await removeState();
  }
} else if (existing) {
  await removeState();
}

const portCheck = await checkPort(host, port);

if (!portCheck.available) {
  if (portCheck.code === "EPERM" || portCheck.code === "EACCES") {
    console.error(`Cannot bind ${host}:${port}: ${portCheck.message}`);
    console.error("Grant localhost bind permission or choose an allowed port with FIELDCRAFT_DEV_PORT.");
  } else {
    console.error(
      `Port ${port} on ${host} is already in use by a process not tracked in ${path.relative(
        repoRoot,
        statePath
      )}.`
    );
    console.error("Stop that process or choose another port with FIELDCRAFT_DEV_PORT.");
  }
  process.exit(1);
}

const logFile = path.join(logDir, "dev-server.log");
const out = fs.openSync(logFile, "a");
const packageManager = pnpmCommand([
  "--dir",
  "apps/editor",
  "dev",
  "--host",
  host,
  "--port",
  String(port),
  "--strictPort"
]);
const command = [packageManager.command, ...packageManager.args];
const child = spawn(packageManager.command, packageManager.args, {
  cwd: repoRoot,
  detached: process.platform !== "win32",
  shell: process.platform === "win32",
  stdio: ["ignore", out, out]
});

const state = {
  pid: child.pid,
  command,
  host,
  port,
  url,
  logFile,
  startedAt: new Date().toISOString()
};

await writeState(state);

child.unref();

try {
  await waitForUrl(url);
  console.log(`Fieldcraft dev server started at ${url}`);
  console.log(`State: ${path.relative(repoRoot, statePath)}`);
  console.log(`Log: ${path.relative(repoRoot, logFile)}`);
} catch (error) {
  await stopProcessTree(child.pid);
  await removeState();
  console.error(`Dev server failed to become ready. See ${path.relative(repoRoot, logFile)}.`);
  throw error;
}
