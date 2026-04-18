# PLAN.md

Mutable planning notes for the next editor slices. This is not a roadmap promise; it is the current working plan for small, manually testable branches.

Settled architectural choices belong in `DECISIONS.md`. Open questions, implementation order, and deferred design space live here until a choice is durable enough to record as a decision.

## Current Focus

Keep the editor visibly trustworthy while broader editor systems are still small. Today's baseline covers board setup across square, pointy-top hex, and free-coordinate models; permissive colocated marker placement, selection, and deletion; viewport pan/zoom/reset; browser and desktop file commands with unsaved-change guards; a small command registry for file actions; in-memory undo/redo; persisted `System`/`Light`/`Dark` themes with dark board defaults; draft-recovery autosave; an editable source pane with targeted diagnostics and shared board validation; a read-only in-app runtime view; browser runtime export with bundled assets; the first package-local asset model (desktop image/audio import, board background images, `Save As` carrying assets forward); and the v1 scenario format with opaque piece ids, author-facing labels, and a chained migration registry that upgrades older files on load.

The first asset slice behaves well enough to treat as baseline. Audio import is intentionally storage-only for now; playback wiring waits for a concrete runtime need.

Automation still primarily exercises the browser support surface. Desktop-native behavior remains release-significant even when browser smoke is green, but the manual pass now has a documented preflight and scratch-package workflow in `DESKTOP-TESTING.md`.

## Recently Completed Baseline Slices

- `codex/desktop-release-smoke`
  - The desktop smoke pass is now a concrete, repeatable release checklist rather than a loose reminder.
  - `DESKTOP-TESTING.md` now spells out preflight, scratch workspace layout, fixture assets, suggested filenames, and the order of operations for native file handling, asset import, runtime launch, export, and draft recovery.
  - Root tooling now exposes `corepack pnpm desktop:check` so the Tauri desktop-shell preflight can run without opening the app.

- `codex/object-occupancy-semantics`
  - Tile markers can share a tile, and free-coordinate markers can share authored positions without rounded display precision becoming an occupancy rule.
  - Temporary fan-out/orbit rendering is in place for selection and inspection, not as durable authored position data.

- `codex/source-editor`
  - The scenario JSON panel is an editable source view with apply/reset behavior.
  - Source edits are validated before they replace the visual editor state.
  - Shared board-size and space-model limits apply to source edits and opened files.

- `codex/source-editor-hardening`
  - Duplicate marker ids are rejected in source edits, file-open flows, and draft recovery.
  - Invalid JSON gets line/column targeting and inline error state.
  - Editor-history behavior now lines up with applied source edits.

- `codex/package-assets-image-audio`
  - Desktop editor imports image and audio assets into an `assets/` folder beside the scenario file.
  - Scenarios keep stable relative asset refs; board backgrounds can point at imported images.
  - `Save As` carries package assets forward into the new scenario location.

- `codex/export-runtime-spike`
  - The first browser export path is in place.
  - Referenced scenario assets are bundled into the exported runtime payload.
  - Square, hex, and free-coordinate scenarios round-trip through the export baseline.

- `codex/scenario-format-hardening`
  - Scenario files now split identity from version: `schema: "fieldcraft.scenario"` plus integer `schemaVersion: 1`, with pieces carrying an opaque `id` (6-char Crockford base32, prefixed `piece_`) alongside an optional free-form `label`.
  - Migration registry lives at `apps/editor/src/scenario-migrations/` and runs chained per-adjacent-version upgrades on load (file open, source apply, draft recovery). Forward-version files hard-reject with a readable error.
  - Opening a v0 file migrates in memory, dirties the doc, and saves as v1 through the normal save flow; source-editor line/column diagnostics are preserved through the `ScenarioLoadError` wrapper.
  - Vitest is the new unit-test runner, co-located at `apps/editor/src/**/*.test.ts`; pre/post fixture pairs cover tile, free-coord (with negative positions), and empty scenarios.

Current manual testing pressure points are captured in the branch sequence below. If testing finds a trust-blocking editor issue, move that branch up instead of adding a parallel planning document.

## Near-Term Branch Sequence

1. `codex/asset-library-follow-ons`
   - Add follow-on authoring pressure after the first package asset baseline proves itself in real scenarios.
   - Treat token images, sprite sheets, board tile imagery, and richer media workflows as separate pressure from simple board backgrounds.
   - Keep polish work such as better previewing, error surfacing, and image-fit controls out of this branch unless real use makes them trust-blocking.

