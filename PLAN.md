# PLAN.md

Mutable planning notes for the next editor slices. This is not a roadmap promise; it is the current working plan for small, manually testable branches.

Settled architectural choices belong in `DECISIONS.md`. Open questions, implementation order, and deferred design space live here until a choice is durable enough to record as a decision.

## Current Focus

Keep the editor visibly trustworthy while broader editor systems are still small. The current baseline now includes square, pointy-top hex, and free-coordinate board setup; permissive colocated marker placement and selection for both tile and free-coordinate boards; shared viewport pan/zoom/reset; browser and desktop file commands; a small in-app command registry for file actions; unsaved-change confirmation before destructive `New` and `Open` flows replace dirty work; persisted `System`/`Light`/`Dark` theme support; dark-theme board defaults for new boards; draft recovery autosave; marker selection through the canvas viewport; a small marker inspector; keyboard and inspector deletion for selected markers; in-memory undo/redo for editor mutations; a stable top command bar for document actions; a stable contextual tool slot with the marker palette disabled instead of shifting layout before board creation; one clear `Marker ID` editing surface; compact destructive selection affordances; consistent `Ctrl/Cmd+Shift+Z` redo plus `Ctrl+Y` on Windows/Linux; an editable source pane with apply/reset, line-and-column JSON diagnostics, duplicate marker-id rejection, and shared board validation; a read-only in-app runtime view; browser runtime export with bundled scenario assets; and the first package-local scenario asset model with desktop image/audio imports plus board background image assignment.

The first asset slice now behaves well enough to treat as baseline: imported files are copied into an `assets/` folder beside the scenario file, scenarios keep stable relative asset refs, board backgrounds can point at imported image assets, browser runtime export bundles referenced assets, and `Save As` carries package assets forward into the new scenario location. Audio import is intentionally storage-only in this slice; playback wiring stays out until a concrete runtime workflow needs it.

Automation still primarily exercises the browser support surface. Desktop-native file, import, and packaging behavior remains a manual testing pressure point and should be treated as release-significant even when browser smoke is green.

## Recently Completed Baseline Slices

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

- `codex/export-runtime-spike`
  - The first browser export path is in place.
  - Referenced scenario assets are bundled into the exported runtime payload.
  - Square, hex, and free-coordinate scenarios round-trip through the export baseline.

Current manual testing pressure points are captured in the branch sequence below. If testing finds a trust-blocking editor issue, move that branch up instead of adding a parallel planning document.

## Near-Term Branch Sequence

1. `codex/scenario-format-hardening`
   - Revisit the scenario file shape after source editing, asset references, and export have real pressure.
   - Keep the current JSON format unless another human-readable shape clearly improves authoring, review, or packaging.
   - Separate durable object identity from author-facing labels before coordinate-derived ids like `marker-x-y` calcify into the long-term scenario format.
   - Choose an identity convention that stays readable in JSON while remaining stable across moves, stacking, and future object types; likely direction is opaque internal ids plus editable display labels, not type/location-encoded names.
   - Make versioning and migration behavior explicit before introducing incompatible scenario-file changes.
   - Define the migration contract in this branch; implement actual migration tooling only for format changes that already exist or split it into a follow-up if it grows beyond the scenario-file hardening slice.

2. `codex/asset-library-follow-ons`
   - Add follow-on authoring pressure after the first package asset baseline proves itself in real scenarios.
   - Treat token images, sprite sheets, board tile imagery, and richer media workflows as separate pressure from simple board backgrounds.
   - Keep polish work such as better previewing, error surfacing, and image-fit controls out of this branch unless real use makes them trust-blocking.

3. `codex/rules-expression-spike`
   - Choose the smallest expression syntax, evaluator shape, and editor UX needed by a concrete scenario.
   - Preserve decision `006`: rules remain structured data plus inspectable expressions, not embedded scripting.
   - Include both tile-distance and free-coordinate distance/bearing needs in the first evaluator shape instead of assuming tile adjacency is the only spatial primitive.
   - Keep the first rule authoring loop visible in the editor.

4. `codex/unit-entity-model`
   - Introduce the first authored game entity model that can grow beyond temporary markers.
   - Capture only the minimum durable fields needed by near-term scenarios: identity, side/owner, board position, type, facing or bearing where the space model needs it, and editable properties.
   - Represent position in a way that respects the active space model instead of treating tile coordinates as universal.
   - Build on the earlier occupancy-semantics slice instead of reintroducing one-entity-per-location assumptions for tile or free-coordinate scenarios.
   - Extend the marker selection and inspector model only as needed for real entities; avoid a broad object inspector before entity fields settle.
   - Keep markers as a simple authoring primitive until the entity model earns replacement.

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

## Later Branch Candidates

These are not committed near-term order. They hold open design work that should stay out of `DECISIONS.md` until concrete implementation and manual testing settle it.

## Deferred Design Space

