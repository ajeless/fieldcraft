# DESKTOP-TESTING.md

Residual human-only desktop checklist for the Tauri editor shell.

Per decision `009`, the desktop editor is still the authoritative authoring surface. Most desktop semantics now have automated coverage through `corepack pnpm test:desktop:smoke`; this document only covers the release-significant checks that are not credibly scriptable in the current repo tooling.

## What Is Automated

Run these first:

```sh
corepack pnpm run doctor
corepack pnpm desktop:check
corepack pnpm test:desktop:smoke
```

The automated desktop smoke now covers:

- save/open semantics in the Tauri dev shell
- package-local image/audio import and copied `assets/` contents
- `Save As` carrying package assets forward
- viewer launch and read-only board rendering
- browser viewer export written from the desktop shell
- draft-recovery semantics after a crash-like process kill

If any of those fail, fix the automation failure before doing a manual pass.

## What Still Needs A Human

These are the checks that remain manual today:

- native OS dialog presentation and cancellation behavior
- native unsaved-changes warning dialog presentation
- packaged-binary sanity beyond the scripted dev-shell path

Use the automated smoke artifacts under the OS temp directory (typically `/tmp/fieldcraft-desktop-smoke/` on Linux; platform-equivalent locations on macOS and Windows, as determined by Node's `os.tmpdir()`) if you want ready-made scenarios and package folders for the manual pass.

## Human Pass

Launch the desktop shell:

```sh
corepack pnpm desktop
```

For packaged-build-significant work, also launch the debug binary once:

```sh
corepack pnpm desktop:debug
```

`target/debug/fieldcraft` is reused by both dev and packaged-debug flows. If you launch that path directly without rebuilding first and see `Could not connect to 127.0.0.1: Connection refused`, you are running a dev-style artifact that still expects the Vite server.

Recommended quick pass:

1. Open any saved smoke scenario from `package-a/` or `package-b/` under the smoke scratch root (typically `/tmp/fieldcraft-desktop-smoke/` on Linux; platform-equivalent elsewhere).
2. Dirty the document.
3. Trigger **New Scenario** and confirm the native unsaved-changes dialog appears. Cancel once, then accept once.
4. Trigger **Open Scenario** and confirm the native OS open dialog appears. Cancel once, then reopen a saved smoke scenario through the dialog.
5. Trigger **Save As** and confirm the native OS save dialog appears. Cancel once, then save to a new scratch path.
6. On an untitled document, trigger **Save Scenario** and confirm it falls through to the native save dialog rather than silently writing somewhere unexpected.
7. If the slice changes desktop packaging or startup behavior, launch the debug binary and confirm the window opens and the native dialogs still work there.

The codebase and command names still use `runtime` for historical reasons. Under v1 scope, that surface is a presentation viewer.

## Checklist

- [ ] Dirty-document **New Scenario** shows the native unsaved-changes dialog. Cancel leaves the document intact; accept discards it.
- [ ] **Open Scenario** uses the OS open dialog. Cancel is safe; selecting a file loads it.
- [ ] **Save As** uses the OS save dialog. Cancel is safe; selecting a path writes there.
- [ ] **Save Scenario** on an untitled document falls through to the native save dialog.
- [ ] The debug binary launches and shows the same native dialog behavior when the slice is release-significant for packaging/startup.

## Reporting

Capture the platform (OS + version), build type (dev shell vs debug binary), whether `corepack pnpm test:desktop:smoke` was green first, and any deviation.

Suggested report footer:

- Platform:
- Build:
- Automated desktop smoke:
- Result:
- Deviations:
