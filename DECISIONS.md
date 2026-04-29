# DECISIONS.md

Settled decisions that should not be relitigated without explicit discussion.

Mutable plans, open design questions, and implementation sequencing belong in `PLAN.md`.

## 001 — Editor-first, not engine-first

The editor is the product. The engine exists to serve the editor and the authored experiences it produces. Features that don't surface in the editor aren't ready to build.

Under v1 scope (`docs/EDITOR-V1-SCOPE.md`), the runtime-bearing engine is deferred and the exported surface is a viewer. The editor-first commitment remains: authoring value comes before runtime ambition.

## 002 — Tauri + TypeScript

The desktop editor uses Tauri as its shell. All application logic — engine, editor UI, rules interpreter — is TypeScript. Rust is used only where Tauri's backend requires it.

Rationale: TypeScript gives a single language across editor, engine, and browser export. Maximizes iteration speed and eliminates serialization boundaries between editor and engine.

Under v1 scope, this means the editor and browser viewer stay TypeScript-first. Engine and rules-interpreter work remains deferred, not moved to another stack.

## 003 — pnpm as package manager

Using pnpm for dependency management. Fast, strict, clean lockfile diffs, fully compatible with Tauri's build pipeline.

## 004 — Two distinct space models

Tile-based space (hex, quad, and potentially other tessellations with integer coordinates, discrete neighbor relationships) and free-coordinate space (floating-point positions, 360-degree bearing, continuous distance) are separate spatial models. They are not unified behind a single abstraction.

A scenario declares which space model it uses. The editor, viewer, and any future engine or rules language adapt accordingly.

Draft scenarios in the editor may temporarily have no configured space model while the author is setting up the board. Once a scenario is ready to present or export, it declares exactly one space model.

Rationale: these models differ in almost every operation — position representation, movement calculation, range, adjacency. A unified interface would either be uselessly abstract or would force one model's assumptions onto the other.

## 005 — (Withdrawn) Plotted simultaneous turns as universal time model

> **Status:** Withdrawn under v1 scope (Pitch A — see `docs/EDITOR-V1-SCOPE.md`). The runtime is a viewer, not a gameplay engine; no time model is enforced. The text below is preserved as historical context for the original vision.

All scenarios use plotted simultaneous turns: sides submit orders, then orders resolve. This applies to both tile-based and free-coordinate space models.

Alternative time models (tick-based simulation, event-driven continuous time) are out of scope. They may be explored in a separate project.

Rationale: plotted simultaneous turns are the time model used by the tabletop games this tool is designed to support (SFB, Warhammer 40K, tabletop milsims). Using the same time model regardless of space model keeps the engine's core loop, phase system, and expression language consistent across scenario types.

## 006 — Rules authored as structured data plus expression language

> **Status:** In force as a future architecture constraint, but deferred beyond v1. Fieldcraft v1 does not evaluate rules.

Decision: game rules combine structured data for configuration (parameters, thresholds, enumerations) with a small expression language for logic (conditions, branching, effects).

Rejected alternatives: not embedded scripting (Python, Lua) and not pure structured data without logic.

Rationale: pure structured data fails when mechanics require branching logic or cross-entity state. Embedded scripting makes rules opaque to the editor and uninspectable. The middle ground keeps rules editable and visible in the editor while supporting the complexity of real tactical game mechanics.

## 007 — Browser viewer export is the only export target

The editor exports a browser-playable bundle that renders the authored scenario as a viewer (presentation/projection use, per `docs/EDITOR-V1-SCOPE.md`). This is the only export target for v1.

The standalone Tauri binary export was previously planned as a second target. It is dropped from v1 scope and moved to "Out of Scope" in `PLAN.md`. Revisiting requires a new decision, not an amendment to this one.

Rationale: under Pitch A, exported scenarios are consumed by viewers, not gameplay engines. A standalone binary adds packaging surface without serving the viewer use case any better than a browser bundle does.

## 008 — Scenario files are human-readable

Scenario files must be readable and editable in a plain text editor. The visual editor writes them, but never traps the author. Readability is a hard constraint.

## 009 — Desktop editor is authoritative; browser editor is a constrained support surface

The desktop editor is the authoritative authoring environment.

The browser runtime/viewer remains a first-class export target.

The browser editor is kept as a constrained development, testing, review, and demo surface, not as a full parity promise with the desktop editor.

Desktop-only capabilities such as native file handling, project/package management, and export/packaging may remain desktop-first without being blocked on equivalent browser support.

Rationale: the browser editor is valuable for fast iteration, smoke testing, and agent-assisted development, but browser sandbox limits should not drive or narrow the main authoring architecture.

See decision `010` for the sharpened purpose of the browser editor surface.

## 010 — Browser editor is an agent-testing and export-runtime surface

The browser editor is maintained primarily for two purposes:

1. As a compatibility surface that coding agents can drive via headless browser automation (Playwright, WebDriver) to validate editor behavior.
2. As the authoring mirror for the browser runtime/viewer export target (decision `007`).

Under v1 scope (`docs/EDITOR-V1-SCOPE.md`), the browser surface also serves as the presentation-mode renderer for the viewer export — the same renderer that authors use to project or screen-share authored scenarios. This is not a third purpose; it is the export-runtime mirror, named explicitly because the framing has shifted from "runtime" to "viewer" under Pitch A.

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

## 012 — Editor information architecture

The editor is organized around a named UI vocabulary so that new features register into existing surfaces instead of stacking into the right column. Six structural commitments define that vocabulary:

- **Four-tab inspector.** The right column is a single docked panel with four peer tabs — Scenario, Selection, Assets, Source. Each tab has a distinct scope: scenario-wide state, per-selection detail, asset picking, and power-user source. Selection auto-promotes to active when something is selected.
- **Tool rail on the left.** A vertical rail holds icon-only tool buttons. Tools register into the rail; the rail's position on the left is load-bearing.
- **Bottom asset strip.** A horizontal strip below the board shows asset thumbnails. It filters contextually to the active tool and is collapsible.
- **Status bar at the bottom.** A thin bottom strip surfaces structured OS-style fields — cursor position, active tool, space model, selection count, piece and asset counts, dirty state, and save-shortcut hint. It replaces status-as-sidebar-item.
- **Command palette.** `⌘K` / `Ctrl+K` opens a fuzzy-searchable overlay over the existing command registry. It is a discoverability layer over the menu bar and command bar, not a replacement for either.
- **Full-page New Scenario flow.** New scenarios begin on a dedicated page presenting the three space-model choices (square, pointy-top hex, free-coordinate) with miniature board previews, followed by scenario details. The same form is reachable post-creation as an Edit Board Setup modal, so setup stops being a one-way door.

Rationale: the editor grew feature-first, and each new feature accreted into the right column because there was no UI vocabulary — no Inspector, no ToolRail, no StatusBar — for features to register into. This decision names that vocabulary so future branches plug into named surfaces instead of stacking.

`docs/redesign/BRIEF.md` is the implementation spec for shape, pixel dimensions, tab contents, and interaction patterns. Specific values there (tab labels, widths, contextual filter behaviors) are tactical; this decision records the architectural shape.

Out of scope for this decision, and reserved for later entries when their branches ship: coordinate-label stage rulers, and any floating or collapsible inspector variant beyond the docked baseline.

## 013 — Scenario sides and piece ownership

Scenarios may define author-facing sides at the scenario level. A side has an opaque `side_` id, a free-form label, and a color. Pieces refer to sides by optional `sideId`; an absent `sideId` means unassigned/neutral.

This is a scenario-format v3 commitment. The v2 placeholder field `side: "neutral"` is removed by the `v2 → v3` migration, which adds an empty `sides` array and clears any legacy side data from pieces. Removing a side in the editor clears matching `sideId` references on pieces rather than deleting pieces or preserving dangling references.

Rationale: sides are scenario authorship data, not gameplay control or rules behavior. They let authors express ownership, faction, or role now while preserving v1's no-engine boundary. The optional reference keeps neutral markers simple and keeps the scenario file readable.
