# DESKTOP-TESTING.md

Manual desktop smoke checklist for the Tauri editor shell.

Per decision `009`, the desktop editor is the authoritative authoring surface. Browser smoke does not replace desktop verification. Run this pass before merging any slice that touches file handling, asset import, runtime launch, or export.

## Prerequisites

- Rust toolchain available on `PATH` (or under `~/.cargo/bin`).
- Platform Tauri prerequisites installed (see `README.md`).
- A clean working tree or scratch directory for write tests.

## Preflight

Run the environment check:

```sh
corepack pnpm run doctor
```

Run the desktop-shell preflight without opening the app:

```sh
corepack pnpm desktop:check
```

## Scratch Workspace

Use a temporary directory outside the repo so file writes, copied assets, and exports are easy to inspect. The examples below assume:

- Scratch root: `/tmp/fieldcraft-desktop-smoke/`
- Original package dir: `/tmp/fieldcraft-desktop-smoke/package-a/`
- Save As package dir: `/tmp/fieldcraft-desktop-smoke/package-b/`
- Export dir: `/tmp/fieldcraft-desktop-smoke/exports/`

Use the committed local fixture assets when the pass needs media import:

- `apps/editor/test-fixtures/assets/checkerboard-32.png`
- `apps/editor/test-fixtures/assets/test-tone-440hz.wav`

Suggested saved files for the pass:

- `/tmp/fieldcraft-desktop-smoke/package-a/desktop-square.fieldcraft.json`
- `/tmp/fieldcraft-desktop-smoke/package-a/desktop-hex.fieldcraft.json`
- `/tmp/fieldcraft-desktop-smoke/package-a/desktop-free.fieldcraft.json`
- `/tmp/fieldcraft-desktop-smoke/package-b/desktop-square-copy.fieldcraft.json`
- `/tmp/fieldcraft-desktop-smoke/exports/desktop-square.fieldcraft.runtime.html`

## Launch

```sh
corepack pnpm desktop
```

Wait for the Tauri editor window to open. The tracked dev server should be reused if already running, and stopped on exit only if this command started it.

## Recommended Pass

Use the checklist below as the pass/fail record, but run it in this order so every item is exercised from a known state.

### Pass 1: Square Board, Save, Assets, Save As, Runtime, Export

1. Start from a blank editor window.
2. Set the title to `Desktop Smoke Square`.
3. Create a `6 x 5` square board.
4. Place at least two markers.
5. Launch the runtime view once and confirm the board is read-only there, then return to the editor.
6. Use **Save Scenario** on the untitled document and save it as `/tmp/fieldcraft-desktop-smoke/package-a/desktop-square.fieldcraft.json`.
7. Make one more visible edit, then use **Save Scenario** again and confirm it writes directly to the same path without a dialog.
8. Import the fixture image and audio assets listed above.
9. Set the imported checkerboard image as the board background.
10. Save again.
11. Inspect `/tmp/fieldcraft-desktop-smoke/package-a/` on disk:
    - `desktop-square.fieldcraft.json` exists.
    - `assets/checkerboard-32.png` exists.
    - `assets/test-tone-440hz.wav` exists.
    - The scenario JSON references `assets/...` relative paths.
12. Use **Save As** and save the scenario to `/tmp/fieldcraft-desktop-smoke/package-b/desktop-square-copy.fieldcraft.json`.
13. Inspect `/tmp/fieldcraft-desktop-smoke/package-b/` on disk:
    - `desktop-square-copy.fieldcraft.json` exists.
    - `package-b/assets/` contains the copied image and audio files.
    - The copied scenario still references `assets/...` relative paths.
14. Export the browser runtime to `/tmp/fieldcraft-desktop-smoke/exports/desktop-square.fieldcraft.runtime.html`.
15. Open the exported HTML in a browser and confirm the scenario renders end to end with the bundled background image.

### Pass 2: Native Open and Hex Board

