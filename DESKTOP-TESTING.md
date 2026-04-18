# DESKTOP-TESTING.md

Manual desktop smoke checklist for the Tauri editor shell.

Per decision `009`, the desktop editor is the authoritative authoring surface. Browser smoke does not replace desktop verification. Run this pass before merging any slice that touches file handling, asset import, runtime launch, or export.

## Prerequisites

- Rust toolchain available on `PATH` (or under `~/.cargo/bin`).
- Platform Tauri prerequisites installed (see `README.md`).
- A clean working tree or scratch directory for write tests.

## Launch

```sh
corepack pnpm desktop
```

Wait for the Tauri editor window to open. The tracked dev server should be reused if already running, and stopped on exit only if this command started it.

## Checklist

Run through each group and note any regression in the PR description.

### File commands

- [ ] **New Scenario** prompts to confirm when the current document is dirty.
- [ ] **Open Scenario** uses the native OS file dialog, not a browser picker.
- [ ] **Save Scenario** on a titled document writes directly to disk without a dialog.
- [ ] **Save Scenario** on an untitled document falls through to **Save As**.
- [ ] **Save As** uses the native save dialog and writes to the chosen path.
- [ ] Saved file contents on disk change only after an explicit `Save` or `Save As`.

### Asset import and packaging

- [ ] Importing an image asset copies the source file into `assets/` beside the scenario file.
- [ ] Importing an audio asset copies into `assets/` (playback not required in this slice).
- [ ] Assigning an imported image as a board background renders correctly.
- [ ] Scenario JSON references assets by stable relative paths.
- [ ] **Save As** to a new location carries `assets/` forward into the new location.

### Runtime and export

- [ ] Launching the in-app runtime view renders the current scenario read-only.
- [ ] Persisted marker state (across board types) renders correctly in the runtime view.
- [ ] Browser runtime export produces a self-contained bundle including referenced assets.
- [ ] Opening the exported bundle in a browser renders the scenario end to end.

### Session behavior

- [ ] Closing and relaunching the desktop app preserves expected session/draft state.
- [ ] Draft recovery offers to restore unsaved work after a crash-like exit.

## Reporting

Capture the platform (OS + version), build type (dev shell vs debug binary), and any deviation. File issues for regressions rather than expanding this checklist inline unless the new item is release-significant for every slice.