2. `codex/rules-expression-spike`
   - Choose the smallest expression syntax, evaluator shape, and editor UX needed by a concrete scenario.
   - Preserve decision `006`: rules remain structured data plus inspectable expressions, not embedded scripting.
   - Include both tile-distance and free-coordinate distance/bearing needs in the first evaluator shape instead of assuming tile adjacency is the only spatial primitive.
   - Keep the first rule authoring loop visible in the editor.

3. `codex/unit-entity-model`
   - Introduce the first authored game entity model that can grow beyond temporary markers.
   - Capture only the minimum durable fields needed by near-term scenarios: identity, side/owner, board position, type, facing or bearing where the space model needs it, and editable properties.
   - Represent position in a way that respects the active space model instead of treating tile coordinates as universal.
   - Build on the earlier occupancy-semantics slice instead of reintroducing one-entity-per-location assumptions for tile or free-coordinate scenarios.
   - Extend the marker selection and inspector model only as needed for real entities; avoid a broad object inspector before entity fields settle.
   - Keep markers as a simple authoring primitive until the entity model earns replacement.

4. `codex/editor-help-overlay`
   - Add a lightweight, discoverable help surface for existing keyboard shortcuts and command affordances.
   - Prefer a single overlay or menu-tooltip pass over a per-surface help scheme.
   - Keep content data-driven so commands added later surface automatically.

5. `codex/token-styling`
   - Add basic authored token appearance after imported assets have a home in the scenario model.
   - Start with color, shape, label, facing, and optional imported image reference before image-heavy styling.
   - Keep styling data readable and avoid a full asset or sprite editing system in this branch.

6. `codex/rules-authoring-system`
   - Build the first practical rules authoring workflow after `codex/rules-expression-spike` settles syntax and evaluator shape.
   - Add editor panels for attaching rules to entities, phases, or scenario-level hooks as justified by a concrete scenario.
   - Include runtime evaluation and enough debugging/inspection to make authored rules testable in the editor.

7. `codex/standalone-runtime-export`
   - Package a finished game as a standalone Tauri binary after the browser export path is working.
   - Reuse the browser runtime/export shape where possible.
   - Add platform-specific packaging incrementally instead of trying to support every target at once.

## Out of Scope

These are actively-rejected directions, not deferred work. Revisit by writing a new entry in `DECISIONS.md`, not by layering them into "Deferred Design Space".

- Tick-based or event-driven time models (see decision `005`).
- Embedded scripting (Python, Lua, etc.) or pure structured-data rules without an expression language (see decision `006`).
- Full browser/desktop editor parity (see decisions `009` and `010`). Browser authoring polish aimed at a hypothetical browser-authoring user is out of scope; the browser editor exists for agent testing and as the export-runtime mirror.
- Server-hosted or multiplayer game hosting driving current editor architecture.
- An editor plugin system before at least two real editor workflows justify it.

## Deferred Design Space

Open design work that should stay out of `DECISIONS.md` until concrete implementation and manual testing settle it. Prune this list when a slice closes an item or when the motivation fades.

### Boards, space, and scale

- Triangle and other tile grids only when a concrete scenario pushes beyond square and hex.
- Authored scale semantics for tiled and free-coordinate boards once the first free-coordinate runtime slice proves the model.
- How marker/token visual size relates to board/world scale, authored units, and token/entity configuration (foundation markers currently use viewport-friendly temporary sizing).
- How stacked tile objects should render once temporary orbit/fan-out selection aids are no longer enough: true authored overlap plus cycling, stack inspection, list selection, or hover fan-out.
- Whether token placement validity uses center point only or full footprint; free-coordinate edge placements can intentionally or unintentionally hang outside bounds.
- Practical minimum dimensions and initial zoom behavior for very small free-coordinate boards if placement gets finicky.
- A scenario-level home view, only if authoring or runtime use needs persisted view state.
- Large-map viewport performance: draw cost, culling, lazy rendering, tile virtualization.
- Terrain concepts (tile properties, terrain types, movement-cost hooks, visual terrain) only after placement and setup are credible.

### Board setup polish

- Concise setup help or tooltip hints once labels like distance-per-tile, scale unit, tile size, and free-coordinate bounds need to carry real authoring meaning (candidate content for `codex/editor-help-overlay`).
- Inline board setup validation with field-local range messages and invalid draft values kept visible.
- A live board setup preview that updates as setup values change, with clear rules for preserving or clearing placed objects.

