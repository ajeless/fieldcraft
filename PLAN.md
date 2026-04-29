# PLAN.md

Mutable planning notes for the next editor slices. This is not a roadmap promise; it is the current working plan for small, manually testable branches.

Settled architectural choices belong in `DECISIONS.md`. Open questions, implementation order, and deferred design space live here until a choice is durable enough to record as a decision.

## Current Focus

V1 is committed in `docs/EDITOR-V1-SCOPE.md`: Fieldcraft is a map-and-scenario editor for tabletop wargames, and the runtime export is a viewer rather than a gameplay engine. Today's baseline covers explicit scenario creation and post-creation board setup edits across square, pointy-top hex, and free-coordinate models; permissive marker placement, selection, deletion, and colocation; viewport pan/zoom/reset; browser and desktop file commands with unsaved-change guards; a command registry for file, board, and editor actions with a searchable command palette; in-memory undo/redo; persisted `System`/`Light`/`Dark` themes with dark board defaults; draft-recovery autosave; an editable source pane with targeted diagnostics and shared board validation; the decision `012` editor vocabulary with a four-tab inspector, bottom status bar, bottom asset strip, full-page New Scenario flow, command palette, and left tool rail with Select/Marker tools plus Ruler/Hand placeholders; scenario-level author-defined sides managed in the Scenario tab and assigned from the Selection tab; authored marker facing, visual style, and typed descriptive properties edited from the Selection tab and rendered or round-tripped in the editor/viewer; a read-only in-app runtime/viewer surface; a chrome-light browser runtime/viewer export with bundled assets, fullscreen, reset/zoom/pan controls, a collapsed scenario info panel, and parity for authored v1 display data; the first package-local asset model (desktop image/audio import, board background images, marker image artwork, asset strip visibility and contextual image filtering when Marker is armed, `Save As` carrying assets forward); three self-contained v1 example scenario packages covering square, pointy-top hex, and free-coordinate models; the v6 scenario format with opaque piece ids, author-facing labels, optional marker image refs, scenario-level sides, optional piece `sideId` refs, per-piece `facingDegrees`, per-piece `style`, per-piece typed `properties`, and a chained migration registry that upgrades older files on load; and an automated desktop-semantic smoke pass for the Tauri dev shell.

The v1 branch sequence is complete. Future work should be driven by manual testing, real scenario-authoring pressure, or an explicit v1.x scope update rather than by extending the closed v1 sequence.

The original `codex/unit-entity-model` branch is split for v1 and its v1 portions have shipped: sides, facing, token styling, and piece properties. Rules, turn resolution, and standalone runtime packaging are deferred or out of scope under v1.

Automation now covers both the browser support surface and a scripted desktop-semantic pass in the Tauri dev shell. Native desktop dialogs and packaged-build sanity remain release-significant manual checks even when both automated suites are green; the residual human-only pass lives in `DESKTOP-TESTING.md`.

## Recently Completed Baseline Slices

- `codex/v1-documentation`
  - Public-facing docs now point to the v1 baseline, example scenarios, and the historical status of runtime terminology.
  - `docs/V1-RELEASE-NOTES.md` records the concise v1 capability set, non-goals, scenario format summary, and verification bar.
  - `docs/EDITOR-V1-SCOPE.md` marks the final documentation branch as shipped and links the release notes into the document relationship map.

- `codex/v1-example-scenarios`
  - `examples/v1/` now contains three self-contained scenario packages: square-grid bridgehead, pointy-top hex ridgeline, and free-coordinate convoy layouts.
  - The examples exercise package-local image and audio assets, board backgrounds where useful, sides, facing, marker styling, marker image artwork, descriptive properties, and stacked/continuous placement shapes.
  - A unit test loads every committed v1 example through the migration-aware scenario loader and verifies referenced package-local assets exist.

- `codex/viewer-export-polish`
  - The browser export now opens as a presentation viewer: the board fills the viewport, scenario metadata is collapsed behind an info control, and fullscreen, reset, zoom, and pan remain available as compact viewer affordances.
  - Exported marker rendering now matches the editor for v1 display data: image-backed and default markers use authored shape, color, and facing, and the export exposes style/facing state to smoke tests.
  - The exported info panel summarizes board metadata, sides, piece labels, side assignments, facing, style, image usage, and descriptive properties without making the viewer an authoring surface or rules runtime.
  - Decision `017` records the exported viewer posture.

- `codex/piece-properties`
  - Pieces now carry ordered typed `properties` arrays with per-piece unique keys and text, number, or boolean values.
  - The Selection tab can add, edit, type-convert, and remove marker properties without evaluating them as rules.
  - Scenarios moved to `schemaVersion: 6`; the v5 migration initializes existing pieces with `properties: []`.
  - Browser smoke covers property editing and source round-trip.

