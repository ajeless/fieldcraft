# Redesign reference

This folder contains the React mockup used to iterate on the Fieldcraft editor redesign. It is **reference material, not source**. The mockup was built in a browser-based design tool and is not part of the real editor's build.

## How to view the mockup

Open `FieldCraft Redesign.html` in any modern browser. It pulls React, ReactDOM, and Babel Standalone from a CDN and renders the mockup client-side. No build step required.

Screens available:

- Editor (default) — the main authoring view
- Runtime — read-only playback preview
- New Scenario — scenario creation flow
- Asset Library — full-screen asset management

Switch screens by editing `TWEAKS.screen` in `FieldCraft Redesign.html` (values: `editor`, `new`, `assets`, `runtime`) or by using the menu bar.

## How to read the mockup when implementing

The real editor is vanilla TypeScript with direct DOM manipulation (see `apps/editor/src/main.ts`). The mockup is React. Do not attempt to port the mockup directly.

When implementing a branch from `BRIEF.md`, read the relevant mockup component to understand:

- Layout proportions and spacing
- Token values and color usage (`components/tokens.jsx` is authoritative for the token system)
- Interaction patterns (what clicking does, what hover reveals, what's keyboard-triggered)
- Component structure and section nesting

Then translate that into TypeScript that fits the existing editor's patterns.

## What to copy

- Token values and color scales (`components/tokens.jsx`)
- Layout measurements: inspector 340px, tool rail 44px, asset strip 128px/28px, status bar 22px, menubar 32px, command bar 40px, title bar 28px
- Typography: Inter for UI, JetBrains Mono for code/ids/coordinates
- Four-tab inspector structure (Scenario / Selection / Assets / Source)
- Ruler behavior — coordinate labels with cursor tracking
- Asset strip mechanics — pinned-first ordering, contextual filter when Marker tool armed, Import drop card
- New Scenario three-card layout with mini board previews
- Edit Board Setup modal shape and fields
- Sides data model — author-defined `sides` array, `sideId` references on pieces

## What NOT to copy

- **React, ReactDOM, Babel Standalone** — the real editor uses vanilla TypeScript
- **The mockup's `localStorage` usage for screen state** — the real editor has its own session draft system (`editorSessionDraftStorageKey`)
- **Mock data** (`SAMPLE_ASSETS`, `SCENARIO`, `SAMPLE_SCENARIO`) — real data comes from the scenario model
- **`window.prompt()` for "Add new side"** in the Selection tab — replace with a small inline form
- **The BoardSetupModal's "Hex grid · soon" / "Free · soon" disabled treatment** — the real engine supports all three space models today; enable all three
- **The mockup's `forceRender()` mutation of `s.sides`** — real sides flow through the scenario state + undo/redo history

## File map

| File | What it shows |
|------|---------------|
| `FieldCraft Redesign.html` | Entry point, top-level App component, route/screen switching |
| `components/tokens.jsx` | **Authoritative** token system (dark + light) — copy values from here |
| `components/chrome.jsx` | Title bar, menu bar, command bar, status bar |
| `components/editor.jsx` | Main editor view: tool rail, board stage, floating overlays, docked inspector with tabs, ruler implementation, BoardSetupModal |
| `components/boards.jsx` | Square / hex / free-coordinate board renderers with corner marks and side-color indicators |
| `components/asset-strip.jsx` | Bottom asset strip with contextual filter and pinned-first ordering |
| `components/asset-library.jsx` | Full-screen asset library subview with grid + detail panel |
| `components/new-scenario.jsx` | New Scenario page with three space-model cards |
| `components/scenario.jsx` | Sample scenario JSON with sides array (`schemaVersion: 3`) and JSON syntax highlighter |
| `components/runtime.jsx` | Runtime preview screen with transport controls |
| `components/palette.jsx` | ⌘K command palette overlay |
| `components/primitives.jsx` | Shared UI primitives — buttons, inputs, segmented controls, icons |

## Screenshots

The `screenshots/` folder contains rendered views of the mockup at various states:

- `dark-default.png` — editor view, dark theme, with a selected marker
- `light-mode.png` / `theme-light.png` — light theme variants
- `shortcuts.png` — File menu open with keyboard shortcuts visible
- `01-theme-test.png` / `02-theme-test.png` — theme-switching verification shots

Use screenshots for visual reference when implementing. Use the JSX for interaction and layout details.
