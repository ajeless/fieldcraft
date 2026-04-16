# PLAN.md

Mutable planning notes for the next editor slices. This is not a roadmap promise; it is the current working plan for small, manually testable branches.

Settled architectural choices belong in `DECISIONS.md`. Open questions, implementation order, and deferred design space live here until a choice is durable enough to record as a decision.

## Current Focus

Keep the editor visibly trustworthy while broader editor systems are still small. The current baseline now includes square, pointy-top hex, and free-coordinate board setup; marker placement and persistence; shared viewport pan/zoom/reset; browser and desktop file commands; a small in-app command registry for file actions; unsaved-change confirmation before destructive `New` and `Open` flows replace dirty work; persisted `System`/`Light`/`Dark` theme support; dark-theme board defaults for new boards; draft recovery autosave; marker selection through the canvas viewport; a small marker inspector; keyboard and inspector deletion for selected markers; in-memory undo/redo for editor mutations; and a read-only runtime view.

Manual testing and review now point to command-surface cleanup, occupancy semantics, and source editing as the next pressure. Undo landed cleanly on top of the command-registry seam, but it also made command placement and redundant inspector affordances feel more trust-blocking: core document actions, contextual tools, and destructive controls are sharing unstable sidebar space and shifting around as board state changes. A small command-surface branch now makes more sense before validation and occupancy follow-ons, while occupancy semantics still need to land before source editing and the first real entity model so the editor does not harden around a false one-object-per-location assumption.

Current manual testing pressure points are captured in the branch sequence below. If testing finds a trust-blocking editor issue, move that branch up instead of adding a parallel planning document.

## Near-Term Branch Sequence

1. `codex/editor-command-surfaces`
   - Move core document commands such as undo, redo, new, open, save, and save-as into a stable top command bar instead of stacking large buttons inside the scenario sidebar.
   - Keep contextual tools visually separate from document commands, with a stable palette/tool slot so board creation and marker-selection state do not shift unrelated controls around.
   - Replace redundant selection affordances such as the separate read-only marker `Id` metric plus editable `Marker ID` field with one clear editing surface.
   - Compact destructive selection actions into a smaller affordance that still reads clearly and preserves keyboard deletion.
   - Preserve current keyboard paths, keep Ctrl/Cmd+Shift+Z redo support, and accept Ctrl+Y as a Windows/Linux redo alias if that does not complicate platform-specific shortcut hints.
   - Do not broaden this branch into right-click context menus, drag-selection, or a general editor layout system redesign.

2. `codex/validation-unification`
   - Share board-size and tile-size validation predicates between editor setup and scenario-file loading.
   - Keep supported limits identical across visual setup, opened files, and future source edits.
   - Accept the intentional behavior change that oversized tile-grid scenarios now fail validation instead of entering unsupported editor states.
   - Add focused negative coverage only if it keeps the smoke path readable.

3. `codex/object-occupancy-semantics`
   - Allow tile-based markers to share the same tile instead of treating one tile as one object slot.
   - Do not treat rounded free-coordinate values as a collision or deduplication rule; stored precision is for readable authoring, not occupancy semantics.
   - Keep the marker model permissive and editor-first; do not encode game-rule legality for stacking or proximity yet.
   - Add the minimum editor/runtime rendering and selection behavior needed to inspect and delete colocated markers without reopening a broad entity-system design.

4. `codex/source-editor`
   - Turn the scenario JSON panel into an editable source view.
   - Validate edits before applying them to the visual editor.
   - Provide a safe way to recover from invalid JSON.
   - Apply the same supported board-size and space-model limits to source edits and opened files, or surface unsupported cases explicitly instead of letting scenarios enter a partially supported state.
   - Preserve occupancy semantics established for tile and free-coordinate markers instead of reintroducing one-object-per-location assumptions in source edits.

5. `codex/asset-library-imports`
   - Add the first scenario asset model for imported images.
   - Prefer a project/package asset library with stable relative references over base64-heavy scenario JSON.
   - Start with board background images before token images so temporary markers do not accidentally become the durable asset model.
   - Treat sprite sheets, board tile images, and tile/sprite placement workflows as follow-on pressure after basic image imports.