1. With the square scenario still open and dirty, use **New Scenario** and confirm the unsaved-changes prompt appears.
2. Continue with a blank scenario.
3. Set the title to `Desktop Smoke Hex`.
4. Create a small pointy-top hex board.
5. Place at least two markers.
6. Use **Save Scenario** and save it as `/tmp/fieldcraft-desktop-smoke/package-a/desktop-hex.fieldcraft.json`.
7. Use **Open Scenario** and reopen `/tmp/fieldcraft-desktop-smoke/package-a/desktop-square.fieldcraft.json`.
8. Confirm the native open dialog was used and that the saved square scenario, assets, and marker state reload correctly.

### Pass 3: Free-Coordinate Board

1. Create a new scenario titled `Desktop Smoke Free`.
2. Create a free-coordinate board with non-zero origin values such as `x = -50`, `y = -25`, `width = 100`, `height = 80`.
3. Place at least two markers.
4. Save it as `/tmp/fieldcraft-desktop-smoke/package-a/desktop-free.fieldcraft.json`.
5. Launch the runtime view and confirm the free-coordinate markers render correctly there.

### Pass 4: Session Restore and Draft Recovery

1. Open any saved smoke scenario.
2. Make an unsaved change that is easy to recognize after restart.
3. End the desktop app with a crash-like exit rather than a clean close.
   Linux: end the `fieldcraft` process from the system monitor or another terminal.
   macOS: force quit it from Activity Monitor.
   Windows: end it from Task Manager.
4. Relaunch `corepack pnpm desktop`.
5. Confirm draft recovery offers the unsaved work and restores it when accepted.
6. Confirm the on-disk scenario file is still unchanged until an explicit save.

## Checklist

Check off each item while running the recommended pass above and note any regression in the PR description.

### File commands

- [ ] **New Scenario** prompts to confirm when the current document is dirty. (`Pass 2`)
- [ ] **Open Scenario** uses the native OS file dialog, not a browser picker. (`Pass 2`)
- [ ] **Save Scenario** on a titled document writes directly to disk without a dialog. (`Pass 1`)
- [ ] **Save Scenario** on an untitled document falls through to **Save As**. (`Pass 1`)
- [ ] **Save As** uses the native save dialog and writes to the chosen path. (`Pass 1`)
- [ ] Saved file contents on disk change only after an explicit `Save` or `Save As`. (`Pass 1`, `Pass 4`)

### Asset import and packaging

- [ ] Importing an image asset copies the source file into `assets/` beside the scenario file. (`Pass 1`)
- [ ] Importing an audio asset copies into `assets/` (playback not required in this slice). (`Pass 1`)
- [ ] Assigning an imported image as a board background renders correctly. (`Pass 1`)
- [ ] Scenario JSON references assets by stable relative paths. (`Pass 1`)
- [ ] **Save As** to a new location carries `assets/` forward into the new location. (`Pass 1`)

### Runtime and export

- [ ] Launching the in-app runtime view renders the current scenario read-only. (`Pass 1`)
- [ ] Persisted marker state (square, hex, and free-coordinate) renders correctly in the runtime view. (`Pass 1`, `Pass 2`, `Pass 3`)
- [ ] Browser runtime export produces a self-contained bundle including referenced assets. (`Pass 1`)
- [ ] Opening the exported bundle in a browser renders the scenario end to end. (`Pass 1`)

### Session behavior

- [ ] Closing and relaunching the desktop app preserves expected session/draft state. (`Pass 4`)
- [ ] Draft recovery offers to restore unsaved work after a crash-like exit. (`Pass 4`)

## Reporting

Capture the platform (OS + version), build type (dev shell vs debug binary), scratch root, and any deviation. File issues for regressions rather than expanding this checklist inline unless the new item is release-significant for every slice.

Suggested report footer:

- Platform:
- Build:
- Scratch root:
- Result:
- Deviations:
