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
