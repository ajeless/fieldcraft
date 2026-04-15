# PLAN.md

Mutable planning notes for the next editor slices. This is not a roadmap promise; it is the current working plan for small, manually testable branches.

Settled architectural choices belong in `DECISIONS.md`. Open questions, implementation order, and deferred design space live here until a choice is durable enough to record as a decision.

## Current Focus

Make board authoring credible before expanding into broader editor systems. The current baseline has the first canvas-backed board viewport, palette marker placement, square and pointy-top hex tile geometry, explicit tile board setup fields, browser/desktop file commands, and a read-only runtime view.

Free-coordinate space is now the next architectural pressure point. It is a required project capability, not optional design space, and it should be pulled forward before selection, undo, source editing, assets, export, or rules work harden around tile-only assumptions.

The free-coordinate branch must stay tightly scoped. Pulling it forward means proving the space-model seam in the editor, not absorbing every continuous-space feature. Any free-coordinate follow-on discovered during that branch should be recorded in this file as a later branch candidate or deferred design space instead of expanding the foundation branch.

Current manual testing pressure points are captured in the branch sequence below. If testing finds a trust-blocking editor issue, move that branch up instead of adding a parallel planning document.

## Near-Term Branch Sequence

1. `codex/free-coordinate-space-foundation`
   - Promote free-coordinate space from data-model room to a visible, manually testable editor mode.
   - Add setup UI for no-grid free-coordinate boards with explicit bounds, authored scale, and background.
   - Add a free-coordinate renderer and pointer interaction path through the same viewport model without forcing it through tile geometry.
   - Support simple free-space marker placement and persistence with floating-point positions.
   - Establish coordinate, distance, and 360-degree bearing helpers for later movement, targeting, and rules work.
   - Render free-coordinate boards and placed markers in the runtime view.
   - Keep the scope strict: no plotted orders, movement engine, terrain, zones, snapping/guides, ruler tools, asset imports, large-map virtualization, source editor expansion, export packaging, unit/entity model, or full rules model in this branch.

2. `codex/command-registry`
   - Extract the existing hardcoded command definitions into a small command registry.
   - Make commands addressable by id from the menu bar, sidebar action stack, and keyboard shortcuts.
   - Keep command metadata minimal: id, label, enabled state, handler, and optional shortcut hint.
   - Wire existing commands: new, open, save, and save-as.
   - Handle clipped or overflowing sidebar content gracefully, including long file paths, status lines, and dense metrics.
   - Do not add right-click context menus or native Tauri menus in this branch.

3. `codex/theme-toggle`
   - Add light and dark editor themes using CSS variables.
   - Persist the chosen theme.
   - Default from system preference when no choice exists.

4. `codex/draft-autosave`
   - Add draft recovery autosave for the editor session.
   - Do not silently overwrite scenario files.
   - Keep explicit Save and Save As as the durable file actions.

5. `codex/board-object-selection-inspector`
   - Add marker selection through the canvas viewport coordinate flow across tile and free-coordinate boards.
   - Provide a small inspector for the selected marker.
   - Support marker deletion/removal from the inspector and command model.
   - Preserve marker persistence and runtime read-only rendering.
   - Keep selection independent of rule targeting and richer entity properties until concrete play-test workflows need that connection.

6. `codex/undo-redo`
   - Introduce undo and redo for editor state mutations.
   - Cover board setup, tile marker placement, free-coordinate marker placement, marker deletion, and inspector edits as the first undoable actions.
   - Keep undo history in memory; do not persist it across sessions.
   - Keep file save/load semantics separate from undo history.
   - Wire undo and redo through the command registry and keyboard shortcuts: Ctrl+Z and Ctrl+Shift+Z.

7. `codex/source-editor`
   - Turn the scenario JSON panel into an editable source view.
   - Validate edits before applying them to the visual editor.
   - Provide a safe way to recover from invalid JSON.
   - Apply the same supported board-size and space-model limits to source edits and opened files, or surface unsupported cases explicitly instead of letting scenarios enter a partially supported state.

8. `codex/asset-library-imports`
   - Add the first scenario asset model for imported images.
   - Prefer a project/package asset library with stable relative references over base64-heavy scenario JSON.
   - Start with board background images before token images so temporary markers do not accidentally become the durable asset model.
   - Treat sprite sheets, board tile images, and tile/sprite placement workflows as follow-on pressure after basic image imports.

9. `codex/export-runtime-spike`
   - Define the first browser export path once the runtime has enough behavior to export.
   - Include the implications of bundling referenced scenario assets.
   - Prove export assumptions against both tile-based and free-coordinate scenarios before treating the runtime bundle shape as settled.
   - Keep standalone binary game export out of this branch; prove the browser bundle first.

## Later Branch Candidates

These are not committed near-term order. They hold open design work that should stay out of `DECISIONS.md` until concrete implementation and manual testing settle it.

10. `codex/scenario-format-hardening`
   - Revisit the scenario file shape after source editing, asset references, and export have real pressure.
   - Keep the current JSON format unless another human-readable shape clearly improves authoring, review, or packaging.
   - Make versioning and migration behavior explicit before introducing incompatible scenario-file changes.
   - Define the migration contract in this branch; implement actual migration tooling only for format changes that already exist or split it into a follow-up if it grows beyond the scenario-file hardening slice.

