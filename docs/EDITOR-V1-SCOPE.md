# Fieldcraft Editor V1 Scope

## 1. Purpose

This document is the v1 scope commitment for Fieldcraft. It supersedes earlier scope assumptions in `docs/RUNTIME-VISION.md` and is load-bearing: future planning should treat it like `DECISIONS.md` and `docs/redesign/BRIEF.md`, not like a draft.

## 2. Product framing

Fieldcraft v1 follows Pitch A: Fieldcraft is a map-and-scenario editor for turn-based tactical board games and tabletop wargames.

The reference domain is games like SFB, Warhammer 40K, and tabletop milsims: authored tactical situations, played by humans, with physical-table assumptions still visible in the workflow.

The primary user is the scenario author.

The primary output is:

- a `*.fieldcraft.json` scenario file
- optional package-local assets beside that scenario file
- a browser viewer export when presentation or screen-share use is helpful

The scenario file is consumed by humans at a physical table, over screen share, or through a simple viewer. The runtime export is a presentation viewer. It is not a gameplay engine.

The editor remains the product. The scenario file is the durable authored artifact.

## 3. Release shape — Option C: personal tool, made shippable-shaped

V1 is not a public release.

There is no launch, announcement, landing page, user acquisition path, or stranger-proof onboarding. The target bar is narrower:

> I would not be embarrassed if someone stumbled on this repo and tried it.

That means install and use UX can remain developer-tier:

- clone the repo
- install dependencies
- run the desktop editor
- use the documented commands

Polish effort goes into the editor itself: reliable authoring, readable files, visible state, decent examples, and documentation that accurately describes what exists. It does not go into packaging a consumer product for unknown users.

The repo should feel intentional. It does not need to feel commercial.

## 4. V1 feature set

The v1 feature set is limited to the branches below, in this order.

### 1. `codex/asset-strip`

Purpose: make package assets visible and usable as a first-class editor surface.

Adds:

- the bottom asset strip from `docs/redesign/BRIEF.md`
- pinned-first thumbnail ordering
- an Import drop card at the end
- contextual filtering where the current tool state supports it

This branch ships as described in `docs/redesign/BRIEF.md`. It does not reopen the redesign.

### 2. `codex/new-scenario-page`

Purpose: make scenario creation explicit and reversible.

Adds:

- a full-page New Scenario flow with square, pointy-top hex, and free-coordinate choices
- miniature board previews for the three space models
- scenario details in the same flow
- an Edit Board Setup modal reachable after creation

This branch ships as described in `docs/redesign/BRIEF.md`. The point is to remove the current one-way setup door, not to build a template marketplace.

### 3. `codex/command-palette`

Purpose: make existing commands discoverable without adding another permanent panel.

Adds:

- `Cmd+K` / `Ctrl+K`
- a fuzzy-searchable command overlay
- command execution through the existing command registry

The palette is a discovery layer over the menu bar and command bar. It does not replace either.

### 4. `codex/tool-rail`

Purpose: finish the editor's main tool vocabulary.

Adds:

- the left 44px tool rail from decision `012` and `docs/redesign/BRIEF.md`
- first-class Select and Marker tools
- disabled placeholders only where useful for visible vocabulary
- formal armed-tool state for contextual surfaces such as the asset strip
- retirement of the legacy left sidebar once its responsibilities have moved

The branch ships the rail shape. It does not build every future tool.

### 5. `codex/sides-and-entity-base`

Purpose: give authored pieces scenario-level ownership without trying to finish a game entity system in one branch.

Adds:

- author-defined sides at the scenario level
- `sideId` references on pieces
- Scenario tab side management
- Selection tab side assignment
- scenario format v3
- migration from v2

This branch splits and reshapes the original `codex/unit-entity-model`. It establishes ownership and identity. It does not add rules, turn structure, or gameplay behavior.

### 6. `codex/piece-facing`

Purpose: make authored orientation visible and editable.

Adds:

- an orientation/facing field on pieces
- editor rendering that shows direction
- a rotation gesture or equivalent direct manipulation
- source-editor round-trip for facing
- scenario format v4
- migration from v3

Facing is authored scenario data. It is not movement plotting, firing arcs, or rules evaluation.

