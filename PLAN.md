# PLAN.md

Mutable planning notes for the next editor slices. This is not a roadmap promise; it is the current working plan for small, manually testable branches.

Settled architectural choices belong in `DECISIONS.md`. Open questions, implementation order, and deferred design space live here until a choice is durable enough to record as a decision.

## Current Focus

Make board authoring credible before expanding into broader editor systems. The branch sequence first stabilizes the canvas viewport and board placement workflow, then asks whether the grid-geometry seam holds up for a second tile geometry before setup UI hardens around square-grid assumptions.

Current manual testing pressure points are captured in the branch sequence below. If testing finds a trust-blocking editor issue, move that branch up instead of adding a parallel planning document.

## Near-Term Branch Sequence

1. `codex/board-viewport-layout`
   - Improve the editor workspace so it uses maximized windows.
   - Introduce a canvas-backed board surface so empty tiles are no longer individual DOM controls.
   - Fix dense square-grid rendering, including the 64 x 64 line issue, through the new viewport rather than by raising limits around the old renderer.
   - Introduce the first board viewport model: pan, zoom, rotation-ready transforms, reset view, stable sizing, and room for large maps.
   - Establish renderer-independent coordinate flow: screen point to viewport point to board/world point to tile coordinate.
   - Keep the scope strict: canvas grid/background surface, simple marker interaction, no asset system, no animation system, and no full renderer framework.

2. `codex/token-palette-placement`
   - Replace plain left-click marker creation with selection or no-op behavior until selectable board objects exist.
   - Add a small temporary palette/sidebar widget with the default marker used by the early editor experiment.
   - Support dragging that marker onto the canvas-backed board through the viewport coordinate flow.
   - Preserve current marker persistence in scenario JSON.
   - Keep the scope strict: no asset library, imported media, token styling system, selection inspector, or broader drag-and-drop framework.

3. `codex/hex-grid-proof`
   - Add a minimal hex tile geometry implementation before broader board setup work.
   - Render a basic hex grid through the same canvas-backed viewport used by square grids.
   - Prove hit-testing and marker placement on hex centers using model-based pointer math and the palette placement workflow, not SVG or DOM tile targets.
   - Keep the branch focused on making hex first-class in the geometry seam; defer full hex rules, movement, terrain, styling, and setup polish.

4. `codex/space-and-scale-setup`
   - Extend board setup toward explicit space configuration rather than only square-grid dimensions.
   - Make square grid and hex grid explicit author-facing setup choices.
   - Add data-model room for free-coordinate bounds, authored scale, tile size, grid line color, grid line opacity, and board background.
   - Acknowledge that hex orientation is hardcoded as pointy-top. Defer authored orientation choice until a concrete scenario needs flat-top, but do not confuse view rotation with board orientation when that work arrives.
   - Keep the first UI small; the goal is to establish the shape without implementing every grid type or rule mechanic.

5. `codex/editor-menu-bar`
   - Add a File-style in-app menu bar that works in browser and desktop.
   - Wire existing file commands first: New, Open, Save, and Save As or Download JSON.
   - Keep runtime navigation owned by the existing Editor and Runtime mode switch.
   - Leave native Tauri menus as a later refinement after the command model is clearer.

6. `codex/command-registry`
   - Extract the existing hardcoded command definitions into a small command registry.
   - Make commands addressable by id from the menu bar, sidebar action stack, and keyboard shortcuts.
   - Keep command metadata minimal: id, label, enabled state, handler, and optional shortcut hint.
   - Wire existing commands: new, open, save, and save-as.
   - Handle clipped or overflowing sidebar content gracefully, including long file paths, status lines, and dense metrics.
   - Do not add right-click context menus or native Tauri menus in this branch.

7. `codex/theme-toggle`
   - Add light and dark editor themes using CSS variables.
   - Persist the chosen theme.
   - Default from system preference when no choice exists.

8. `codex/draft-autosave`
   - Add draft recovery autosave for the editor session.
   - Do not silently overwrite scenario files.
   - Keep explicit Save and Save As as the durable file actions.

9. `codex/board-object-selection-inspector`
   - Add marker selection through the canvas viewport coordinate flow.
   - Provide a small inspector for the selected marker.
   - Support marker deletion/removal from the inspector and command model.
   - Preserve marker persistence and runtime read-only rendering.
   - Keep selection independent of rule targeting and richer entity properties until concrete play-test workflows need that connection.

