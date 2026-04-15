#!/usr/bin/env node
import path from "node:path";
import {
  isProcessRunning,
  readState,
  removeState,
  repoRoot,
  statePath,
  stopProcessTree,
  waitForPortAvailable
} from "./process-utils.mjs";

const state = await readState();

if (!state) {
  console.log(`No tracked Fieldcraft dev server found at ${path.relative(repoRoot, statePath)}.`);
  process.exit(0);
}

if (!isProcessRunning(state.pid)) {
  await removeState();
  console.log(`Removed stale Fieldcraft dev server state for pid ${state.pid}.`);
  process.exit(0);
}

await stopProcessTree(state.pid);

if (state.host && state.port) {
  const freed = await waitForPortAvailable(state.host, state.port);
  if (!freed) {
    console.error(`Stopped pid ${state.pid}, but ${state.host}:${state.port} did not become available.`);
    process.exitCode = 1;
  }
}

await removeState();
console.log(`Stopped Fieldcraft dev server pid ${state.pid}.`);
