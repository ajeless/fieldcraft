# NEXT.md

Near-term planning notes for the next editor slices. This is not a roadmap promise; it is the current working plan for small, manually testable branches.

## Current Focus

Make board authoring credible before expanding into broader editor systems.

The immediate pressure points from manual testing are:
- the editor workspace should use available window size better
- the board viewport should support pan, zoom, rotation, and reset-view groundwork early
- 64 x 64 grids should render correctly
- larger maps and boards should be possible without rendering every tile as a DOM control, starting with a canvas-backed board surface
- square and hex grids should both be treated as first-class tile geometries early, not as square-grid plus later hex special cases
- board setup should grow toward configurable tile size, grid type, line color, line opacity, board background, bounds, and scale

## Near-Term Branch Sequence

1. `codex/board-viewport-layout`
   - Improve the editor workspace so it uses maximized windows.
   - Introduce a canvas-backed board surface so empty tiles are no longer individual DOM controls.
   - Fix dense square-grid rendering, including the 64 x 64 line issue, through the new viewport rather than by raising limits around the old renderer.
   - Introduce the first board viewport model: pan, zoom, rotation-ready transforms, reset view, stable sizing, and room for large maps.
   - Establish renderer-independent coordinate flow: screen point to viewport point to board/world point to tile coordinate.
   - Keep the scope strict: canvas grid/background surface, simple marker interaction, no asset system, no animation system, and no full renderer framework.

2. `codex/hex-grid-proof`
   - Add a minimal hex tile geometry implementation before broader board setup work.
   - Render a basic hex grid through the same canvas-backed viewport used by square grids.
   - Prove hit-testing and marker placement on hex centers using model-based pointer math, not SVG or DOM tile targets.
   - Keep the branch focused on making hex first-class in the geometry seam; defer full hex rules, movement, terrain, styling, and setup polish.

3. `codex/space-and-scale-setup`
   - Extend board setup toward explicit space configuration rather than only square-grid dimensions.
   - Make square grid and hex grid explicit author-facing setup choices.
   - Add data-model room for free-coordinate bounds, authored scale, tile size, grid line color, grid line opacity, and board background.
   - Keep the first UI small; the goal is to establish the shape without implementing every grid type or rule mechanic.

4. `codex/editor-menu-bar`
   - Add a File/Edit/View-style in-app menu bar that works in browser and desktop.
   - Wire existing commands first: New, Open, Save, Save As, Launch Runtime.
   - Leave native Tauri menus as a later refinement after the command model is clearer.

5. `codex/theme-toggle`
   - Add light and dark editor themes using CSS variables.
   - Persist the chosen theme.
   - Default from system preference when no choice exists.

6. `codex/draft-autosave`
   - Add draft recovery autosave for the editor session.
   - Do not silently overwrite scenario files.
   - Keep explicit Save and Save As as the durable file actions.

7. `codex/source-editor`
   - Turn the scenario JSON panel into an editable source view.
   - Validate edits before applying them to the visual editor.
   - Provide a safe way to recover from invalid JSON.

8. `codex/asset-library-imports`
   - Add the first scenario asset model for imported images.
   - Keep scenario JSON readable by referencing assets rather than embedding large image payloads.
   - Start with board backgrounds or token images before broader sprite/tile workflows.

9. `codex/export-runtime-spike`
   - Define the first browser export path once the runtime has enough behavior to export.
   - Include the implications of bundling referenced scenario assets.
   - Keep standalone binary game export as a follow-on after the browser export shape is clear.

## Deferred Design Space

Large boards and map styling:
- support square, hex, triangle, and other tile grids over time
- support no-grid free-coordinate boards for free-space scenarios
- make tile size, grid color, line opacity, and board background authorable
- support maps larger than the visible viewport through pan, zoom, and viewport-based rendering
- support viewport rotation and reset-to-home orientation without assuming north-up forever
- give free-coordinate boards explicit bounds because there are no tiles to delimit the play area
- support authored scale for tiled and free-coordinate boards, such as one hex equals a distance or one editor unit equals a physical distance

Assets and author media:
- import images for board backgrounds, map tiles, sprites, tokens, and icons
- prefer a project/package asset library with stable relative references over base64-heavy scenario JSON
- distinguish asset import and token styling from full image editing
- defer a built-in sprite creator until the editor has real asset workflows and authoring pressure justifies it
- useful earlier token styling may include color, shape, label, image, and facing arrow

Editor layout customization:
- defer draggable/dockable panels until the main panel set stabilizes
- design toward a small container/widget system rather than one-off panel code
- likely concepts: command registry, panel registry, layout containers, persisted layouts, and reset-to-default
- avoid turning this into a plugin system until at least two real editor workflows need it

Export, packaging, and network play:
- export is important but should follow a useful runtime slice
- first target should be a browser-playable bundle containing a scenario and minimal runtime
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
