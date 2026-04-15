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
- Rust, Cargo, rustup, and [platform Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for desktop commands
- Google Chrome or Playwright-managed Chromium for browser smoke tests

The browser editor/runtime loop only needs Node.js, Corepack, and pnpm. Desktop commands also need Rust and native system packages.

### Platform Setup

#### Ubuntu/Debian

```sh
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

#### macOS

```sh
xcode-select --install
```

#### Windows

- Install Microsoft C++ Build Tools with the "Desktop development with C++" workload
- Install Microsoft Edge WebView2 Runtime if it is not already present
- Install Rust with the MSVC toolchain

Rust can be installed with rustup:

```sh
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh
. "$HOME/.cargo/env"
```

On Windows, Rust can also be installed with winget:

```powershell
winget install --id Rustlang.Rustup
rustup default stable-msvc
```

Install dependencies:

```sh
corepack pnpm install
```

Check the local developer environment:

```sh
corepack pnpm run doctor
```

Start the browser editor:

```sh
corepack pnpm start
```

The tracked Vite dev server runs at `http://127.0.0.1:5173/` by default, writes process state to `.fieldcraft/run/dev-server.json`, and writes logs to `.fieldcraft/logs/dev-server.log`. Desktop dev mode uses this server; production desktop builds bundle static assets from `apps/editor/dist/` and do not require Vite.

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

Run the Tauri desktop shell for development:

```sh
corepack pnpm desktop
```

The desktop script checks the Tauri dev port, uses the local Rust toolchain from `~/.cargo/bin` when needed, starts or reuses the tracked browser dev server, launches the Tauri development shell, and stops only the server it started.

A debug desktop binary built with `corepack pnpm --dir apps/editor tauri build --debug --no-bundle` lives at `apps/editor/src-tauri/target/debug/fieldcraft`.

In the desktop shell, **Open Scenario**, **Save Scenario**, and **Save As** use native file dialogs. In the browser fallback, **Open Scenario** imports JSON through the browser file picker and **Download JSON** saves a copy.

### Maintenance

Tauri icon assets are generated from `apps/editor/src-tauri/app-icon.svg` and committed under `apps/editor/src-tauri/icons/`.

```sh
corepack pnpm --dir apps/editor tauri icon src-tauri/app-icon.svg
```

References:

- Tauri v2 prerequisites: https://v2.tauri.app/start/prerequisites/
- Rust installation: https://www.rust-lang.org/tools/install

## Docs

- `README.md` — project overview, setup, commands, and docs index
- `AGENTS.md` — workflow, contribution guardrails, and how to work in this repo
- `DECISIONS.md` — canonical record of settled architectural and design decisions
- `NEXT.md` — current near-term branch plan and manually discovered priorities
- `CLAUDE.md` — compatibility pointer to `AGENTS.md`