### Free-coordinate follow-ons

- Measurement and ruler tools after free-coordinate placement proves the world-coordinate model.
- Snapping, guides, bearing widgets, and authored coordinate overlays only after authoring pressure shows which aids matter.
- Clearer origin/bounds semantics in the UI (what top-left `x`/`y` means relative to `width`/`height`) before relying on offset free-coordinate maps.
- Visualizing coincident or near-coincident free-coordinate objects without treating rounded display precision as physical occupancy.
- Object facing/bearing editing with the first real entity workflow, not with temporary markers.
- Free-space movement, order plotting, and resolution only when the plotted-turn play-test slice needs them.
- Continuous-space terrain, zones, obstacles, and movement-cost hooks after basic placement and entity/rules pressure justify them.
- Map imagery, georeferenced backgrounds, and huge continuous-map performance work only when trust-blocking.
- Persisted camera/home views, exact coordinate entry, board view rotation, snap angles — later refinements.
- Additional source-editor and export polish for free-coordinate scenarios unless needed to preserve valid round-trips.

### Assets and author media

- A built-in sprite creator, relevant after the first package asset baseline has real scenario pressure.
- Audio playback wiring (import is storage-only today); pair with a concrete runtime workflow.
- Asset licensing/attribution metadata once bundled-export scenarios ship third-party media.

### Scenario source and packaging

- Keep the current inline scenario source editor until real scenario/package complexity proves it insufficient; avoid jumping to a file-browser workflow prematurely.
- Revisit whether large authored object/entity data should stay inline in one human-readable scenario file or move into referenced package files, after the asset-library, entity-model, and export slices create concrete pressure.
- If authored source outgrows the inline pane: move toward a small project/file browser plus a dedicated text editor with syntax highlighting, validation, and file-level recovery, rather than layering expectations onto a bare textarea.
- Scenario workspace conventions (one scenario per folder, repo layout, asset bundle boundaries) as authoring patterns settle.

### Command model

- Use the command-registry slice as the base before adding broader command surfaces.
- Revisit the top command bar with a small, durable icon set after the command surfaces settle; keep tooltips, shortcut hints, and clarity stronger than pure icon minimalism.
- Right-click context menus for board objects and empty board space once selection, deletion, and object inspectors exist.
- Native Tauri menus only after the in-app registry proves itself.

### Selection and board editing

- Marquee or drag selection for tokens and other board objects once multi-object authoring pressure is real.
- Pair multi-selection with bulk move operations rather than treating drag selection as an isolated gesture-only feature.

### Editor layout customization

- Draggable/dockable panels only after the main panel set stabilizes through selection, source editing, and inspector work.
- Design toward a small container/widget system rather than one-off panel code; likely concepts: panel registry, layout containers, persisted layouts, reset-to-default.

### Board view and orientation

- Editable exact zoom entry (percentage control) after basic pan/zoom/reset is stable.
- Board view rotation only after pan/zoom/reset/placement remain trustworthy across board types.
- Authored hex orientation choice only when a concrete scenario needs flat-top.
- Snap angles and persisted view/orientation state only when manual testing shows authoring value.

### Turns, phases, and play-testing

- Implement the plotted simultaneous turn structure from decision `005` when a concrete scenario needs orders and resolution.
- Define phase data, order submission UI, and resolution sequencing before rules depend on them heavily.
- Evolve the runtime from read-only display to play-test interaction (orders, movement, targeting, feedback) in small scenario-driven slices.

### Export and packaging

- Packaged binary distribution of the editor itself is future work beyond repo-based development.
- Keep future network play possible, but do not let it drive current editor architecture.

### Animation authoring

- In-game animation matters for digital board game feel (weapon fire, torpedoes, movement previews, resolution effects).
- Animation tools wait for board viewport, runtime playback, and scenario rule resolution to have more shape.
- Likely future need: timeline or event-effect authoring that stays data-driven and inspectable.

### Cross-cutting

- Performance budgets (marker count, board size, rule count) tied to "manually testable" expectations.
- Accessibility: dark-theme contrast, canvas semantics for assistive tech, keyboard-only authoring paths.
- Bundled sample scenarios for new authors, once the entity model and rules language give samples meaningful shape.

## Operating Notes

Use this file to choose the next branch, not to bundle multiple branches together. Each branch should leave the editor visibly better and manually testable.

If a manual testing issue blocks trust in the editor, it can jump ahead of the sequence, but record the change here before starting implementation.
