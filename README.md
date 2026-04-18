# Fieldcraft

A visual authoring tool for turn-based tactical board game experiences.

## Vision

Fieldcraft aims to be an editor-first environment for designing, play-testing, and exporting tactical scenarios. Scenario authors should be able to draw maps, define units, author rules in a small expression language, and play-test without leaving the editor. Finished work should export to a playable browser build or a standalone desktop binary.

## Status

The editor can author small tactical scenarios end to end: create square, pointy-top hex, and free-coordinate boards; place, select, and delete colocated markers; save, open, and recover scenario JSON; edit that JSON inline with validation; import package-local image/audio assets on desktop; launch a read-only runtime view; and export a self-contained browser runtime with bundled assets.

The desktop editor is the authoritative authoring surface (decision `009`). The browser editor is a constrained development, testing, and demo surface, not a parity promise.

See `PLAN.md` for slice-level baseline detail and the current near-term branch sequence.

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

### Browser Testing

Use the browser flow when you want the fastest editor loop and when you are testing browser-specific file behavior such as file-picker import and JSON download. This is also the current automated coverage path for the repo.

Start the browser editor:

```sh
corepack pnpm start
```

The tracked Vite dev server runs at `http://127.0.0.1:5173/` by default, writes process state to `.fieldcraft/run/dev-server.json`, and writes logs to `.fieldcraft/logs/dev-server.log`. Desktop dev mode uses this server; production desktop builds bundle static assets from `apps/editor/dist/` and do not require Vite.

Manual browser test flow:

1. Run `corepack pnpm start`.
2. Open `http://127.0.0.1:5173/` in a browser.
3. Exercise editor and runtime flows in the browser UI.
4. Verify browser-specific file behavior:
   - **Open Scenario** uses the browser file picker.
   - **Save Scenario** updates the browser fallback save state.
   - **Download JSON** writes a downloaded copy.
5. Stop the tracked dev server when finished.

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

If Google Chrome is unavailable locally, install Playwright's Chromium first:

```sh
corepack pnpm exec playwright install chromium
```

The smoke test exercises the main browser editor and runtime flows end to end. See `scripts/test-browser-smoke.mjs` for the current coverage surface.

Run the editor unit tests (identity generator, scenario migrations, and the `loadScenario` entry point):

```sh
corepack pnpm test:unit
```

### Desktop Testing

Use the desktop flow when you need to verify native dialogs, restart behavior, package-local asset imports, or the Tauri shell itself. This is the authoritative authoring path and the path that corresponds to the standalone binary target.

Run the desktop preflight first:

```sh
corepack pnpm desktop:check
```

Run the Tauri desktop shell for development:

```sh
corepack pnpm desktop
```

The desktop script checks the Tauri dev port, uses the local Rust toolchain from `~/.cargo/bin` when needed, starts or reuses the tracked browser dev server, launches the Tauri development shell, and stops only the server it started.

Desktop coverage is currently manual and release-significant per decision `009`. A passing browser smoke run does not replace native desktop verification. See `DESKTOP-TESTING.md` for the checklist.

`DESKTOP-TESTING.md` now includes a repeatable scratch-package flow, suggested filenames, and the local fixture assets to use for the release-significant pass.

Manual desktop test flow:

1. Run `corepack pnpm desktop`.
2. Wait for the Tauri editor window to open.
3. Exercise the same editor and runtime flows there.
4. Verify desktop-specific behavior:
   - **Open Scenario** and **Save As** use native file dialogs.
   - **Save Scenario** writes directly to the current file once the scenario already has a path; otherwise it falls back to **Save As**.
   - Closing and relaunching the app preserves any expected desktop session behavior you are testing.
   - Saved files on disk only change after explicit `Save` or `Save As`.

A debug desktop binary built with `corepack pnpm --dir apps/editor tauri build --debug --no-bundle` lives at `apps/editor/src-tauri/target/debug/fieldcraft`.

Build the debug desktop binary:

```sh
corepack pnpm --dir apps/editor tauri build --debug --no-bundle
```

Run it directly on Unix-like systems:

```sh
./apps/editor/src-tauri/target/debug/fieldcraft
```

Run it directly on Windows:

```powershell
.\apps\editor\src-tauri\target\debug\fieldcraft.exe
```

In the desktop shell, **Open Scenario** and **Save As** use native file dialogs, while **Save Scenario** writes directly to the current file after the scenario has a path. In the browser fallback, **Open Scenario** imports JSON through the browser file picker and **Download JSON** saves a copy.

### Maintenance

Tauri icon assets are generated from `apps/editor/src-tauri/app-icon.svg` and committed under `apps/editor/src-tauri/icons/`.

```sh
corepack pnpm --dir apps/editor tauri icon src-tauri/app-icon.svg
```

References:

- Tauri v2 prerequisites: https://v2.tauri.app/start/prerequisites/
- Rust installation: https://www.rust-lang.org/tools/install

## Docs

See `AGENTS.md` for contribution workflow and doc ownership. See `DECISIONS.md` for settled architectural choices.