### 7. `codex/token-styling`

Purpose: let authors distinguish piece types visually without requiring imported art.

Adds:

- basic shape variation
- color controls
- readable styling data in the scenario file
- editor and viewer rendering parity for the supported styling fields
- scenario format v5
- migration from v4

This branch uses the Selection tab introduced by the redesign work. It does not become a sprite editor, paint tool, or full design system for game art.

### 8. `codex/piece-properties`

Purpose: support scenario-useful per-piece facts without building a rules engine.

Adds:

- extensible per-piece key/value attributes
- reasonable primitive typing
- editor UI for viewing and editing properties
- source-editor round-trip
- scenario format v6
- migration from v5

Properties are descriptive data for humans and future systems. V1 does not evaluate them as rules.

## 5. V1 finishing branches

Three finishing branches make v1 feel intentional.

### 9. `codex/viewer-export-polish` — shipped

Purpose: make the existing browser runtime export work as a presentation/projection viewer.

Added:

- chrome-less viewer posture by default
- full-screen-friendly layout
- simple navigation or reset affordances
- render parity with the editor for v1-supported board, piece, side, facing, styling, and property display

The codebase preserves "runtime" terminology for historical reasons. Functionally, this branch treats the export as a viewer.

### 10. `codex/v1-example-scenarios` — shipped

Purpose: provide documentation-by-example.

Added:

- one to three reference scenarios committed to the repo
- coverage of square, pointy-top hex, and free-coordinate space models across the set
- package-local asset examples where useful
- examples that exercise sides, facing, styling, and properties once those branches exist

These are not tutorials, campaigns, or sample games with rules. They are working scenario files that show the authoring shape.

### 11. `codex/v1-documentation`

Purpose: align the repo's public-facing docs with v1 scope.

Adds:

- README rewrite for v1 scope
- a one-line README note explaining that "runtime" remains in code and filenames for historical reasons
- v1 release notes or changelog
- any final documentation cleanup needed for the shippable-shaped bar

This branch does not rename code, files, or commands just to remove the word "runtime."

## 6. What v1 is not

V1 does not resolve turns.

V1 does not evaluate rules.

V1 does not include gameplay logic.

V1 does not include:

- turn resolution
- plotted-order resolution
- rules evaluation
- combat resolution
- movement legality checks
- victory condition checks
- multiplayer
- networked play
- hot-seat resolution UX
- AI opponents
- hidden information
- fog of war
- standalone binary export of finished games
- public release work
- printable map output
- multi-select
- group operations
- copy/paste of pieces
- layers
- explicit z-order tools
- text annotations on the board
- scenario metadata beyond title

Some of those may be useful later. They are not v1.

Under v1, humans run the game. Fieldcraft authors and presents the scenario.

## 7. What changes if scope shifts later

Deferred items may move into a future v1.x scope, but not by accident. The path is to amend this document first, then implement the branch. Decisions are revisited through `DECISIONS.md` conventions: add a new entry or status update rather than silently editing history.

## 8. Relationship to other documents

`DECISIONS.md` 001 remains in force.

`DECISIONS.md` 002 remains in force.

`DECISIONS.md` 003 remains in force.

`DECISIONS.md` 004 remains in force.

`DECISIONS.md` 006 remains in force.

`DECISIONS.md` 008 remains in force.

`DECISIONS.md` 009 remains in force.

`DECISIONS.md` 011 remains in force.

`DECISIONS.md` 012 remains in force.

`DECISIONS.md` 005 is withdrawn by the v1 scope branch. Fieldcraft v1 does not enforce a time model because it does not resolve play.

`DECISIONS.md` 007 is amended by the v1 scope branch. Browser viewer export is the only v1 export target.

`DECISIONS.md` 010 receives a light amendment by the v1 scope branch. The browser surface is also the presentation-mode renderer for viewer export.

`docs/redesign/BRIEF.md` remains the implementation spec for the redesign branches.

`docs/RUNTIME-VISION.md` is preserved as historical context. It records the analysis that led to this re-scope; it is not current direction.

`PLAN.md` Near-Term sequence is rewritten by the v1 scope branch to match this document.