Large boards and map styling:
- support triangle and other tile grids only when a concrete scenario pushes beyond square and hex; the current square/hex work is enough for the initial geometry seam proof
- free-coordinate boards now have a foundation slice; keep only follow-on refinements here
- refine authored scale semantics for tiled and free-coordinate boards after the first free-coordinate editor/runtime slice proves the basic model
- decide how marker/token visual size relates to board/world scale, authored units, and eventual token/entity configuration; the foundation marker currently uses viewport-friendly temporary sizing, not durable physical scale
- decide how stacked tile objects should render once temporary orbit/fan-out selection aids are no longer enough; long-term authoring likely needs true authored overlap plus a clear disambiguation path such as cycling, stack inspection, list/browser selection, or hover fan-out
- decide whether token placement validity is based on center point only or on the full token footprint; manual testing showed edge placements can intentionally or unintentionally hang outside free-coordinate board bounds
- add concise setup help or tooltip hints once labels like distance per tile, scale unit, tile size, and free-coordinate bounds need to carry real authoring meaning
- add inline board setup validation once setup grows past the first slice: keep invalid draft values visible, mark invalid fields, and show field-local range messages instead of relying only on the status line
- add a live board setup preview that updates the board as setup values change, with clear rules for whether placed objects are preserved or cleared; this becomes relevant once board setup is revisited or an inspector allows post-creation setup edits
- define practical minimum board dimensions and initial zoom behavior for very small free-coordinate boards if manual testing shows placement becomes too finicky
- introduce a scenario-level home view only if there is a clear authoring or runtime need to persist view state
- test large-map viewport performance under real authoring pressure, including draw cost, culling, and whether any lazy rendering or tile virtualization is needed
- add terrain concepts only after placement and setup are credible: tile properties, terrain types, movement-cost hooks, and visual terrain styling

Free-coordinate follow-ons:
- add measurement and ruler tools after free-coordinate placement proves the world-coordinate model
- add snapping, guides, bearing widgets, and authored coordinate overlays only after concrete authoring pressure shows which aids matter
- clarify origin/bounds semantics in the UI, including what top-left `x`/`y` means relative to `width`/`height`, before relying on offset free-coordinate maps in author workflows
- decide how coincident or near-coincident free-coordinate objects should be visualized and disambiguated in the editor without treating rounded display precision as physical occupancy; authored visual position should stay faithful even if selection needs a separate affordance
- add object facing or bearing editing with the first real entity workflow, not with temporary markers
- add free-space movement, order plotting, and resolution only when the plotted-turn play-test slice needs them
- add continuous-space terrain, zones, obstacles, or movement-cost hooks after basic placement and entity/rules pressure justify them
- keep map imagery, georeferenced backgrounds, and huge continuous-map performance work out of the foundation branch unless they become trust-blocking
- keep persisted camera/home views, exact coordinate entry, board view rotation, and snap angles as later board-view refinements
- treat additional source-editor and export polish for free-coordinate scenarios as follow-on work unless needed to preserve valid round-trips in the foundation branch

Assets and author media:
- a built-in sprite creator becomes relevant after the first package asset baseline proves itself under real scenario pressure

Scenario source and packaging:
- keep the current scenario source editor inline until real scenario/package complexity proves it is no longer enough; avoid jumping to a file-browser workflow before authored data actually becomes unwieldy
- revisit whether large authored object/entity data should stay inline in one human-readable scenario file or move into referenced package files only after the asset-library, entity-model, and export slices create concrete pressure
- if authored source outgrows the current inline pane, move toward a small project/file browser plus a dedicated text editor with syntax highlighting, validation, and file-level recovery instead of layering those expectations onto a bare textarea forever

Command model:
- use the command-registry slice as the base before adding broader command surfaces
- revisit the top command bar with a small, durable icon set after the command surfaces settle; keep tooltips, shortcut hints, and clarity stronger than pure icon minimalism
- consider right-click context menus for board objects and empty board space once selection, deletion, and object inspectors exist
- leave native Tauri menus for later after the in-app registry proves itself

Selection and board editing:
- add marquee or drag selection for tokens and other board objects once multi-object authoring pressure is real
- pair multi-selection with bulk move operations on the board instead of treating drag selection as an isolated gesture-only feature

Editor layout customization:
- draggable/dockable panels become relevant after the main panel set stabilizes through selection, source editing, and inspector work
- design toward a small container/widget system rather than one-off panel code
- likely concepts: panel registry, layout containers, persisted layouts, and reset-to-default
- avoid turning this into a plugin system until at least two real editor workflows need it

Board view and orientation:
- consider editable exact zoom entry, such as making the zoom label/control accept a percentage, after the basic pan/zoom/reset controls are stable
- add board view rotation controls only after pan, zoom, reset, and placement remain trustworthy across board types
- authored hex orientation choice waits for a concrete scenario that needs flat-top; the current setup treats pointy-top as the hardcoded orientation
- consider snap angles and persisted view/orientation state only when manual testing shows authoring value

Turns, phases, and play-testing:
- implement the plotted simultaneous turn structure from decision `005` when a concrete scenario needs orders and resolution
- define phase data, order submission UI, and resolution sequencing before rules depend on them heavily
- evolve the runtime from read-only display to play-test interaction, including orders, movement, targeting, and feedback, in small scenario-driven slices

Export, packaging, and network play:
- packaged binary distribution of the editor itself is also future work beyond repo-based development
- server-hosted and multiplayer games are intentionally later work
- keep future network play possible, but do not let it drive the current editor architecture

Animation authoring:
- in-game animation is important for digital board game feel, such as weapon fire, torpedoes, movement previews, and resolution effects
- animation tools wait for board viewport, runtime playback, and scenario rule resolution to have more shape
- likely future need: timeline or event-effect authoring that remains data-driven and inspectable by the editor

## Operating Notes

Use this file to choose the next branch, not to bundle multiple branches together. Each branch should leave the editor visibly better and manually testable.

If a manual testing issue blocks trust in the editor, it can jump ahead of this sequence, but record the change here before starting implementation.
