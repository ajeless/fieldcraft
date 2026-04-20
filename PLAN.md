# PLAN.md

Mutable planning notes for the next editor slices. This is not a roadmap promise; it is the current working plan for small, manually testable branches.

Settled architectural choices belong in `DECISIONS.md`. Open questions, implementation order, and deferred design space live here until a choice is durable enough to record as a decision.

## Current Focus

Keep the editor visibly trustworthy while broader editor systems are still small. Today's baseline covers board setup across square, pointy-top hex, and free-coordinate models; permissive colocated marker placement, selection, and deletion; viewport pan/zoom/reset; browser and desktop file commands with unsaved-change guards; a small command registry for file actions; in-memory undo/redo; persisted `System`/`Light`/`Dark` themes with dark board defaults; draft-recovery autosave; an editable source pane with targeted diagnostics and shared board validation; a read-only in-app runtime view; browser runtime export with bundled assets; the first package-local asset model (desktop image/audio import, board background images, marker image artwork, `Save As` carrying assets forward); the v2 scenario format with opaque piece ids, author-facing labels, optional marker image refs, and a chained migration registry that upgrades older files on load; and an automated desktop-semantic smoke pass for the Tauri dev shell.

The first asset slice behaves well enough to treat as baseline. Audio import is intentionally storage-only for now; playback wiring waits for a concrete runtime need.

Automation now covers both the browser support surface and a scripted desktop-semantic pass in the Tauri dev shell. Native desktop dialogs and packaged-build sanity remain release-significant manual checks even when both automated suites are green; the residual human-only pass lives in `DESKTOP-TESTING.md`.

## Recently Completed Baseline Slices

- `codex/inspector-tabbed-rewrite`
  - The right column is now a single docked panel with four peer tabs — Scenario, Selection, Assets, Source — replacing the previous vertical stack of sections per decision `012`.
  - The Scenario tab mirrors scenario-wide state (Title, Space, Contents, File) with Board Background surfaced as a Contents metric; the Selection tab auto-promotes when a marker is selected from the Scenario tab, while explicit navigation to Source or Assets is never yanked away.
  - Selection, Assets, and Source reuse the existing inspector renderers wholesale — source-editor line/column diagnostics, Apply/Reset, draft state, and Tab-key indent behavior are preserved verbatim.
  - The left sidebar, Board Setup modal, contextual asset picker, author-defined sides, and floating/collapsible inspector variants are deliberately out of scope for this branch and tracked against later branches.
  - Browser and desktop smoke helpers now switch tabs before interacting with tab-scoped content, and two new tab-behavior steps cover auto-promotion on selection and Source tab persistence after Apply.

- PR #16 — audit mechanical fixes and scenario-format decision
  - Applied the mechanical follow-ups from `docs/doc-audit-2026-04.md`: refreshed `README.md`'s Current Baseline against shipped capabilities, added the redesign docs to `README.md`'s Docs list, moved the redesign-docs bullet into `AGENTS.md`'s Docs section, normalized `DESKTOP-TESTING.md`'s tmpdir phrasing, and pruned stray reference-bundle assets.
  - Added decision `011` capturing scenario format v2's identity model (opaque `piece_` ids with author-facing `label`), migration registry contract, and forward-version hard-reject policy; cross-referenced it from `AGENTS.md`'s Architecture guardrails.
  - Pinned the redesign reference bundle revision in `docs/redesign/BRIEF.md` so future design iterations signal when they supersede the bundle.

- `codex/design-tokens-foundation`
  - The editor's color, font, radius, and shadow values live in a typed `apps/editor/src/design-tokens.ts` module that exposes `darkTokens`, `lightTokens`, and `applyTokensToRoot(theme)`; `styles.css` now consumes only `--fc-*` CSS custom properties written to `:root` at runtime.
  - Token values follow `docs/redesign/reference/components/tokens.jsx` (OKLCH accents, reference chrome/board values), which shifts new-scenario default grid and background colors for both themes toward the redesign reference while preserving the `fieldcraft:theme` preference key and theme-switch behavior.
  - `main.ts` reads themed board-setup draft defaults from the token module and drops the local `darkThemeBoardDefaults`/`getThemeBoardDefaults` helpers; `board-viewport.ts` now reads `--fc-board-bg`, `--fc-board-grid`, `--fc-marker*`, etc. from computed styles.

- `codex/readme-workflow-clarity`
  - `README.md` now explains the repo in workflow terms instead of assuming familiarity with Tauri and Vite conventions.
  - The main development paths are now explicit: desktop dev shell, packaged debug desktop binary, release-style desktop build, and browser checks.
  - Setup and test guidance now explains why each command exists so community contributors can choose the right path without reverse-engineering the toolchain.

