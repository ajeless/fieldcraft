# Fieldcraft Editor Redesign Brief

Durable reference for the editor UX/UI redesign. This file is the spec; the mockups in `reference/` are the illustration. When the two disagree, this file wins.

Reference bundle revision: April 2026. Future design iterations must update this file or ship a replacement bundle alongside it; otherwise the reference silently drifts from the spec.

## Why this exists

Fieldcraft's editor grew feature-first. `main.ts` reached 3,338 lines and 152 functions before a structural UI pass happened. Every new feature accreted as another stacked section in the right column, because there was no UI vocabulary — no `Inspector`, no `ToolRail`, no `StatusBar`, no overlay primitive — for features to plug into.

This redesign introduces that vocabulary. It also answers several UX questions that had gone unanswered because no one was looking at the editor as a designed object:

- Where do scenario-wide metrics live vs. per-selection details vs. power-user source views?
- How do we anticipate tools and entity concepts that are on the roadmap but not yet shipped (Ruler, Hand, sides, facing, styling, properties)?
- How do we stop Board Setup from being a one-way door?
- How do we make Decision 004 (two distinct space models) visible to the author?
- How do we keep the browser editor thin (Decision 010) while the desktop editor gets richer?

The redesign is compatible with every settled decision in `DECISIONS.md`. No decision needs to be reopened.

## Architectural commitments this redesign adds

The following become new architectural commitments with implementation:

1. **Four-tab inspector.** The right column is a docked panel with four peer tabs: Scenario / Selection / Assets / Source. Selection auto-promotes to active when something is selected. Each tab has a distinct scope (scenario-wide / per-selection / library-picker / power-user). The panel can collapse to an 18px rail.

2. **Tool rail on the left.** A 44px vertical rail with icon-only tool buttons. Today: Select, Marker. Ghosted/disabled placeholders for Ruler and Hand until those features ship. The rail's position is load-bearing; future tools register into it.

3. **Bottom asset strip.** A 128px horizontal strip below the board, collapsible to 28px. Shows asset thumbnails with pinned-first ordering. Contextual filter: when the Marker tool is armed, auto-filters to image assets. Includes an Import drop card at the end.

4. **Status bar at the bottom.** A 22px strip showing structured OS-style fields (cursor position, active tool, space model, selection count, piece/asset counts, dirty state, save shortcut hint). Replaces the current status-line sidebar item.

5. **Command palette (⌘K / Ctrl+K).** Fuzzy-searchable overlay over the existing command registry. Does not replace the menu bar or the command bar — it's a discoverability layer.

6. **Full-page New Scenario flow.** Three space-model cards (square, pointy-top hex, free-coordinate) with miniature board previews, followed by scenario details. Replaces the current dashed-border in-viewport setup form.

7. **Edit Board Setup as a modal.** The same fields as New Scenario, reachable post-creation via the Board menu or a small "Edit…" affordance in the Scenario tab's Space section. Fixes the current one-way-door problem.

8. **Coordinate-label stage rulers.** Replaces decorative tick marks. For square/hex grids: A–H across the top, 1–N down the side, with the current cursor's column/row highlighted in accent color. For free-coordinate boards: world-unit labels at appropriate intervals. Rulers change with the space model.

9. **Author-defined sides at the scenario level.** Scenarios have a `sides` array with author-set labels ("Federation," "Klingon Empire," "Player 1 / NPCs") and colors. Pieces reference sides by `sideId`. Sides are managed in the Scenario tab; selected pieces get a side dropdown in the Selection tab. This shipped as a scenario-format v3 change with a migration from v2.

10. **Authored piece facing.** Pieces carry `facingDegrees`, edited from the Selection tab and rendered as a direction arrow in the shared editor/viewer board. This shipped as a scenario-format v4 change with a migration from v3, and remains presentation data rather than rules behavior.

11. **Basic marker styling.** Pieces carry a `style` object with shape, fill color, and stroke color. Styling is edited from the Selection tab and rendered by the shared editor/viewer board for default markers and image-backed marker frames. This shipped as a scenario-format v5 change with a migration from v4, and remains presentation data rather than unit typing or rules behavior.

## Tab contents (authoritative)

### Scenario tab

Whole-scenario state. Visible when nothing is selected, or when explicitly activated.

- Title (editable)
- Space section with "Edit…" button → opens Edit Board Setup modal
  - Model, Dimensions, Tile size, Scale
- Sides section with "+ Add" button
  - Empty state explains what sides are for with examples
  - Each side row: color swatch, inline-renameable label, piece count, hover-to-reveal remove button
  - Removing a side clears `sideId` on orphaned pieces
- Contents section: Markers count, Assets count
- Board background: asset card
- File section: State (saved/unsaved), Mode (Desktop/Browser), Path

### Selection tab

Per-selection detail. Auto-promotes when something is selected.

