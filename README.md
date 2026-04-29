# Fieldcraft

Fieldcraft is a visual map-and-scenario editor for tabletop wargames and turn-based tactical board games.

The editor is the product. A scenario author designs a map, places pieces, attaches package-local media, and saves a human-readable scenario file that people can use at a physical table, over screen share, or through a browser viewer export.

V1 is scoped as a personal tool made shippable-shaped. It is not a public release, a gameplay engine, or a finished-game packaging system.

## Current Baseline

Fieldcraft can already author small scenarios end to end. Square, pointy-top hex, and free-coordinate boards support permissive marker placement, selection, deletion, and colocation, with viewport pan/zoom/reset. The editor keeps in-memory undo/redo, persisted System/Light/Dark themes, and draft-recovery autosave across sessions. A small command registry drives file actions with unsaved-change guards on desktop and in the browser, and an editable source pane edits scenario JSON with targeted line/column diagnostics. The main editor vocabulary now lives in a left tool rail with Select and Marker tools, plus disabled Ruler and Hand placeholders for future vocabulary. The Scenario tab manages author-defined sides, and the Selection tab assigns selected markers to sides, authored facing, basic visual style, and typed descriptive properties. Desktop package-local image and audio import write assets beside the scenario file; the bottom asset strip exposes package assets near the board, filters to image assets when Marker is armed, and returns to the full package view after placement; markers can render imported image artwork; and `Save As` carries packaged assets forward. A read-only in-app viewer and a self-contained browser viewer export render authored scenarios with bundled assets. Scenario files use a human-readable v6 format with opaque piece ids, author-facing labels, scenario-level sides, optional `sideId` piece references, per-piece `facingDegrees`, per-piece `style`, per-piece typed `properties`, and a chained migration registry that upgrades older files on load.

The desktop editor is the authoritative authoring surface. The browser surface is useful for development, smoke testing, and demos, but it is not a parity promise.

The codebase still uses `runtime` in commands, filenames, and some UI labels for historical reasons. Under v1 scope, that surface is a scenario viewer.

See `PLAN.md` for the current branch plan and near-term slices.

## Stack

- Editor shell: Tauri
- Editor and viewer logic: TypeScript
- Package manager: pnpm
- Desktop toolchain: Rust
- V1 export target: browser viewer bundle

## Before You Start

You do not need the full desktop toolchain for every task.

- Browser-only work needs Node.js, Corepack, and pnpm.
- Desktop work also needs Rust plus Tauri's native OS dependencies.

Prerequisites:

- Node.js `22.12` or newer
- Corepack enabled
- Rust, Cargo, and rustup for desktop commands
- Tauri platform prerequisites for your OS
- Google Chrome or Playwright-managed Chromium for browser smoke tests

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

- Install Microsoft C++ Build Tools with the `Desktop development with C++` workload.
- Install Microsoft Edge WebView2 Runtime if it is not already present.
- Install Rust with the MSVC toolchain.

Install Rust with rustup:

```sh
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh
. "$HOME/.cargo/env"
```

Windows alternative:

```powershell
winget install --id Rustlang.Rustup
rustup default stable-msvc
```

### One-Time Repo Setup

Install JavaScript dependencies:

```sh
corepack pnpm install
```

Run the environment check:

```sh
corepack pnpm run doctor
```

`doctor` is the fastest way to catch missing Node, pnpm, Rust, or Linux desktop packages before you spend time on a build that was never going to start.

## Understand The Three Main Workflows

If you are not used to Tauri/Vite projects, the important distinction is this:

- `corepack pnpm desktop` runs the desktop development shell. It uses a live frontend dev server at `http://127.0.0.1:5173/`.
- `corepack pnpm desktop:debug` rebuilds and launches a packaged-style debug desktop app. It does not depend on the dev server after the build.
- `corepack pnpm tauri:build` produces a release-style desktop build and installer artifacts.

That difference matters because a binary in `target/debug/` may have been produced by either a dev flow or a packaged build flow. The wrapper commands exist so you do not have to remember which artifact is safe to launch for which purpose.

## 1. Build And Test The Desktop Debug Workflow

Use this when you want the normal day-to-day desktop development loop: native shell, native dialogs, and fast frontend iteration.

Run the desktop preflight:

```sh
corepack pnpm desktop:check
```

Run the automated desktop semantic smoke:

```sh
corepack pnpm test:desktop:smoke
```