- `codex/desktop-debug-launch-clarity`
  - Manual packaged-debug desktop checks now have a single launcher: `corepack pnpm desktop:debug` rebuilds the standalone Tauri debug binary before starting it.
  - Desktop docs now call out that `apps/editor/src-tauri/target/debug/fieldcraft` is reused by dev flows, so a stale dev artifact can fail with `Could not connect to 127.0.0.1: Connection refused`.
  - The manual desktop checklist now points testers at the wrapper command instead of assuming the raw binary path is always safe to run.
- `codex/desktop-semantic-smoke-automation`
  - `corepack pnpm test:desktop:smoke` now runs a scripted Tauri dev-shell pass that covers save/open semantics, package-local asset import and copying, `Save As` asset carry-forward, runtime launch, browser-runtime export, and draft-recovery behavior.
  - The desktop automation seam is intentionally narrow and test-only: canned dialog responses and file paths are injected only when the desktop smoke script launches the app with an explicit automation spec.
  - `DESKTOP-TESTING.md` is now the residual human-only checklist for native dialog presentation and packaged-build sanity, rather than a full manual regression sweep.

- `codex/asset-library-follow-ons`
  - Imported image assets now have a second concrete authored use beyond board backgrounds: markers can reference image assets through the selection inspector and render that artwork in the editor board and the browser runtime.
  - The browser support surface now resolves scenario asset refs when the paths are reachable from the app URL, which keeps marker-art and background-art scenarios testable without inventing browser-only import flows.
  - Scenario files moved to `schemaVersion: 2` so the new marker image ref field is migration-aware instead of being silently droppable by older builds.

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

Current manual testing pressure points are captured in the branch sequence below. The near-term sequence finishes the decision `012` UI vocabulary first — status bar, asset strip, new scenario page, command palette, then the tool rail pending feedback from those four — before opening the rules-expression spike. Rationale: rules-spike has no hard dependency on the redesign (it can ship source-editor-only per decision `008` and the `AGENTS.md` bootstrap exception), but landing the spike against stable named surfaces means its eventual authoring UI (in `codex/rules-authoring-system`) plugs into finished vocabulary instead of chasing churn. The entity model and downstream feature branches follow. If testing finds a trust-blocking editor issue, move that branch up instead of adding a parallel planning document.

## Near-Term Branch Sequence

1. `codex/status-bar`
   - Promote the status line from a sidebar item to a thin bottom strip carrying structured fields — cursor position, active tool, space model, selection count, piece/asset counts, dirty state, save-shortcut hint.
   - Move the dirty indicator to a dot in the menu bar and retire the old sidebar status item.
   - Begins retiring the left-sidebar duplication introduced by `codex/inspector-tabbed-rewrite` (the Scenario tab mirrors the left-sidebar metrics today; the `TODO(codex/status-bar)` in `createEditorView` points here).
   - Not in scope: inventing new status semantics beyond what the current status surface already exposes.

2. `codex/asset-strip`
   - Add the bottom asset strip below the board with pinned-first thumbnail ordering and an Import drop card at the end.
   - Filter contextually — for example, auto-filter to image assets when the Marker tool is armed. If the tool-armed state does not yet exist, ship the strip's base behavior now and add the contextual filter when `codex/tool-rail` lands.
   - Remove the redundant Assets section from the inspector once the strip is primary; the Assets tab remains as the per-selection picker.

3. `codex/new-scenario-page`
   - Replace the in-viewport dashed-border setup form with a full-page chooser: three space-model cards (square, pointy-top hex, free-coordinate) with miniature board previews, followed by scenario details.
   - Ship the same fields as an Edit Board Setup modal reachable post-creation from the Board menu and the Scenario tab's Space section, closing the one-way-door problem.
   - Not in scope: full modal polish beyond what it takes to make post-creation edits safe and reversible.

4. `codex/command-palette`
   - Wire `⌘K` / `Ctrl+K` to a fuzzy-searchable overlay over the existing command registry.
   - Treat the palette as a discoverability layer alongside the menu bar and command bar — not a replacement for either.
   - Subsumes the previously-planned `codex/editor-help-overlay`: shortcut and command discoverability is handled here instead of in a parallel help surface.