- Header with piece swatch, "Marker" label, opaque piece id, clear-selection button
- Position: X/Y (grid coords) or X/Y (world coords) depending on space model
- Linked asset: thumbnail, author-facing label, mono path, Change / Unbind buttons
- Appearance: shape select, fill/stroke color controls, Label input
- Side: styled dropdown with color swatch, current side label, "+ Add side…" entry
- Facing: range/number control that updates the shared board renderer
- Colocation: text description of any shared position

### Assets tab

Contextual picker. When a piece is selected, shows image assets as a pickable grid for rebinding that piece's artwork. When nothing is selected, invites opening the full Asset Library.

### Source tab

JSON source view with compact (340px) and expanded (640px) modes, toggled by a `|← Expand` / `→| Collapse` button. Shows the complete authored scenario including sides, `sideId` references, `facingDegrees`, and per-piece `style`. Apply/Reset buttons commit or discard pending edits. Validation state appears as a small header line.

## Design tokens

The redesign uses a dark-first OKLCH token system with a proper light companion. Tokens live at `reference/components/tokens.jsx`. The existing editor's `styles.css` should be refactored to expose these tokens as CSS custom properties before anything else changes.

Key constraints:
- Inter for UI text, JetBrains Mono for code/coordinates/ids
- Teal as signature accent, amber for warn, red for destructive
- Dark theme is the flagship; light theme must be first-class, not an afterthought

## What to copy from the reference, and what not to copy

### Copy

- Token values, color scales, typography ramps
- Layout proportions (inspector 340px, rail 44px, strip 128px/28px, status 22px, menubar 32px, command bar 40px, title bar 28px)
- Component structure and interaction patterns
- Ruler behavior (ResizeObserver-based coordinate labels that track cursor)
- Asset strip mechanics (pinned-first, contextual filter, draggable cards)
- New Scenario flow structure (three cards side by side, details panel below)
- Edit Board Setup as a modal (not a full-screen replacement)
- Author-defined sides model and `sideId` references
- `facingDegrees` as authored presentation data, not gameplay logic
- Piece `style` as authored presentation data, not gameplay logic
- Inline-rename pattern for asset labels and side labels

### Do not copy

- React, Babel Standalone, or ReactDOM — the real editor is vanilla TypeScript + DOM
- The mockup's localStorage usage for screen state (the real editor has its own session draft system)
- The mockup's mock data (`SAMPLE_ASSETS`, `SCENARIO`) — real data comes from the scenario model
- The mockup's `window.prompt()` for adding new sides — replace with a small inline form
- The mockup's BoardSetupModal "Hex grid · soon" / "Free · soon" disabled treatment — the real editor supports all three space models today

## Implementation sequence

Do not implement this as a single branch. Decompose into six branches, threaded between feature work, in this order:

1. **`codex/design-tokens-foundation`** — extract the token system from `styles.css` into a typed module. Introduces CSS custom properties for all tokens. No visual change beyond guaranteed light/dark parity. Prerequisite for everything else.

2. **`codex/inspector-tabbed-rewrite`** — convert the right column into the four-tab structure (Scenario / Selection / Assets / Source). Do not dock-vs-float yet; keep the current docked column. The goal is information architecture, not layout changes. Biggest single UX win; touches the largest surface in `main.ts`.

3. **`codex/status-bar`** — promote status from sidebar item to 22px bottom strip with structured fields. Move the dirty indicator to a dot in the menu bar.

4. **`codex/asset-strip`** — add the bottom asset strip; remove the redundant Assets section from the inspector (Assets tab remains as the picker).

5. **`codex/new-scenario-page`** — replace the in-viewport setup form with the three-card chooser. Same page reachable as "Edit Board Setup" modal from the Board menu and the Scenario tab.

6. **`codex/command-palette`** — wire ⌘K to the existing command registry.

Floating/collapsible inspector and coordinate-label rulers are later branches, pending feedback from the first redesign vocabulary slices. The tool rail has shipped as the fixed left rail; author-defined sides, authored facing, and basic marker styling have shipped with the first v1 piece model work.

Each branch must leave the editor visibly better and manually testable per AGENTS.md. Update `PLAN.md`'s "Recently Completed Baseline Slices" as branches land.

## Settled questions from the first redesign branches

- The four-tab inspector, tool rail, bottom asset strip, status bar, command palette, and full-page New Scenario flow are captured in decision `012`.
- The Source tab keeps targeted diagnostics and the existing source-editor contract; decision `008` still makes source readability load-bearing.
- Source-expanded state is local inspector state, not a route; `runtime` remains a route name in code for historical reasons, while v1 treats that surface as a viewer.

## Files in this folder

- `BRIEF.md` — this file (the spec)
- `reference/FieldCraft Redesign.html` — entry point for the mockup, readable in any browser
- `reference/components/*.jsx` — React mockup components (illustration only)
- `reference/screenshots/*.png` — rendered views of the mockup
- `reference/README.md` — how to read the reference without copying the runtime

When implementing, read BRIEF.md first, then reference the specific mockup components for the branch you're working on.
