# DECISIONS.md

Settled decisions that should not be relitigated without explicit discussion.

Mutable plans, open design questions, and implementation sequencing belong in `PLAN.md`.

## 001 — Editor-first, not engine-first

The editor is the product. The engine exists to serve the editor and the authored experiences it produces. Features that don't surface in the editor aren't ready to build.

## 002 — Tauri + TypeScript

The desktop editor uses Tauri as its shell. All application logic — engine, editor UI, rules interpreter — is TypeScript. Rust is used only where Tauri's backend requires it.

Rationale: TypeScript gives a single language across editor, engine, and browser export. Maximizes iteration speed and eliminates serialization boundaries between editor and engine.

## 003 — pnpm as package manager

Using pnpm for dependency management. Fast, strict, clean lockfile diffs, fully compatible with Tauri's build pipeline.

## 004 — Two distinct space models

Tile-based space (hex, quad, and potentially other tessellations with integer coordinates, discrete neighbor relationships) and free-coordinate space (floating-point positions, 360-degree bearing, continuous distance) are separate spatial models. They are not unified behind a single abstraction.

A scenario declares which space model it uses. The editor, engine, and rules language adapt accordingly.

Draft scenarios in the editor may temporarily have no configured space model while the author is setting up the board. Once a scenario is ready to play-test or export, it declares exactly one space model.

Rationale: these models differ in almost every operation — position representation, movement calculation, range, adjacency. A unified interface would either be uselessly abstract or would force one model's assumptions onto the other.

## 005 — Plotted simultaneous turns as universal time model

All scenarios use plotted simultaneous turns: sides submit orders, then orders resolve. This applies to both tile-based and free-coordinate space models.

Alternative time models (tick-based simulation, event-driven continuous time) are out of scope. They may be explored in a separate project.

Rationale: plotted simultaneous turns are the time model used by the tabletop games this tool is designed to support (SFB, Warhammer 40K, tabletop milsims). Using the same time model regardless of space model keeps the engine's core loop, phase system, and expression language consistent across scenario types.

## 006 — Rules authored as structured data plus expression language

Decision: game rules combine structured data for configuration (parameters, thresholds, enumerations) with a small expression language for logic (conditions, branching, effects).

Rejected alternatives: not embedded scripting (Python, Lua) and not pure structured data without logic.

Rationale: pure structured data fails when mechanics require branching logic or cross-entity state. Embedded scripting makes rules opaque to the editor and uninspectable. The middle ground keeps rules editable and visible in the editor while supporting the complexity of real tactical game mechanics.

## 007 — Browser and standalone binary as export targets

Finished games export to browser-playable bundles and standalone desktop binaries (via Tauri). Both are first-class targets.

## 008 — Scenario files are human-readable

Scenario files must be readable and editable in a plain text editor. The visual editor writes them, but never traps the author. Readability is a hard constraint.

## 009 — Desktop editor is authoritative; browser editor is a constrained support surface

The desktop editor is the authoritative authoring environment.

The browser runtime remains a first-class export target.

The browser editor is kept as a constrained development, testing, review, and demo surface, not as a full parity promise with the desktop editor.

Desktop-only capabilities such as native file handling, project/package management, and export/packaging may remain desktop-first without being blocked on equivalent browser support.

Rationale: the browser editor is valuable for fast iteration, smoke testing, and agent-assisted development, but browser sandbox limits should not drive or narrow the main authoring architecture.

See decision `010` for the sharpened purpose of the browser editor surface.

## 010 — Browser editor is an agent-testing and export-runtime surface

The browser editor is maintained primarily for two purposes:

1. As a compatibility surface that coding agents can drive via headless browser automation (Playwright, WebDriver) to validate editor behavior.
2. As the authoring mirror for the browser runtime export target (decision `007`).

It is not maintained as a human-facing browser authoring tool. Human authoring is desktop-first (decision `009`).

Rationale: reliable agent automation of the Tauri desktop shell — native file dialogs, IPC, OS-level input — is not a cheap path today. The browser is. Naming this purpose explicitly prevents the browser editor from accumulating parity debt and gives clear guidance on when to expand or shrink its feature surface.

Consequences:

- The browser editor should retain the flows agents need to exercise end to end: board creation, marker placement and selection, undo/redo, source editing, save/open through the browser fallback, runtime view, and export. Regressions in these flows are release-blocking.
- Desktop-only capabilities — native file dialogs, package-local asset import, packaging, and any future desktop-first IPC — may remain desktop-only without a browser fallback. Do not add browser approximations unless an agent test or the export runtime genuinely needs them.
- Browser smoke coverage is sized for agent-driven regression catching, not for human feature validation. It should grow when agents need to test new flows and contract when a flow is covered by a better layer (unit tests on pure-logic modules, desktop manual smoke).
- Do not invest in browser-authoring polish or UX for its own sake. Polish that happens to serve agent testability or the export runtime is fine; polish aimed at a hypothetical browser-authoring user is not.
- If native desktop automation ever becomes cheap enough (for example via `tauri-driver` with manageable setup), revisit this decision. Until then, the browser-as-agent-surface is load-bearing.

## 011 — Scenario format: identity, migration, and forward-version policy

Three commitments make the scenario format safe to evolve: identity that survives renaming and merging, a migration registry that upgrades older files on load, and a hard reject on forward-version files rather than silent data loss. Per decision `008`, the format stays human-readable; these contracts are orthogonal to readability.

### Identity model

Pieces have opaque ids, prefixed `piece_` and followed by 6 Crockford base32 characters (the digits plus uppercase letters with `I`, `L`, `O`, and `U` excluded). Ids are generated at piece creation and on `v0 → v1` migration, and are unique within a scenario.

An author-facing `label` is a separate free-form string; labels are not unique and carry no identity weight. Identity and display are decoupled so renaming never breaks references, and opaque ids survive copy, merge, and asset binding without label-coupling bugs.

### Migration registry contract

Scenario files carry an integer `schemaVersion`. The editor upgrades older files through a chain of per-adjacent-version migration steps registered at `apps/editor/src/scenario-migrations/`. Every load path runs the chain: file open, source-editor apply, and draft recovery.

When a migration actually runs, the load reports a `migrated` flag. The editor uses that flag to dirty the in-memory document so the author is prompted to save the upgraded file through the normal save flow. Migrations do not overwrite files on disk as a side effect of loading.

### Forward-version policy

A file whose `schemaVersion` is higher than the current build's `currentSchemaVersion` is hard-rejected with a readable error that names both versions. The editor does not attempt a best-effort read, and it does not silently drop unknown fields on save. A forward-version file almost always contains a field the current build does not understand, and silently dropping it would corrupt the author's work the next time they save.
