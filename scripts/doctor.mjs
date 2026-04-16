#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fsp from "node:fs/promises";
import path from "node:path";
import { checkPort, pnpmCommand, repoRoot, withCargoBin } from "./process-utils.mjs";

const tauriConfigPath = path.join(repoRoot, "apps", "editor", "src-tauri", "tauri.conf.json");
const tauriConfig = JSON.parse(await fsp.readFile(tauriConfigPath, "utf8"));
const devUrl = new URL(tauriConfig.build?.devUrl ?? "http://127.0.0.1:5173");
const host = devUrl.hostname;
const port = Number.parseInt(devUrl.port || (devUrl.protocol === "https:" ? "443" : "80"), 10);
const cargoEnv = withCargoBin(process.env);
const checks = [];

checkNode();
checkCommand("Corepack", "corepack", ["--version"]);
checkPnpm();
checkCommand("Cargo", "cargo", ["--version"], { env: cargoEnv });
checkCommand("rustc", "rustc", ["--version"], { env: cargoEnv });
checkCommand("rustup", "rustup", ["--version"], { env: cargoEnv, required: false });
checkTauriCli();
await checkDevPort();
checkLinuxNativeDeps();

for (const check of checks) {
  const detail = check.detail ? ` ${check.detail}` : "";
  console.log(`${check.status.padEnd(4)} ${check.label}${detail}`);
}

const failed = checks.filter((check) => check.status === "FAIL");
const warned = checks.filter((check) => check.status === "WARN");

console.log("");
if (failed.length > 0) {
  console.log(`Doctor found ${failed.length} failure${failed.length === 1 ? "" : "s"}.`);
  process.exit(1);
}

if (warned.length > 0) {
  console.log(`Doctor found ${warned.length} warning${warned.length === 1 ? "" : "s"}, but required checks passed.`);
} else {
  console.log("Doctor checks passed.");
}

function checkNode() {
  const version = process.versions.node;
  if (versionAtLeast(version, "22.12.0")) {
    pass("Node.js", version);
  } else {
    fail("Node.js", `${version}; expected 22.12.0 or newer`);
  }
}

function checkPnpm() {
  const pnpm = pnpmCommand(["--version"]);
  const result = run(pnpm.command, pnpm.args);
  if (result.ok) {
    pass("pnpm", clean(result.stdout));
  } else {
    fail("pnpm", "not available through pnpm or corepack pnpm");
  }
}

function checkTauriCli() {
  const tauri = pnpmCommand(["--dir", "apps/editor", "exec", "tauri", "--version"]);
  const result = run(tauri.command, tauri.args, { env: cargoEnv });
  if (result.ok) {
    pass("Tauri CLI", clean(result.stdout));
  } else {
    fail("Tauri CLI", "not available; run corepack pnpm install");
  }
}

async function checkDevPort() {
  const portCheck = await checkPort(host, port);
  if (portCheck.available) {
    pass("Desktop dev port", `${host}:${port} available`);
  } else if (portCheck.code === "EPERM" || portCheck.code === "EACCES") {
    fail("Desktop dev port", `${host}:${port} cannot be bound: ${portCheck.message}`);
  } else {
    warn("Desktop dev port", `${host}:${port} is already in use`);
  }
}

function checkLinuxNativeDeps() {
  if (process.platform !== "linux") {
    pass("Native desktop prerequisites", `${process.platform}; see README.md for platform setup`);
    return;
  }

  checkPkgConfig("GTK 3", "gtk+-3.0");
  checkPkgConfig("WebKitGTK 4.1", "webkit2gtk-4.1");
  checkPkgConfig("librsvg", "librsvg-2.0");
}

function checkPkgConfig(label, packageName) {
  const result = run("pkg-config", ["--modversion", packageName]);
  if (result.ok) {
    pass(label, clean(result.stdout));
  } else if (result.error?.code === "ENOENT") {
    fail(label, "pkg-config not found");
  } else {
    fail(label, `${packageName} not found`);
  }
}

function checkCommand(label, command, args, options = {}) {
  const required = options.required ?? true;
  const result = run(command, args, { env: options.env });
  if (result.ok) {
    pass(label, clean(result.stdout || result.stderr));
  } else if (required) {
    fail(label, "not found");
  } else {
    warn(label, "not found");
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env: options.env ?? process.env,
    encoding: "utf8",
    shell: process.platform === "win32",
    timeout: 10000
  });

  return {
    ok: result.status === 0,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error
  };
}

function pass(label, detail = "") {
  checks.push({ status: "PASS", label, detail });
}

function warn(label, detail = "") {
  checks.push({ status: "WARN", label, detail });
}

function fail(label, detail = "") {
  checks.push({ status: "FAIL", label, detail });
}

function clean(output) {
  return output.trim().split(/\r?\n/)[0] ?? "";
}

function versionAtLeast(actual, minimum) {
  const actualParts = actual.split(".").map((part) => Number.parseInt(part, 10));
  const minimumParts = minimum.split(".").map((part) => Number.parseInt(part, 10));

  for (let index = 0; index < minimumParts.length; index += 1) {
    const actualPart = actualParts[index] ?? 0;
    const minimumPart = minimumParts[index] ?? 0;
    if (actualPart > minimumPart) {
      return true;
    }
    if (actualPart < minimumPart) {
      return false;
    }
  }

  return true;
}