11. `codex/rules-expression-spike`
   - Choose the smallest expression syntax, evaluator shape, and editor UX needed by a concrete scenario.
   - Preserve decision `006`: rules remain structured data plus inspectable expressions, not embedded scripting.
   - Include both tile-distance and free-coordinate distance/bearing needs in the first evaluator shape instead of assuming tile adjacency is the only spatial primitive.
   - Keep the first rule authoring loop visible in the editor.

12. `codex/standalone-runtime-export`
   - Package a finished game as a standalone Tauri binary after the browser export path is working.
   - Reuse the browser runtime/export shape where possible.
   - Add platform-specific packaging incrementally instead of trying to support every target at once.

13. `codex/unit-entity-model`
   - Introduce the first authored game entity model that can grow beyond temporary markers.
   - Capture only the minimum durable fields needed by near-term scenarios: identity, side/owner, board position, type, facing or bearing where the space model needs it, and editable properties.
   - Represent position in a way that respects the active space model instead of treating tile coordinates as universal.
   - Extend the marker selection and inspector model only as needed for real entities; avoid a broad object inspector before entity fields settle.
   - Keep markers as a simple authoring primitive until the entity model earns replacement.

14. `codex/token-styling`
   - Add basic authored token appearance after imported assets have a home in the scenario model.
   - Start with color, shape, label, facing, and optional imported image reference before image-heavy styling.
   - Keep styling data readable and avoid a full asset or sprite editing system in this branch.

15. `codex/rules-authoring-system`
   - Build the first practical rules authoring workflow after `codex/rules-expression-spike` settles syntax and evaluator shape.
   - Add editor panels for attaching rules to entities, phases, or scenario-level hooks as justified by a concrete scenario.
   - Include runtime evaluation and enough debugging/inspection to make authored rules testable in the editor.

## Deferred Design Space

Large boards and map styling:
- support triangle and other tile grids only when a concrete scenario pushes beyond square and hex; the current square/hex work is enough for the initial geometry seam proof
- free-coordinate boards are near-term planned work in `codex/free-coordinate-space-foundation`; keep only follow-on refinements here
- refine authored scale semantics for tiled and free-coordinate boards after the first free-coordinate editor/runtime slice proves the basic model
- add concise setup help or tooltip hints once labels like distance per tile, scale unit, tile size, and free-coordinate bounds need to carry real authoring meaning
- add a live board setup preview that updates the board as setup values change, with clear rules for whether placed objects are preserved or cleared; this becomes relevant once board setup is revisited or an inspector allows post-creation setup edits
- introduce a scenario-level home view only if there is a clear authoring or runtime need to persist view state
- test large-map viewport performance under real authoring pressure, including draw cost, culling, and whether any lazy rendering or tile virtualization is needed
- add terrain concepts only after placement and setup are credible: tile properties, terrain types, movement-cost hooks, and visual terrain styling

Free-coordinate follow-ons:
- add measurement and ruler tools after free-coordinate placement proves the world-coordinate model
- add snapping, guides, bearing widgets, and authored coordinate overlays only after concrete authoring pressure shows which aids matter
- add object facing or bearing editing with the first real entity workflow, not with temporary markers
- add free-space movement, order plotting, and resolution only when the plotted-turn play-test slice needs them
- add continuous-space terrain, zones, obstacles, or movement-cost hooks after basic placement and entity/rules pressure justify them
- keep map imagery, georeferenced backgrounds, and huge continuous-map performance work out of the foundation branch unless they become trust-blocking
- keep persisted camera/home views, exact coordinate entry, board view rotation, and snap angles as later board-view refinements
- treat source-editor and export polish for mixed tile/free-coordinate scenarios as follow-on work unless needed to preserve valid round-trips in the foundation branch

Assets and author media:
- defer a built-in sprite creator until the editor has real asset workflows and authoring pressure justifies it

Command model:
- use the planned `codex/command-registry` branch as the base before adding broader command surfaces
- consider right-click context menus for board objects and empty board space once selection, deletion, and object inspectors exist
- leave native Tauri menus for later after the in-app registry proves itself

Editor layout customization:
- defer draggable/dockable panels until the main panel set stabilizes
- design toward a small container/widget system rather than one-off panel code
- likely concepts: panel registry, layout containers, persisted layouts, and reset-to-default
- avoid turning this into a plugin system until at least two real editor workflows need it

Board view and orientation:
- consider editable exact zoom entry, such as making the zoom label/control accept a percentage, after the basic pan/zoom/reset controls are stable
- add board view rotation controls only after pan, zoom, reset, and placement remain trustworthy across board types
- defer authored hex orientation choice until a concrete scenario needs flat-top; the current setup treats pointy-top as the hardcoded orientation
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
- defer animation tools until board viewport, runtime playback, and scenario rule resolution have more shape
- likely future need: timeline or event-effect authoring that remains data-driven and inspectable by the editor

## Operating Notes

Use this file to choose the next branch, not to bundle multiple branches together. Each branch should leave the editor visibly better and manually testable.

If a manual testing issue blocks trust in the editor, it can jump ahead of this sequence, but record the change here before starting implementation.
