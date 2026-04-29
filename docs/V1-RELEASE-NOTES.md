# Fieldcraft V1 Notes

Fieldcraft v1 is a repo-based, desktop-first scenario authoring tool. It is intentionally not a public product release, gameplay engine, or standalone game packaging system.

## What V1 Does

- Authors square-grid, pointy-top hex-grid, and free-coordinate scenario boards.
- Places marker pieces, including colocated tile markers and continuous free-coordinate positions.
- Tracks scenario-level sides and optional per-piece side assignments.
- Stores authored marker facing, shape, fill color, stroke color, marker image artwork, and descriptive typed properties.
- Imports package-local image and audio assets in the desktop editor and keeps asset references human-readable.
- Saves `*.fieldcraft.json` scenario files with a migration-aware v6 schema.
- Presents scenarios in a read-only in-app viewer and exports self-contained browser viewer HTML with bundled assets.
- Provides reference packages under `examples/v1/` for square, hex, and free-coordinate scenarios.

## What V1 Does Not Do

- It does not resolve turns, movement, combat, victory, hidden information, AI, multiplayer, or rules.
- It does not package finished standalone games.
- It does not promise browser-editor parity; the browser editor exists for testing and viewer support.
- It does not include public-release onboarding, installers, or consumer-facing distribution polish.

Humans run the game. Fieldcraft authors and presents the scenario.

## Scenario Format

Current scenarios use:

- `schema: "fieldcraft.scenario"`
- `schemaVersion: 6`
- human-readable JSON
- opaque piece ids with author-facing labels
- scenario-level sides
- package-local asset paths
- per-piece `facingDegrees`, `style`, and typed `properties`

Older supported scenario versions are upgraded through the chained migration registry on load. Forward-version files are rejected rather than silently downgraded.

## Verification Bar

The current v1 baseline is checked with:

```sh
corepack pnpm test:unit
corepack pnpm build
corepack pnpm test:smoke
corepack pnpm test:desktop:smoke
```

Desktop-native dialog presentation and packaged-binary sanity remain manual checks; see `DESKTOP-TESTING.md`.