10. `codex/undo-redo`
   - Introduce undo and redo for editor state mutations.
   - Cover board setup, marker placement, marker deletion, and inspector edits as the first undoable actions.
   - Keep undo history in memory; do not persist it across sessions.
   - Keep file save/load semantics separate from undo history.
   - Wire undo and redo through the command registry and keyboard shortcuts: Ctrl+Z and Ctrl+Shift+Z.

11. `codex/source-editor`
   - Turn the scenario JSON panel into an editable source view.
   - Validate edits before applying them to the visual editor.
   - Provide a safe way to recover from invalid JSON.

12. `codex/asset-library-imports`
   - Add the first scenario asset model for imported images.
   - Prefer a project/package asset library with stable relative references over base64-heavy scenario JSON.
   - Start with board backgrounds or token images before broader sprite/tile workflows.
   - Treat sprite sheets, board tile images, and tile/sprite placement workflows as follow-on pressure after basic image imports.

13. `codex/export-runtime-spike`
   - Define the first browser export path once the runtime has enough behavior to export.
   - Include the implications of bundling referenced scenario assets.
   - Keep standalone binary game export out of this branch; prove the browser bundle first.

## Later Branch Candidates

These are not committed near-term order. They hold open design work that should stay out of `DECISIONS.md` until concrete implementation and manual testing settle it.

14. `codex/scenario-format-hardening`
   - Revisit the scenario file shape after source editing, asset references, and export have real pressure.
   - Keep the current JSON format unless another human-readable shape clearly improves authoring, review, or packaging.
   - Make versioning and migration behavior explicit before introducing incompatible scenario-file changes.
   - Define the migration contract in this branch; implement actual migration tooling only for format changes that already exist or split it into a follow-up if it grows beyond the scenario-file hardening slice.

15. `codex/rules-expression-spike`
   - Choose the smallest expression syntax, evaluator shape, and editor UX needed by a concrete scenario.
   - Preserve decision `006`: rules remain structured data plus inspectable expressions, not embedded scripting.
   - Keep the first rule authoring loop visible in the editor.

16. `codex/standalone-runtime-export`
   - Package a finished game as a standalone Tauri binary after the browser export path is working.
   - Reuse the browser runtime/export shape where possible.
   - Add platform-specific packaging incrementally instead of trying to support every target at once.

17. `codex/unit-entity-model`
   - Introduce the first authored game entity model that can grow beyond temporary markers.
   - Capture only the minimum durable fields needed by near-term scenarios: identity, side/owner, board position, type, and editable properties.
   - Extend the marker selection and inspector model only as needed for real entities; avoid a broad object inspector before entity fields settle.
   - Keep markers as a simple authoring primitive until the entity model earns replacement.

18. `codex/token-styling`
   - Add basic authored token appearance after imported assets have a home in the scenario model.
   - Start with color, shape, label, facing, and optional imported image reference before image-heavy styling.
   - Keep styling data readable and avoid a full asset or sprite editing system in this branch.

19. `codex/rules-authoring-system`
   - Build the first practical rules authoring workflow after `codex/rules-expression-spike` settles syntax and evaluator shape.
   - Add editor panels for attaching rules to entities, phases, or scenario-level hooks as justified by a concrete scenario.
   - Include runtime evaluation and enough debugging/inspection to make authored rules testable in the editor.

## Deferred Design Space

Large boards and map styling:
- support triangle and other tile grids only after square and hex prove the geometry seam
- support no-grid free-coordinate boards for free-space scenarios
- add a free-coordinate renderer and pointer interaction branch once a concrete free-space scenario justifies the data-model room from `codex/space-and-scale-setup`
- define authored scale semantics for tiled and free-coordinate boards, such as one hex equals a distance or one editor unit equals a physical distance
- add concise setup help or tooltip hints once labels like distance per tile, scale unit, tile size, and free-coordinate bounds need to carry real authoring meaning
- add a live board setup preview that updates the board as setup values change, with clear rules for whether placed objects are preserved or cleared; this becomes relevant once board setup is revisited or an inspector allows post-creation setup edits
- introduce a scenario-level home view only if there is a clear authoring or runtime need to persist view state
- test large-map viewport performance under real authoring pressure, including draw cost, culling, and whether any lazy rendering or tile virtualization is needed
- add terrain concepts only after placement and setup are credible: tile properties, terrain types, movement-cost hooks, and visual terrain styling

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
- defer authored hex orientation choice until a concrete scenario needs flat-top; `codex/space-and-scale-setup` records pointy-top as the current hardcoded orientation
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