- `codex/token-styling`
  - Pieces now carry explicit visual `style` data with shape, fill color, and stroke color; scenarios moved to `schemaVersion: 5` with a v4 migration that preserves the old default marker look.
  - The Selection tab edits marker shape and colors without requiring imported art.
  - The shared editor/viewer canvas renderer applies style to default markers and to image-backed marker clipping/frames.
  - Browser smoke covers style editing, rendered board state, and source round-trip.

- `codex/piece-facing`
  - Pieces now carry authored `facingDegrees` and scenarios moved to `schemaVersion: 4`; the v3 migration initializes existing pieces to `0`.
  - The Selection tab exposes facing as a direct range/number control, and editor/viewer canvas rendering shows a direction arrow on default and image-backed markers.
  - Facing remains presentation data only: no movement plotting, firing arcs, line-of-sight, turn resolution, or rules evaluation.
  - Browser smoke covers facing edit, rendered board state, and source round-trip.

- `codex/sides-and-entity-base`
  - Scenarios now carry author-defined sides with opaque `side_` ids, labels, and colors, while pieces use optional `sideId` references for ownership.
  - The Scenario tab manages sides; the Selection tab assigns the selected marker to a side or leaves it unassigned.
  - Scenario files moved to `schemaVersion: 3`; the v2 migration adds `sides: []` and removes the old `side: "neutral"` placeholder from pieces.
  - Browser smoke covers side creation, side assignment, and source round-trip.

- `codex/tool-rail`
  - The editor now uses the left 44px tool rail from decision `012`, with first-class Select and Marker tools plus disabled Ruler and Hand placeholders for visible vocabulary.
  - The legacy visible editor left sidebar is retired; scenario-wide state lives in the Scenario tab and structured state remains in the bottom status bar.
  - Armed tool state now drives status-bar tool reporting and contextual asset-strip filtering: arming Marker filters the strip to image assets, while placement returns to Select for inspection.
  - Browser smoke covers the rail-backed marker placement path and asset-strip behavior.

- `codex/command-palette`
  - `Ctrl+K` / `Cmd+K` now opens a searchable command palette backed by the existing command registry.
  - The palette shows current shortcuts, keeps disabled commands visible as unavailable, supports keyboard navigation, and executes enabled commands without replacing the menu bar or command bar.
  - Browser smoke covers palette discovery and command execution; desktop smoke remains green.

- `codex/new-scenario-page`
  - Scenario creation now uses a full-page chooser with square, pointy-top hex, and free-coordinate cards, miniature board previews, and scenario details instead of the old dashed setup form.
  - Board setup is editable after creation from the Board menu and Scenario tab's Space section; edits preserve existing pieces and package assets while staying undoable.
  - Browser smoke now covers the new page and both edit entry points, and desktop smoke remains green.

- `codex/asset-strip`
  - Package assets are now visible as a first-class bottom strip below the board, with pinned-first ordering, image/audio cards, collapse behavior, and an Import card at the end.
  - The Assets inspector tab now acts as a contextual picker for selected marker artwork while the strip carries the package asset library view; browser and desktop smoke cover the new strip surface.
  - Desktop imports remain reachable from a new unsaved scenario: clicking Import first asks where to save the scenario, then continues into the native asset import dialog.

- `codex/status-bar`
  - Status moved out of the left sidebar into a 22px bottom strip per decision `012` / `docs/redesign/BRIEF.md`, with structured fields for cursor, tool, space model, selection count, counts, the ephemeral status message, and the save hint.
  - The old sidebar `createStatusSection` is retired; the left-sidebar metrics intentionally remain duplicated with the Scenario tab until `codex/tool-rail` finishes that rewrite.
  - Dirty state now surfaces as an amber dot in the menu bar while the bottom status bar keeps the existing ephemeral `statusMessage` strings and smoke-test `status-line` contract intact.

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
  - `corepack pnpm test:desktop:smoke` now runs a scripted Tauri dev-shell pass that covers save/open semantics, package-local asset import and copying, `Save As` asset carry-forward, viewer launch, browser viewer export, and draft-recovery behavior.
  - The desktop automation seam is intentionally narrow and test-only: canned dialog responses and file paths are injected only when the desktop smoke script launches the app with an explicit automation spec.
  - `DESKTOP-TESTING.md` is now the residual human-only checklist for native dialog presentation and packaged-build sanity, rather than a full manual regression sweep.

- `codex/asset-library-follow-ons`
  - Imported image assets now have a second concrete authored use beyond board backgrounds: markers can reference image assets through the selection inspector and render that artwork in the editor board and the browser viewer.
  - The browser support surface now resolves scenario asset refs when the paths are reachable from the app URL, which keeps marker-art and background-art scenarios testable without inventing browser-only import flows.
  - Scenario files moved to `schemaVersion: 2` so the new marker image ref field is migration-aware instead of being silently droppable by older builds.

