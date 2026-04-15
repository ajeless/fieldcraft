import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const runtimeDir = path.join(repoRoot, ".fieldcraft", "run");
export const logDir = path.join(repoRoot, ".fieldcraft", "logs");
export const statePath = path.join(runtimeDir, "dev-server.json");

export function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function readState() {
  try {
    return JSON.parse(await fs.readFile(statePath, "utf8"));
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function writeState(state) {
  await fs.mkdir(runtimeDir, { recursive: true });
  await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);
}

export async function removeState() {
  await fs.rm(statePath, { force: true });
}

export function isProcessRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error && error.code === "EPERM";
  }
}

export async function isPortAvailable(host, port) {
  return (await checkPort(host, port)).available;
}

export async function checkPort(host, port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (error) => {
      resolve({
        available: false,
        code: error?.code,
        message: error instanceof Error ? error.message : String(error)
      });
    });
    server.once("listening", () => {
      server.close(() => {
        resolve({ available: true });
      });
    });
    server.listen(port, host);
  });
}

export async function waitForPortAvailable(host, port, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await isPortAvailable(host, port)) {
      return true;
    }
    await wait(150);
  }

  return false;
}

export async function waitForUrl(url, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) {
        return;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await wait(250);
  }

  throw lastError instanceof Error ? lastError : new Error(`Timed out waiting for ${url}`);
}

export async function stopProcessTree(pid) {
  if (!isProcessRunning(pid)) {
    return;
  }

  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }

  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      return;
    }
  }

  const stopped = await waitUntilStopped(pid, 5000);

  if (!stopped) {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // Process is already gone.
      }
    }
  }
}

export async function waitUntilStopped(pid, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (!isProcessRunning(pid)) {
      return true;
    }
    await wait(100);
  }

  return !isProcessRunning(pid);
}

export function pnpmCommand(args) {
  const pnpm = spawnSync("pnpm", ["--version"], { stdio: "ignore" });

  if (pnpm.status === 0) {
    return {
      command: "pnpm",
      args
    };
  }

  return {
    command: "corepack",
    args: ["pnpm", ...args]
  };
}
