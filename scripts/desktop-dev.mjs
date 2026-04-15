#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  checkPort,
  isProcessRunning,
  pnpmCommand,
  readState,
  removeState,
  repoRoot,
  stopProcessTree,
  waitForPortAvailable,
  waitForUrl
} from "./process-utils.mjs";

const checkOnly = process.argv.includes("--check");
const startScript = path.join(repoRoot, "scripts", "start.mjs");
const stopScript = path.join(repoRoot, "scripts", "stop.mjs");
const tauriConfigPath = path.join(repoRoot, "apps", "editor", "src-tauri", "tauri.conf.json");
const tauriConfig = JSON.parse(await fsp.readFile(tauriConfigPath, "utf8"));
const devUrl = new URL(tauriConfig.build?.devUrl ?? "http://127.0.0.1:5173");
const host = devUrl.hostname;
const port = Number.parseInt(devUrl.port || (devUrl.protocol === "https:" ? "443" : "80"), 10);
const cargoEnv = withCargoBin(process.env);

const preflightErrors = [];

if (!commandWorks("corepack", ["--version"], process.env)) {
  preflightErrors.push("Corepack was not found on PATH. Install Node.js with Corepack enabled.");
}

const pnpm = pnpmCommand(["--version"]);
if (!commandWorks(pnpm.command, pnpm.args, process.env)) {
  preflightErrors.push("pnpm is not available through pnpm or corepack pnpm. Run corepack enable if needed.");
}

if (!commandWorks("cargo", ["--version"], cargoEnv)) {
  preflightErrors.push("Cargo was not found. Install Rust with rustup, then restart the terminal or load ~/.cargo/env.");
}

if (!commandWorks("rustc", ["--version"], cargoEnv)) {
  preflightErrors.push("rustc was not found. Install Rust with rustup.");
}

const tauri = pnpmCommand(["--dir", "apps/editor", "exec", "tauri", "--version"]);
if (!commandWorks(tauri.command, tauri.args, cargoEnv)) {
  preflightErrors.push("The Tauri CLI is not available. Run corepack pnpm install.");
}

if (preflightErrors.length > 0) {
  console.error("Fieldcraft desktop preflight failed:");
  for (const error of preflightErrors) {
    console.error(`- ${error}`);
  }
  console.error("Run corepack pnpm run doctor for a fuller dependency report.");
  process.exit(1);
}

const frontend = await ensureFrontendServer(checkOnly);

if (checkOnly) {
  console.log(frontend.message);
  process.exit(0);
}

console.log(`Starting Fieldcraft desktop dev shell at ${devUrl.href}`);
console.log("Close the desktop window or press Ctrl+C here to stop it.");

const desktop = pnpmCommand([
  "--dir",
  "apps/editor",
  "exec",
  "tauri",
  "dev",
  "--config",
  JSON.stringify({ build: { beforeDevCommand: null } })
]);
const child = spawn(desktop.command, desktop.args, {
  cwd: repoRoot,
  detached: process.platform !== "win32",
  env: cargoEnv,
  shell: process.platform === "win32",
  stdio: "inherit"
});

let stopping = false;

process.once("SIGINT", () => stopChild("SIGINT"));
process.once("SIGTERM", () => stopChild("SIGTERM"));

let result;

try {
  result = await new Promise((resolve) => {
    child.once("exit", (code, signal) => {
      resolve({ code, signal });
    });
  });
} finally {
  if (frontend.started) {
    await runNodeScript(stopScript);
  }
}

const portFreed = await waitForPortAvailable(host, port, 8000);
if (frontend.started && portFreed) {
  console.log(`Fieldcraft desktop dev stopped; ${host}:${port} is free.`);
} else if (frontend.started) {
  console.error(`Fieldcraft desktop dev exited, but ${host}:${port} is still in use.`);
} else if (portFreed) {
  console.log(`Fieldcraft desktop dev stopped; ${host}:${port} is free.`);
} else {
  console.log("Fieldcraft desktop dev stopped; existing frontend server was left running.");
}

if (result.signal) {
  process.exitCode = frontend.started && !portFreed ? 1 : 0;
} else {
  process.exitCode = result.code ?? (frontend.started && !portFreed ? 1 : 0);
}

async function ensureFrontendServer(dryRun) {
  const state = await readState();
  if (state && isProcessRunning(state.pid)) {
    try {
      await waitForUrl(state.url, 3000);
      return {
        message: `Desktop preflight passed. ${state.url} is already served by tracked pid ${state.pid}.`,
        started: false,
        url: state.url
      };
    } catch {
      if (dryRun) {
        console.error(`Desktop preflight failed. Tracked dev server pid ${state.pid} is not responding.`);
        process.exit(1);
      }
      console.log(`Stopping unresponsive tracked dev server with pid ${state.pid}.`);
      await stopProcessTree(state.pid);
      await removeState();
    }
  } else if (state) {
    await removeState();
  }

  const portCheck = await checkPort(host, port);
  if (!portCheck.available) {
    if (portCheck.code === "EPERM" || portCheck.code === "EACCES") {
      throwPortError(`Cannot bind ${host}:${port}: ${portCheck.message}`, "Grant localhost bind permission and retry.");
    }
    throwPortError(
      `Port ${port} on ${host} is already in use by an untracked process.`,
      "Stop that process, then retry corepack pnpm desktop."
    );
  }

  if (dryRun) {
    return {
      message: `Desktop preflight passed. ${devUrl.href} is available.`,
      started: false,
      url: devUrl.href
    };
  }

  await runNodeScript(startScript);
  const nextState = await readState();
  return {
    message: `Desktop frontend server is ready at ${nextState?.url ?? devUrl.href}.`,
    started: true,
    url: nextState?.url ?? devUrl.href
  };
}

function throwPortError(message, hint) {
  console.error(message);
  console.error(hint);
  process.exit(1);
}

function runNodeScript(scriptPath) {
  return new Promise((resolve, reject) => {
    const childProcess = spawn(process.execPath, [scriptPath], {
      cwd: repoRoot,
      stdio: "inherit"
    });

    childProcess.once("error", reject);
    childProcess.once("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${path.basename(scriptPath)} exited with code ${code}`));
      }
    });
  });
}

function stopChild(signal) {
  if (stopping) {
    return;
  }
  stopping = true;

  if (!child.pid) {
    return;
  }

  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }

  try {
    process.kill(-child.pid, signal);
  } catch {
    child.kill(signal);
  }
}

function commandWorks(command, args, env) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env,
    shell: process.platform === "win32",
    stdio: "ignore",
    timeout: 10000
  });

  return result.status === 0;
}

function withCargoBin(baseEnv) {
  const env = { ...baseEnv };
  const cargoBin = getCargoBin();
  if (!cargoBin || !fs.existsSync(cargoBin)) {
    return env;
  }

  const pathKey = getPathKey(env);
  const currentPath = env[pathKey] ?? "";
  const entries = currentPath.split(path.delimiter).filter(Boolean);
  if (!entries.includes(cargoBin)) {
    env[pathKey] = [cargoBin, ...entries].join(path.delimiter);
  }
  return env;
}

function getCargoBin() {
  if (process.platform === "win32") {
    const profile = process.env.USERPROFILE;
    return profile ? path.join(profile, ".cargo", "bin") : null;
  }

  return path.join(os.homedir(), ".cargo", "bin");
}

function getPathKey(env) {
  return Object.keys(env).find((key) => key.toLowerCase() === "path") ?? "PATH";
}