- `codex/desktop-release-smoke`
  - The desktop smoke pass is now a concrete, repeatable release checklist rather than a loose reminder.
  - `DESKTOP-TESTING.md` now spells out preflight, scratch workspace layout, fixture assets, suggested filenames, and the order of operations for native file handling, asset import, viewer launch, export, and draft recovery.
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

There is no active near-term branch sequence after v1. If a manual testing issue blocks trust in the editor, it can jump ahead of exploratory work, but record the change here before starting implementation.

## Out of Scope

These are actively-rejected directions, not deferred work. Revisit by writing a new entry in `DECISIONS.md`, not by layering them into "Deferred Design Space".

- Runtime time-model work, including tick-based, event-driven, and plotted-turn resolution. Decision `005` is withdrawn under v1 scope; Fieldcraft v1 does not resolve play.
- Embedded scripting (Python, Lua, etc.) or pure structured-data rules without an expression language (see decision `006`).
- `codex/standalone-runtime-export`: standalone binary export of finished games is dropped from v1 by `docs/EDITOR-V1-SCOPE.md` and decision `007`. Under Pitch A, exported scenarios are browser viewer bundles, not packaged gameplay binaries; revisiting requires a new decision.
- Full browser/desktop editor parity (see decisions `009` and `010`). Browser authoring polish aimed at a hypothetical browser-authoring user is out of scope; the browser editor exists for agent testing and as the export-runtime mirror.
- Server-hosted or multiplayer game hosting driving current editor architecture.
- An editor plugin system before at least two real editor workflows justify it.

## Deferred Design Space

Open design work that should stay out of `DECISIONS.md` until concrete implementation and manual testing settle it. Prune this list when a slice closes an item or when the motivation fades.

### Boards, space, and scale

- Triangle and other tile grids only when a concrete scenario pushes beyond square and hex.
- Authored scale semantics for tiled and free-coordinate boards once v1 examples show which labels and measurements authors actually need.
- How marker/token visual size relates to board/world scale, authored units, and token/entity configuration (foundation markers currently use viewport-friendly temporary sizing).
- How stacked tile objects should render once temporary orbit/fan-out selection aids are no longer enough: true authored overlap plus cycling, stack inspection, list selection, or hover fan-out.
- Whether token placement validity uses center point only or full footprint; free-coordinate edge placements can intentionally or unintentionally hang outside bounds.
- Practical minimum dimensions and initial zoom behavior for very small free-coordinate boards if placement gets finicky.
- A scenario-level home view, only if authoring or viewer use needs persisted view state.
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
- Free-space movement, order plotting, and resolution are deferred beyond v1 with the other runtime-bearing work.
- Continuous-space terrain, zones, obstacles, and movement-cost hooks after basic placement and scenario-authoring pressure justify them.
- Map imagery, georeferenced backgrounds, and huge continuous-map performance work only when trust-blocking.
- Persisted camera/home views, exact coordinate entry, board view rotation, snap angles — later refinements.
- Additional source-editor and export polish for free-coordinate scenarios unless needed to preserve valid round-trips.

### Assets and author media

- Sprite-sheet region authoring after single-image marker art proves the asset-reference shape and a concrete scenario needs sub-image addressing.
- Board tile imagery after a concrete scenario needs per-cell art rather than full-board backgrounds plus marker artwork.
- A built-in sprite creator, relevant after the first package asset baseline has real scenario pressure.
- Audio playback wiring (import is storage-only today); pair with a concrete viewer or authoring workflow.
- Asset licensing/attribution metadata once bundled viewer-export scenarios ship third-party media.
- Surface board-background clear affordance next to the Scenario tab's Board Background row. Today Set Background is available from the asset strip, but authors who read scenario-wide state from the Scenario tab still do not see a way to clear it there.

### Scenario source and packaging

- Keep the current inline scenario source editor until real scenario/package complexity proves it insufficient; avoid jumping to a file-browser workflow prematurely.
- Revisit whether large authored object/entity data should stay inline in one human-readable scenario file or move into referenced package files, after the asset-library, entity-model, and export slices create concrete pressure.
- If authored source outgrows the inline pane: move toward a small project/file browser plus a dedicated text editor with syntax highlighting, validation, and file-level recovery, rather than layering expectations onto a bare textarea.
- Scenario workspace conventions (one scenario per folder, repo layout, asset bundle boundaries) as authoring patterns settle.
- Scenario-level metadata beyond title — author, version, brief, scenario notes, designer's notes — is deferred beyond v1 per `docs/EDITOR-V1-SCOPE.md` §6. Add it when examples or real authored packages need it, not as upfront form surface.

