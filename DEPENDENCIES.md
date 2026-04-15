# DEPENDENCIES.md

Developer dependency notes for Fieldcraft.

This file is intentionally practical: it records the tools needed to run the browser authoring loop and the native Tauri desktop shell. It can be folded into the README later if the setup stabilizes.

## Current Project Requirements

- Node.js 22.12 or newer
- Corepack
- pnpm 10, managed through Corepack
- Rust, Cargo, and rustup for Tauri desktop commands
- Platform-specific Tauri system dependencies
- Google Chrome or Playwright-managed Chromium for browser smoke tests

The browser editor/runtime loop only needs Node/Corepack/pnpm. The Tauri desktop shell also needs Rust and native system packages.

## Tauri, Vite, And The Desktop Binary

Tauri is the native desktop shell and build pipeline. Fieldcraft's editor UI and application logic are TypeScript running inside the Tauri window's WebView.

Vite is used in two different ways:

- In development, `corepack pnpm desktop` starts Vite on `http://127.0.0.1:5173/` and points the Tauri window at that local dev server.
- In a built desktop app, Vite first compiles static frontend assets into `apps/editor/dist/`, then Tauri builds a native binary that loads those assets. A shipped desktop build does not need port `5173` or a Vite dev server.

After a debug native build:

```sh
. "$HOME/.cargo/env"
corepack pnpm --dir apps/editor tauri build --debug --no-bundle
```

the runnable debug binary lives at:

```sh
apps/editor/src-tauri/target/debug/fieldcraft
```

It can be run directly from a terminal or launched from a file manager if the desktop environment allows executing local binaries. It is not installed as a system application unless a platform bundle is built and installed.

Release builds normally place the direct binary at `apps/editor/src-tauri/target/release/fieldcraft`; packaged installers or app bundles are written under `apps/editor/src-tauri/target/release/bundle/`.

## Ubuntu/Debian Setup

This is the expected setup path for the current Linux development host.

Install Tauri's Linux system dependencies:

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

Install Rust with rustup:

```sh
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh
```

Then restart the terminal, or load Cargo's environment in the current shell:

```sh
. "$HOME/.cargo/env"
```

Enable Corepack shims if you want the `pnpm` command available directly:

```sh
corepack enable
```

The repo scripts also work through `corepack pnpm ...`, so enabling shims is helpful but not required for the documented commands.

Install project dependencies:

```sh
corepack pnpm install
```

## What Was Missing On This Host

`corepack pnpm --dir apps/editor tauri info` reported these missing desktop dependencies before setup:

- `webkit2gtk-4.1`
- `rsvg2`
- `rustc`
- `Cargo`
- `rustup`

On Ubuntu/Debian, the native package command above supplies the WebKit/rsvg/system-library side. The rustup command supplies `rustc`, `cargo`, and `rustup`.

## macOS Setup

Install Xcode Command Line Tools for desktop-only development:

```sh
xcode-select --install
```

Install Rust:

```sh
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh
```

Install project dependencies:

```sh
corepack pnpm install
```

Full Xcode is only needed if/when the project targets iOS.

## Windows Setup

Install:

- Microsoft C++ Build Tools with the "Desktop development with C++" workload
- Microsoft Edge WebView2 Runtime if it is not already present
- Rust via rustup, using the MSVC toolchain

Rust can be installed with winget:

```powershell
winget install --id Rustlang.Rustup
```

If Rust was already installed with a non-MSVC default, set the stable MSVC toolchain:

```powershell
rustup default stable-msvc
```

Then install project dependencies:

```powershell
corepack pnpm install
```

## Verify The Browser Loop

```sh
corepack pnpm run doctor
corepack pnpm build
corepack pnpm test:smoke
```

The smoke test starts the tracked dev server if needed, places a marker in the editor, saves the scenario, launches the runtime, verifies the marker renders there, closes the runtime, and stops any server it started.

## Verify The Tauri Tooling

```sh
corepack pnpm run doctor
```

Once the system dependencies and Rust are installed, this should report passing checks for Node, Corepack, pnpm, Cargo, rustc, the Tauri CLI, the desktop dev port, and Linux native packages such as GTK 3, WebKitGTK 4.1, and librsvg.

Run the desktop shell:

```sh
corepack pnpm desktop
```

The desktop script checks the dev port before launch and prepends `~/.cargo/bin` to PATH when that directory exists, which handles the common case where Rust is installed but the current terminal did not load Cargo's environment.

The lower-level equivalent remains available as:

```sh
corepack pnpm tauri:dev
```

It uses the same friendly launcher.

The repo-owned `corepack pnpm start` and `corepack pnpm stop` scripts track and clean up the browser dev server they start. `corepack pnpm desktop` starts that tracked browser server when needed, reuses it when it is already running, and stops only the server it started. If the same port is held by an untracked process, the desktop script stops before launch and reports that directly.

## Tauri Icons

Tauri expects desktop icons during native compilation. Fieldcraft keeps the source icon at `apps/editor/src-tauri/app-icon.svg` and commits generated desktop icon assets under `apps/editor/src-tauri/icons/`.

Regenerate icons with:

```sh
corepack pnpm --dir apps/editor tauri icon src-tauri/app-icon.svg
```

## References

- Tauri v2 prerequisites: https://v2.tauri.app/start/prerequisites/
- Rust installation: https://www.rust-lang.org/tools/install