Launch the desktop development shell:

```sh
corepack pnpm desktop
```

What this does:

- checks that the Tauri desktop dev port is usable
- starts or reuses the tracked Vite dev server at `http://127.0.0.1:5173/`
- launches the Tauri desktop shell against that live frontend
- stops only the dev server it started

This is the best path for:

- routine editor development
- manual testing of native dialogs and desktop-only file behavior
- validating that the desktop shell still matches the editor's current frontend state

Files written by the tracked browser server:

- process state: `.fieldcraft/run/dev-server.json`
- logs: `.fieldcraft/logs/dev-server.log`

If you want the human-only desktop checklist after the automated smoke, use `DESKTOP-TESTING.md`.

## 2. Build And Run A Packaged Desktop Binary

Use this when you want to verify startup and packaging behavior without depending on the live Vite dev server.

### Fast packaged debug path

This is the safest manual command for a packaged local binary:

```sh
corepack pnpm desktop:debug
```

That command:

- rebuilds the standalone Tauri debug binary with `tauri build --debug --no-bundle`
- launches the resulting binary from `apps/editor/src-tauri/target/debug/`

This is the right choice for:

- packaged-debug startup checks
- manual sanity checks for desktop packaging behavior
- avoiding stale `target/debug/fieldcraft` artifacts left behind by `tauri dev`

If you want to build it manually instead of using the wrapper:

```sh
corepack pnpm --dir apps/editor tauri build --debug --no-bundle
```

Unix-like systems:

```sh
./apps/editor/src-tauri/target/debug/fieldcraft
```

Windows:

```powershell
.\apps\editor\src-tauri\target\debug\fieldcraft.exe
```

If you see `Could not connect to 127.0.0.1: Connection refused`, you launched a dev-style artifact that still expects the Vite server. Rebuild first with `corepack pnpm desktop:debug`.

### Release-style desktop build

If you want the actual release binary and installer artifacts, build them with:

```sh
corepack pnpm tauri:build
```

Typical outputs:

- release binary: `apps/editor/src-tauri/target/release/fieldcraft`
- Linux bundle artifacts: `apps/editor/src-tauri/target/release/bundle/`

On Linux in this repo, that bundle directory currently contains formats such as `.deb` and `.rpm` when the build succeeds. Other platforms will produce their platform-appropriate outputs through Tauri.

Use the release-style build when you are checking:

- production-like startup behavior
- installer and bundle generation
- release-significant packaging changes

## 3. Check Whether The Web Version Is Working

Use this when you want the fastest editor loop or need to verify browser-specific behavior.

Start the tracked browser dev server:

```sh
corepack pnpm start
```

Then open:

```text
http://127.0.0.1:5173/
```

When you are done, stop that tracked server:

```sh
corepack pnpm stop
```

This is the right path for:

- quick UI checks
- browser-only file behavior
- smoke-testing the exported viewer support surface

Browser-specific expectations:

- **Open Scenario** uses the browser file picker
- **Save Scenario** uses the browser fallback save state
- **Download JSON** writes a downloaded copy instead of saving in place

Build the browser app:

```sh
corepack pnpm build
```

Run the browser smoke test:

```sh
corepack pnpm test:smoke
```

If Chrome is not available locally, install Playwright's Chromium first:

```sh
corepack pnpm exec playwright install chromium
```

## Other Useful Commands

Run the unit tests:

```sh
corepack pnpm test:unit
```

Generate Tauri icons from the committed source SVG:

```sh
corepack pnpm --dir apps/editor tauri icon src-tauri/app-icon.svg
```

## Docs

- `AGENTS.md`: agent workflow and contribution guardrails
- `DECISIONS.md`: settled architectural choices
- `PLAN.md`: current branch plan and deferred questions
- `DESKTOP-TESTING.md`: residual human-only desktop testing checklist
- `docs/EDITOR-V1-SCOPE.md`: authoritative v1 product scope
- `docs/RUNTIME-VISION.md`: historical runtime-bearing analysis preserved for context
- `docs/doc-audit-2026-04.md`: historical documentation audit and resolved follow-up record
- `docs/redesign/BRIEF.md`: durable spec for the editor UX/UI redesign
- `docs/redesign/reference/README.md`: how to read the mockup bundle that BRIEF.md references

## References

- Tauri v2 prerequisites: https://v2.tauri.app/start/prerequisites/
- Rust installation: https://www.rust-lang.org/tools/install
