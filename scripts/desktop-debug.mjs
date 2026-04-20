#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pnpmCommand, repoRoot, withCargoBin } from "./process-utils.mjs";

const cargoEnv = withCargoBin(process.env);
const binaryName = process.platform === "win32" ? "fieldcraft.exe" : "fieldcraft";
const binaryPath = path.join(repoRoot, "apps", "editor", "src-tauri", "target", "debug", binaryName);
let child = null;
let stopping = false;

process.once("SIGINT", () => stopChild("SIGINT"));
process.once("SIGTERM", () => stopChild("SIGTERM"));

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

async function main() {
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
    console.error("Fieldcraft packaged debug preflight failed:");
    for (const error of preflightErrors) {
      console.error(`- ${error}`);
    }
    console.error("Run corepack pnpm run doctor for a fuller dependency report.");
    process.exit(1);
  }

  console.log("Building the packaged-style debug desktop binary...");
  await runCommand(
    pnpmCommand(["--dir", "apps/editor", "exec", "tauri", "build", "--debug", "--no-bundle"]),
    { env: cargoEnv }
  );

  if (!fs.existsSync(binaryPath)) {
    console.error(`Expected debug binary at ${binaryPath}, but it was not produced.`);
    process.exit(1);
  }

  console.log(`Launching ${binaryPath}`);
  console.log("Close the desktop window or press Ctrl+C here to stop it.");

  child = spawn(binaryPath, [], {
    cwd: repoRoot,
    env: cargoEnv,
    shell: process.platform === "win32",
    stdio: "inherit"
  });

  const result = await new Promise((resolve) => {
    child.once("exit", (code, signal) => {
      resolve({ code, signal });
    });
  });

  if (result.signal) {
    process.exitCode = 0;
  } else {
    process.exitCode = result.code ?? 0;
  }
}

function stopChild(signal) {
  if (stopping) {
    return;
  }
  stopping = true;

  if (!child?.pid) {
    return;
  }

  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }

  child.kill(signal);
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

function runCommand(command, options = {}) {
  return new Promise((resolve, reject) => {
    const childProcess = spawn(command.command, command.args, {
      cwd: repoRoot,
      env: options.env ?? process.env,
      shell: process.platform === "win32",
      stdio: "inherit"
    });

    childProcess.once("error", reject);
    childProcess.once("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command.command} ${command.args.join(" ")} exited with code ${code}`));
      }
    });
  });
}