### Command model

- Use the command-registry slice as the base before adding broader command surfaces.
- Revisit the top command bar with a small, durable icon set after the command surfaces settle; keep tooltips, shortcut hints, and clarity stronger than pure icon minimalism.
- Right-click context menus for board objects and empty board space once selection, deletion, and object inspectors exist.
- Native Tauri menus only after the in-app registry proves itself.

### Selection and board editing

- Direct drag-to-reposition for placed markers and future tokens on both tile and free-coordinate boards. Today placement happens by dragging from the palette onto the board, but an already-placed marker cannot be moved with the mouse; only source edits or delete-and-replace work. Should respect the active space model (tile snap vs. continuous) and integrate with undo/redo.
- Multi-select and group operations are deferred beyond v1 per `docs/EDITOR-V1-SCOPE.md` §6. When they return, pair selection, bulk editing, and bulk move semantics instead of treating marquee selection as an isolated gesture.
- Copy/paste of pieces is deferred beyond v1. It should wait until sides, facing, styling, properties, and asset references have stable duplication semantics.
- Text annotations on the board — non-piece labels, notes, arrows, and callouts — are deferred beyond v1. The first v1 piece-property and viewer work should not grow into a general annotation layer.

### Layers and ordering

- Layers and explicit z-order controls are deferred beyond v1 per `docs/EDITOR-V1-SCOPE.md` §6. Revisit when real scenarios need overlapping map objects, annotations, or terrain strata that cannot be handled by insertion order and simple selection aids.

### Editor layout customization

- Draggable/dockable panels only after the main panel set stabilizes through selection, source editing, and inspector work.
- Design toward a small container/widget system rather than one-off panel code; likely concepts: panel registry, layout containers, persisted layouts, reset-to-default.

### Board view and orientation

- Editable exact zoom entry (percentage control) after basic pan/zoom/reset is stable.
- Board view rotation only after pan/zoom/reset/placement remain trustworthy across board types.
- Authored hex orientation choice only when a concrete scenario needs flat-top.
- Snap angles and persisted view/orientation state only when manual testing shows authoring value.

### Turns, phases, and play-testing

- `codex/rules-expression-spike` is deferred under v1 scope. Pitch A (`docs/EDITOR-V1-SCOPE.md`) does not have the editor resolve rules; revisit only if a future runtime-bearing scope is adopted.
- `codex/rules-authoring-system` is deferred for the same reason. A rules authoring UI depends on a runtime that evaluates rules, which v1 explicitly does not build.
- Turn resolution, order plotting, phase data, and runtime play-test interaction are deferred beyond v1. Decision `005` is withdrawn, so no universal time model is enforced while Fieldcraft is a scenario editor plus viewer.

### Export and packaging

- Packaged binary distribution of the editor itself is future work beyond repo-based development.
- Printable map output — PDF, high-resolution PNG, print tiling, crop marks, or print-safe styling — is deferred beyond v1 per `docs/EDITOR-V1-SCOPE.md` §6.
- Keep future network play possible as a later scope shift, but do not let it drive current editor architecture.

### Desktop automation

- Full end-to-end desktop automation, including real native dialog interaction, OS-level window/input control, and packaged-binary coverage, once the tool stack is practical enough (`tauri-driver` or equivalent plus any required OS automation helpers).
- Keep the current scripted desktop-semantic smoke as the intermediate layer until the true end-to-end path is cheap and reliable.

### Animation authoring

- Presentation animation may matter for future viewer polish or a later runtime-bearing scope.
- Animation tools wait for board viewport, viewer playback needs, and any future rule-resolution scope to have more shape.
- Likely future need: timeline or event-effect authoring that stays data-driven and inspectable.

### Editor session and reload

- Reloading the editor with a clean (saved, unmodified) scenario currently drops back to the Board Setup screen instead of restoring the open scenario. Session-draft recovery only fires when `dirty` is true, and the remembered file path alone is not enough to rehydrate the scenario; on clean reloads the editor boots from an empty scenario. Expected: if a scenario is open and current, reload should restore it regardless of dirty state. Not caused by `codex/inspector-tabbed-rewrite` — lurking behavior surfaced during its manual testing.

### Cross-cutting

- Performance budgets (marker count, board size, rule count) tied to "manually testable" expectations.
- Accessibility: dark-theme contrast, canvas semantics for assistive tech, keyboard-only authoring paths.
- Additional bundled sample scenario libraries beyond the one to three v1 examples, once real authoring use shows what examples are missing.

## Operating Notes

Use this file to choose the next branch, not to bundle multiple branches together. Each branch should leave the editor visibly better and manually testable.

If a manual testing issue blocks trust in the editor, it can jump ahead of the sequence, but record the change here before starting implementation.