5. `codex/tool-rail` *(placeholder — shape settled after #1–4 land)*
   - Introduce the left-side 44px vertical tool rail from decision `012` and BRIEF.md §3. Register today's tools (Select, Marker) as first-class entries; ghost placeholders for Ruler and Hand until those features ship.
   - Formalize the "armed tool" state that `codex/asset-strip` relies on for its contextual filter.
   - Finish retiring the legacy left sidebar by the end of this branch (whatever status-bar / asset-strip / new-scenario-page did not already absorb).
   - Intentionally deferred behind the first four redesign branches per BRIEF.md: the rail's shape benefits from feedback on the docked inspector, status bar, asset strip, and new-scenario flow before being locked in.

6. `codex/rules-expression-spike`
   - Choose the smallest expression syntax, evaluator shape, and editor UX needed by a concrete scenario.
   - Preserve decision `006`: rules remain structured data plus inspectable expressions, not embedded scripting.
   - Include both tile-distance and free-coordinate distance/bearing needs in the first evaluator shape instead of assuming tile adjacency is the only spatial primitive.
   - Keep the first rule authoring loop visible in the editor; source-editor-only is an acceptable MVP per the `AGENTS.md` bootstrap exception, with the authoring UI following in `codex/rules-authoring-system`.

7. `codex/unit-entity-model`
   - Introduce the first authored game entity model that can grow beyond temporary markers.
   - Capture only the minimum durable fields needed by near-term scenarios: identity, side/owner, board position, type, facing or bearing where the space model needs it, and editable properties.
   - Represent position in a way that respects the active space model instead of treating tile coordinates as universal.
   - Land author-defined sides at the scenario level alongside this work per BRIEF.md; the format change (`schemaVersion: 3`) and its own decision entry belong with the entity model, not with the editor-IA decision `012`.
   - Build on the earlier occupancy-semantics slice instead of reintroducing one-entity-per-location assumptions for tile or free-coordinate scenarios.
   - Extend the marker selection and inspector model only as needed for real entities; avoid a broad object inspector before entity fields settle.
   - Keep markers as a simple authoring primitive until the entity model earns replacement.

8. `codex/token-styling`
   - Add basic authored token appearance after imported assets have a home in the scenario model.
   - Start with color, shape, label, facing, and optional imported image reference before image-heavy styling.
   - Slot new styling controls into the Selection tab introduced by `codex/inspector-tabbed-rewrite`; avoid regrowing the old right-column stack.
   - Keep styling data readable and avoid a full asset or sprite editing system in this branch.

9. `codex/rules-authoring-system`
   - Build the first practical rules authoring workflow after `codex/rules-expression-spike` settles syntax and evaluator shape.
   - Add editor panels for attaching rules to entities, phases, or scenario-level hooks as justified by a concrete scenario.
   - Include runtime evaluation and enough debugging/inspection to make authored rules testable in the editor.

10. `codex/standalone-runtime-export`
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

- Concise setup help or tooltip hints once labels like distance-per-tile, scale unit, tile size, and free-coordinate bounds need to carry real authoring meaning.
- Inline board setup validation with field-local range messages and invalid draft values kept visible.

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

- Sprite-sheet region authoring after single-image marker art proves the asset-reference shape and a concrete scenario needs sub-image addressing.
- Board tile imagery after a concrete scenario needs per-cell art rather than full-board backgrounds plus marker artwork.
- A built-in sprite creator, relevant after the first package asset baseline has real scenario pressure.
- Audio playback wiring (import is storage-only today); pair with a concrete runtime workflow.
- Asset licensing/attribution metadata once bundled-export scenarios ship third-party media.
- Surface board-background change/clear affordances next to the Scenario tab's Board Background row. Today Clear Background and Set Background live only in the Assets tab, so authors who read scenario-wide state from the Scenario tab do not see a way to modify it there. Likely lands with `codex/asset-strip` or `codex/new-scenario-page` rather than as its own branch.

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

- Direct drag-to-reposition for placed markers and future tokens on both tile and free-coordinate boards. Today placement happens by dragging from the palette onto the board, but an already-placed marker cannot be moved with the mouse; only source edits or delete-and-replace work. Should respect the active space model (tile snap vs. continuous) and integrate with undo/redo.
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

### Desktop automation

- Full end-to-end desktop automation, including real native dialog interaction, OS-level window/input control, and packaged-binary coverage, once the tool stack is practical enough (`tauri-driver` or equivalent plus any required OS automation helpers).
- Keep the current scripted desktop-semantic smoke as the intermediate layer until the true end-to-end path is cheap and reliable.

### Animation authoring

- In-game animation matters for digital board game feel (weapon fire, torpedoes, movement previews, resolution effects).
- Animation tools wait for board viewport, runtime playback, and scenario rule resolution to have more shape.
- Likely future need: timeline or event-effect authoring that stays data-driven and inspectable.

### Editor session and reload

- Reloading the editor with a clean (saved, unmodified) scenario currently drops back to the Board Setup screen instead of restoring the open scenario. Session-draft recovery only fires when `dirty` is true, and the remembered file path alone is not enough to rehydrate the scenario; on clean reloads the editor boots from an empty scenario. Expected: if a scenario is open and current, reload should restore it regardless of dirty state. Not caused by `codex/inspector-tabbed-rewrite` — lurking behavior surfaced during its manual testing.

### Cross-cutting

- Performance budgets (marker count, board size, rule count) tied to "manually testable" expectations.
- Accessibility: dark-theme contrast, canvas semantics for assistive tech, keyboard-only authoring paths.
- Bundled sample scenarios for new authors, once the entity model and rules language give samples meaningful shape.

## Operating Notes

Use this file to choose the next branch, not to bundle multiple branches together. Each branch should leave the editor visibly better and manually testable.

If a manual testing issue blocks trust in the editor, it can jump ahead of the sequence, but record the change here before starting implementation.