6. `codex/export-runtime-spike`
   - Define the first browser export path once the runtime has enough behavior to export.
   - Include the implications of bundling referenced scenario assets.
   - Prove export assumptions against both tile-based and free-coordinate scenarios before treating the runtime bundle shape as settled.
   - Keep standalone binary game export out of this branch; prove the browser bundle first.

## Later Branch Candidates

These are not committed near-term order. They hold open design work that should stay out of `DECISIONS.md` until concrete implementation and manual testing settle it.

7. `codex/scenario-format-hardening`
   - Revisit the scenario file shape after source editing, asset references, and export have real pressure.
   - Keep the current JSON format unless another human-readable shape clearly improves authoring, review, or packaging.
   - Make versioning and migration behavior explicit before introducing incompatible scenario-file changes.
   - Define the migration contract in this branch; implement actual migration tooling only for format changes that already exist or split it into a follow-up if it grows beyond the scenario-file hardening slice.

8. `codex/rules-expression-spike`
   - Choose the smallest expression syntax, evaluator shape, and editor UX needed by a concrete scenario.
   - Preserve decision `006`: rules remain structured data plus inspectable expressions, not embedded scripting.
   - Include both tile-distance and free-coordinate distance/bearing needs in the first evaluator shape instead of assuming tile adjacency is the only spatial primitive.
   - Keep the first rule authoring loop visible in the editor.

9. `codex/standalone-runtime-export`
   - Package a finished game as a standalone Tauri binary after the browser export path is working.
   - Reuse the browser runtime/export shape where possible.
   - Add platform-specific packaging incrementally instead of trying to support every target at once.

10. `codex/unit-entity-model`
   - Introduce the first authored game entity model that can grow beyond temporary markers.
   - Capture only the minimum durable fields needed by near-term scenarios: identity, side/owner, board position, type, facing or bearing where the space model needs it, and editable properties.
   - Represent position in a way that respects the active space model instead of treating tile coordinates as universal.
   - Build on the earlier occupancy-semantics slice instead of reintroducing one-entity-per-location assumptions for tile or free-coordinate scenarios.
   - Extend the marker selection and inspector model only as needed for real entities; avoid a broad object inspector before entity fields settle.
   - Keep markers as a simple authoring primitive until the entity model earns replacement.

11. `codex/token-styling`
   - Add basic authored token appearance after imported assets have a home in the scenario model.
   - Start with color, shape, label, facing, and optional imported image reference before image-heavy styling.
   - Keep styling data readable and avoid a full asset or sprite editing system in this branch.

12. `codex/rules-authoring-system`
   - Build the first practical rules authoring workflow after `codex/rules-expression-spike` settles syntax and evaluator shape.
   - Add editor panels for attaching rules to entities, phases, or scenario-level hooks as justified by a concrete scenario.
   - Include runtime evaluation and enough debugging/inspection to make authored rules testable in the editor.

## Deferred Design Space

Large boards and map styling:
- support triangle and other tile grids only when a concrete scenario pushes beyond square and hex; the current square/hex work is enough for the initial geometry seam proof
- free-coordinate boards now have a foundation slice; keep only follow-on refinements here
- refine authored scale semantics for tiled and free-coordinate boards after the first free-coordinate editor/runtime slice proves the basic model
- decide how marker/token visual size relates to board/world scale, authored units, and eventual token/entity configuration; the foundation marker currently uses viewport-friendly temporary sizing, not durable physical scale
- decide how stacked tile objects should render and how authors disambiguate selection, cycling, or list-based inspection once multiple colocated objects become common
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
- decide how coincident or near-coincident free-coordinate objects should be visualized and disambiguated in the editor without treating rounded display precision as physical occupancy
- add object facing or bearing editing with the first real entity workflow, not with temporary markers
- add free-space movement, order plotting, and resolution only when the plotted-turn play-test slice needs them
- add continuous-space terrain, zones, obstacles, or movement-cost hooks after basic placement and entity/rules pressure justify them
- keep map imagery, georeferenced backgrounds, and huge continuous-map performance work out of the foundation branch unless they become trust-blocking
- keep persisted camera/home views, exact coordinate entry, board view rotation, and snap angles as later board-view refinements
- treat additional source-editor and export polish for free-coordinate scenarios as follow-on work unless needed to preserve valid round-trips in the foundation branch

Assets and author media:
- a built-in sprite creator becomes relevant after `codex/asset-library-imports` proves the basic asset model and authoring pressure justifies it

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
