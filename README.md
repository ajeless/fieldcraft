# Fieldcraft

A visual authoring tool for turn-based tactical board game experiences.

## Vision

Fieldcraft aims to be an editor-first environment for designing, play-testing, and exporting tactical scenarios. Scenario authors should be able to draw maps, define units, author rules in a small expression language, and play-test without leaving the editor. Finished work should export to a playable browser build or a standalone desktop binary.

## Status

First vertical slices in progress: a minimal editor can place markers on a square grid, save and open human-readable scenario JSON documents in the desktop shell, and launch a read-only runtime view from the current scenario.

## Stack

- **Editor shell:** Tauri
- **Engine and editor UI:** TypeScript
- **Package manager:** pnpm
- **Export targets:** Browser bundle, Tauri standalone binary

## Development

Prerequisites:

- Node.js 22.12 or newer with Corepack
- Rust, Cargo, and [platform Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for desktop commands

Install dependencies:

```sh
corepack pnpm install
```

Start the browser editor:

```sh
corepack pnpm start
```

The tracked dev server listens on `http://127.0.0.1:5173/` by default. It writes process state to `.fieldcraft/run/dev-server.json` and logs to `.fieldcraft/logs/dev-server.log`.

Stop the browser editor:

```sh
corepack pnpm stop
```

Build the browser app:

```sh
corepack pnpm build
```

Run the browser smoke test:

```sh
corepack pnpm test:smoke
```

The smoke test starts the tracked dev server if needed, places a marker, saves the scenario, launches the runtime, verifies the marker is rendered there, closes the runtime, and stops any server it started.

Run the Tauri desktop shell:

```sh
corepack pnpm tauri:dev
```

The Tauri command requires a local Rust toolchain and platform prerequisites. The browser editor/runtime loop can be used without Rust.

In the desktop shell, **Open Scenario**, **Save Scenario**, and **Save As** use native file dialogs. In the browser fallback, **Open Scenario** imports JSON through the browser file picker and **Download JSON** saves a copy.

## Docs

- `README.md` — project overview and current status
- `AGENTS.md` — workflow, contribution guardrails, and how to work in this repo
- `DEPENDENCIES.md` — developer dependency setup for browser and Tauri workflows
- `DECISIONS.md` — canonical record of settled architectural and design decisions
- `CLAUDE.md` — compatibility pointer to `AGENTS.md`
