# Scenario Format Hardening Implementation Plan

> **Status:** Archived implementation plan. The scenario-format-hardening slice shipped after this plan was written, and the current scenario format has since advanced beyond the v1 shape described here. Preserve this file as implementation history; use `DECISIONS.md` decision `011`, current code, and current fixtures as the source of truth.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship v1 of the Fieldcraft scenario format — stable `schema`/`schemaVersion` split, opaque piece ids + author-facing labels — along with a chained migration registry whose first entry (v0→v1) upgrades existing scenarios on load.

**Architecture:** New module `apps/editor/src/scenario-migrations/` owns id generation, the migration registry, and a `loadScenario(text)` entry point that every load path (file open, source apply, draft recovery) calls. Existing `scenario.ts` becomes the v1 validator; migration output must pass through it. The editor UI renames its id inspector field to a label field and surfaces the opaque id read-only behind a disclosure.

**Tech Stack:** TypeScript, Vite (editor bundler), Playwright (existing smoke), Vitest (new — for pure-function migration tests), Node.js 22.12+, pnpm.

**Tooling note:** This plan introduces **Vitest** as a unit-test runner. Reason: the migration registry is a pure-function subsystem with fixture pair inputs and outputs; verifying it via Playwright alone would make every migration review a full smoke pass. Vitest is the default test runner in Vite repos and requires one dev-dep + one config block. If the user prefers to avoid the dep, the fallback is `node --test` with `tsx` — same test code, different runner. Cross-reference `AGENTS.md` "premature sprawl" caution before landing.

---

## File Structure

**Create:**

- `apps/editor/src/scenario-migrations/identity.ts` — opaque id alphabet + `generatePieceId(existingIds: Iterable<string>): string`.
- `apps/editor/src/scenario-migrations/identity.test.ts` — Vitest.
- `apps/editor/src/scenario-migrations/v0-to-v1.ts` — `migrateV0ToV1(input: unknown, options: { generateId: () => string }): unknown`.
- `apps/editor/src/scenario-migrations/v0-to-v1.test.ts` — runs the migration over `pre.json` fixtures and deep-equals `post.json`.
- `apps/editor/src/scenario-migrations/index.ts` — `migrations` registry, `CURRENT_SCHEMA_VERSION`, `ScenarioLoadError` tagged error, `migrateScenario(input: unknown)`, `loadScenario(text: string): Scenario`.
- `apps/editor/src/scenario-migrations/index.test.ts` — load-path tests (v0 text, v1 text, forward version, malformed, legacy `"fieldcraft.scenario.v0"` composite).
- `apps/editor/test-fixtures/migrations/v0-to-v1/pre-tile.json`
- `apps/editor/test-fixtures/migrations/v0-to-v1/post-tile.json`
- `apps/editor/test-fixtures/migrations/v0-to-v1/pre-free.json`
- `apps/editor/test-fixtures/migrations/v0-to-v1/post-free.json`
- `apps/editor/test-fixtures/migrations/v0-to-v1/pre-empty.json`
- `apps/editor/test-fixtures/migrations/v0-to-v1/post-empty.json`
- `apps/editor/vitest.config.ts` — runner config (node env, tests co-located with source).

**Modify:**

- `apps/editor/package.json` — add `vitest` dev-dep, add `test` script.
- `apps/editor/src/scenario.ts` — replace `scenarioSchema` with `schemaIdentifier` + `currentSchemaVersion`, update `Scenario` type (add `schemaVersion`), add `label` to `ScenarioPiece`, update `createEmptyScenario`, rewrite `parseScenarioValue` to only accept v1 shape (leave legacy-string handling to `scenario-migrations`).
- `apps/editor/src/main.ts` — update every piece constructor to include `label: ""`, replace `createMarkerId` with `generatePieceId` from identity module, rename inspector id input to label input, add read-only id disclosure, route file-open / source-apply / draft-recovery through `loadScenario`, mark document dirty when migration ran.
- `scripts/test-browser-smoke.mjs` — update in-memory scenario fixtures to v1 shape (add `schemaVersion: 1`, rename `schema`, give each piece a `label`), change `piece.id ===` assertions to `piece.label ===`, add a new case exercising v0-file-upgrade-on-open.
- `package.json` (root) — add `test:unit` script that calls the editor workspace.
- `PLAN.md` — after merge, move this slice to "Recently Completed Baseline Slices" and update Current Focus.
- `README.md` — add one-line note under Development about `pnpm test:unit`.

**Leave alone:** `runtime-export/browser-runtime.js` (consumes already-parsed scenarios), `desktop-dev.mjs`/`start.mjs`/`stop.mjs` (no scenario-format coupling), Rust/Tauri side (nothing reads scenarios there).

---

## Task 1: Add Vitest as the unit-test runner

**Files:**
- Modify: `apps/editor/package.json`
- Create: `apps/editor/vitest.config.ts`
- Modify: `package.json` (repo root)

- [ ] **Step 1: Install Vitest**

Run:
```bash
corepack pnpm --dir apps/editor add -D vitest
```

Expected: lockfile updates; `vitest` appears under `devDependencies` in `apps/editor/package.json`.

- [ ] **Step 2: Add Vitest config**

Create `apps/editor/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: false
  }
});
```

- [ ] **Step 3: Add test script in editor package.json**

Edit `apps/editor/package.json` `scripts`:

```json
{
  "dev": "vite --host 127.0.0.1 --port 5173 --strictPort",
  "build": "tsc --noEmit && vite build",
  "preview": "vite preview --host 127.0.0.1 --port 4173 --strictPort",
  "tauri": "tauri",
  "test": "vitest run"
}
```

- [ ] **Step 4: Add root-level shortcut**

Edit the `scripts` block of the repo-root `package.json` to add:

```json
"test:unit": "corepack pnpm --dir apps/editor test"
```

- [ ] **Step 5: Add a throwaway sanity test**

Create `apps/editor/src/scenario-migrations/sanity.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("vitest runner", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

(The directory `scenario-migrations/` does not exist yet — creating this file creates it.)

- [ ] **Step 6: Confirm the runner works**

Run: `corepack pnpm test:unit`
Expected: `vitest` prints one passing test, exits 0.

- [ ] **Step 7: Commit**

```bash
git add apps/editor/package.json apps/editor/pnpm-lock.yaml pnpm-lock.yaml apps/editor/vitest.config.ts apps/editor/src/scenario-migrations/sanity.test.ts package.json
git commit -m "Add vitest as the unit-test runner"
```

If `pnpm-lock.yaml` paths differ on this repo (root-only lockfile), adjust `git add` accordingly. Check with `git status` before committing.

Delete the sanity test at the end of Task 2 once a real test exists.

---

## Task 2: Identity generator

**Files:**
- Create: `apps/editor/src/scenario-migrations/identity.ts`
- Create: `apps/editor/src/scenario-migrations/identity.test.ts`
- Delete: `apps/editor/src/scenario-migrations/sanity.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/editor/src/scenario-migrations/identity.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { generatePieceId, isPieceIdShape, pieceIdAlphabet } from "./identity";

describe("generatePieceId", () => {
  it("produces an id with the piece_ prefix and 6 alphabet characters", () => {
    const id = generatePieceId([]);
    expect(id).toMatch(/^piece_[0-9A-Z]{6}$/);
  });

  it("uses the Crockford base32 alphabet (excludes I, L, O, U)", () => {
    for (const char of pieceIdAlphabet) {
      expect("ILOU").not.toContain(char);
    }
    expect(pieceIdAlphabet.length).toBe(32);
  });

  it("avoids collisions with existing ids (retries)", () => {
    const forced = new Set<string>();
    for (let i = 0; i < 500; i += 1) {
      const id = generatePieceId(forced);
      expect(forced.has(id)).toBe(false);
      forced.add(id);
    }
  });

  it("never returns an id outside the alphabet", () => {
    for (let i = 0; i < 200; i += 1) {
      const id = generatePieceId([]);
      expect(isPieceIdShape(id)).toBe(true);
    }
  });
});

describe("isPieceIdShape", () => {
  it("accepts well-formed ids", () => {
    expect(isPieceIdShape("piece_7A3FK2")).toBe(true);
  });

  it("rejects non-conforming strings", () => {
    expect(isPieceIdShape("")).toBe(false);
    expect(isPieceIdShape("piece_12345")).toBe(false);
    expect(isPieceIdShape("piece_1234567")).toBe(false);
    expect(isPieceIdShape("PIECE_123456")).toBe(false);
    expect(isPieceIdShape("piece_ILOU12")).toBe(false);
  });
});
```

Delete `apps/editor/src/scenario-migrations/sanity.test.ts`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `corepack pnpm test:unit`
Expected: FAIL with "Cannot find module './identity'" or unresolved import.

- [ ] **Step 3: Implement the identity module**

Create `apps/editor/src/scenario-migrations/identity.ts`:

```ts
export const pieceIdAlphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const pieceIdLength = 6;
const pieceIdPrefix = "piece_";
const pieceIdPattern = new RegExp(
  `^${pieceIdPrefix}[${pieceIdAlphabet}]{${pieceIdLength}}$`
);

export function generatePieceId(existing: Iterable<string>): string {
  const taken = existing instanceof Set ? existing : new Set(existing);
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const candidate = randomPieceId();
    if (!taken.has(candidate)) {
      return candidate;
    }
  }
  throw new Error("Failed to generate a unique piece id after 32 attempts.");
}

export function isPieceIdShape(value: string): boolean {
  return pieceIdPattern.test(value);
}

function randomPieceId(): string {
  const bytes = new Uint8Array(pieceIdLength);
  crypto.getRandomValues(bytes);
  let out = pieceIdPrefix;
  for (const byte of bytes) {
    out += pieceIdAlphabet[byte % pieceIdAlphabet.length];
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `corepack pnpm test:unit`
Expected: identity tests pass; no sanity test remains.

- [ ] **Step 5: Confirm typecheck is happy**

Run: `corepack pnpm --dir apps/editor exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/editor/src/scenario-migrations/identity.ts apps/editor/src/scenario-migrations/identity.test.ts
git rm apps/editor/src/scenario-migrations/sanity.test.ts
git commit -m "Add opaque piece id generator"
```

---

## Task 3: Update scenario.ts to the v1 type shape (breaking, paired with all callers)

This task is large because the TS type change is compile-breaking — every site that constructs a `ScenarioPiece` or reads `schema` must update in the same commit. It is a mechanical refactor paired with the new shape.

**Files:**
- Modify: `apps/editor/src/scenario.ts`
- Modify: `apps/editor/src/main.ts` (all piece construction sites)
- Modify: `apps/editor/src/runtime-export/` — check and touch if needed (expected no change since it reads the already-parsed scenario object; but the bundle JSON emits the new shape automatically).

- [ ] **Step 1: Rewrite the v1 type surface in scenario.ts**

In `apps/editor/src/scenario.ts`, replace lines 1–135 (the imports through `createEmptyScenario`) so the module exports:

```ts
import {
  type FreeCoordinateBounds,
  isPointInFreeCoordinateBounds
} from "./spatial";

export const schemaIdentifier = "fieldcraft.scenario";
export const currentSchemaVersion = 1;

export const maxTileGridSize = 64;
export const maxFreeCoordinateBoardSize = 100000;
export const minTileSize = 8;
export const maxTileSize = 160;
export const defaultSquareTileSize = 48;
export const defaultHexTileSize = 28;
export const defaultScaleDistancePerTile = 1;
export const defaultScaleUnit = "tile";
export const defaultFreeCoordinateDistancePerWorldUnit = 1;
export const defaultFreeCoordinateScaleUnit = "unit";
export const defaultGridLineColor = "#aeb8c1";
export const defaultGridLineOpacity = 1;
export const defaultBoardBackgroundColor = "#f9fbfb";

export type ScenarioAssetKind = "image" | "audio";

export type ScenarioAsset = {
  id: string;
  kind: ScenarioAssetKind;
  path: string;
};

export type ScenarioPiece = {
  id: string;
  label: string;
  kind: "marker";
  side: "neutral";
  x: number;
  y: number;
};

export type ScenarioTileSpaceType = "square-grid" | "hex-grid";
export type ScenarioSpaceType = ScenarioTileSpaceType | "free-coordinate";

export type ScenarioTileScale = {
  distancePerTile: number;
  unit: string;
};

export type ScenarioFreeCoordinateScale = {
  distancePerWorldUnit: number;
  unit: string;
};

export type ScenarioGridStyle = {
  lineColor: string;
  lineOpacity: number;
};

export type ScenarioBoardBackground = {
  color: string;
  imageAssetId?: string;
};

export type ScenarioTileSpace = {
  type: ScenarioTileSpaceType;
  width: number;
  height: number;
  tileSize: number;
  scale: ScenarioTileScale;
  grid: ScenarioGridStyle;
  background: ScenarioBoardBackground;
};

export type ScenarioFreeCoordinateBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ScenarioFreeCoordinateSpace = {
  type: "free-coordinate";
  bounds: ScenarioFreeCoordinateBounds;
  scale: ScenarioFreeCoordinateScale;
  background: ScenarioBoardBackground;
};

export type ScenarioSpace = ScenarioTileSpace | ScenarioFreeCoordinateSpace;

export type Scenario = {
  schema: typeof schemaIdentifier;
  schemaVersion: typeof currentSchemaVersion;
  title: string;
  space: ScenarioSpace | null;
  assets: ScenarioAsset[];
  pieces: ScenarioPiece[];
  metadata: {
    editorVersion: string;
    savedAt: string | null;
  };
};

export type CreateTileScenarioSpaceOptions = {
  type: ScenarioTileSpaceType;
  width: number;
  height: number;
  tileSize?: number;
  distancePerTile?: number;
  scaleUnit?: string;
  gridLineColor?: string;
  gridLineOpacity?: number;
  backgroundColor?: string;
};

export type CreateFreeCoordinateScenarioSpaceOptions = {
  x?: number;
  y?: number;
  width: number;
  height: number;
  distancePerWorldUnit?: number;
  scaleUnit?: string;
  backgroundColor?: string;
};

export const scenarioStorageKey = "fieldcraft:last-scenario";

export function createEmptyScenario(): Scenario {
  return {
    schema: schemaIdentifier,
    schemaVersion: currentSchemaVersion,
    title: "Untitled Fieldcraft Scenario",
    space: null,
    assets: [],
    pieces: [],
    metadata: {
      editorVersion: "0.1.0-experiment",
      savedAt: null
    }
  };
}
```

Also delete the old `export const scenarioSchema = "fieldcraft.scenario.v0";`.

- [ ] **Step 2: Update `parseScenarioValue` to validate v1 only**

Replace the `parseScenarioValue` function in `apps/editor/src/scenario.ts` so it validates v1 explicitly. The migration pipeline (future Task 6) passes migrated payloads through this validator; legacy string handling lives there, not here.

```ts
function parseScenarioValue(value: unknown): Scenario | null {
  if (!isRecord(value)) {
    return null;
  }

  if (value.schema !== schemaIdentifier || value.schemaVersion !== currentSchemaVersion) {
    return null;
  }

  if (typeof value.title !== "string") {
    return null;
  }

  if (!Array.isArray(value.pieces) || !isRecord(value.metadata)) {
    return null;
  }

  const assets = parseScenarioAssets(value.assets);
  if (!assets) {
    return null;
  }

  const space = parseScenarioSpace(value.space);
  if (space === false) {
    return null;
  }

  const pieces = parseScenarioPieces(value.pieces, space);
  if (!pieces) {
    return null;
  }

  return {
    schema: schemaIdentifier,
    schemaVersion: currentSchemaVersion,
    title: value.title,
    space,
    assets,
    pieces,
    metadata: {
      editorVersion:
        typeof value.metadata.editorVersion === "string"
          ? value.metadata.editorVersion
          : "unknown",
      savedAt:
        typeof value.metadata.savedAt === "string" || value.metadata.savedAt === null
          ? value.metadata.savedAt
          : null
    }
  };
}
```

- [ ] **Step 3: Update `parseScenarioPieces` to read the `label` field**

Replace the body of `parseScenarioPieces` so pieces carry a `label`. Missing `label` is rejected (v1 requires it; migration supplies it from v0 ids).

```ts
function parseScenarioPieces(
  pieces: unknown[],
  space: ScenarioSpace | null
): ScenarioPiece[] | null {
  if (!space) {
    return pieces.length === 0 ? [] : null;
  }

  const parsedPieces: ScenarioPiece[] = [];

  for (const piece of pieces) {
    if (!isRecord(piece)) {
      return null;
    }

    if (
      typeof piece.id !== "string" ||
      piece.id.length === 0 ||
      typeof piece.label !== "string" ||
      piece.kind !== "marker" ||
      piece.side !== "neutral"
    ) {
      return null;
    }

    const x = piece.x;
    const y = piece.y;

    if (isTileScenarioSpace(space)) {
      if (
        typeof x !== "number" ||
        typeof y !== "number" ||
        !Number.isInteger(x) ||
        !Number.isInteger(y) ||
        x < 0 ||
        y < 0 ||
        x >= space.width ||
        y >= space.height
      ) {
        return null;
      }
    } else if (
      typeof x !== "number" ||
      typeof y !== "number" ||
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !isPointInFreeCoordinateBounds({ x, y }, space.bounds)
    ) {
      return null;
    }

    parsedPieces.push({
      id: piece.id,
      label: piece.label,
      kind: "marker",
      side: "neutral",
      x,
      y
    });
  }

  return parsedPieces;
}
```

- [ ] **Step 4: Update main.ts piece construction sites**

Search for every object literal that creates a piece and add `label: ""`. Specifically, inside `placeDefaultMarker` in `apps/editor/src/main.ts:1444-1467`:

```ts
function placeDefaultMarker(x: number, y: number): void {
  if (!scenario.space) {
    return;
  }

  const markerId = createMarkerId(x, y, scenario.pieces);

  commitUndoableChange("marker placement", "Marker placed", () => {
    scenario = {
      ...scenario,
      pieces: [
        ...scenario.pieces,
        {
          id: markerId,
          label: "",
          kind: "marker" as const,
          side: "neutral" as const,
          x,
          y
        }
      ]
    };
    selectedMarkerId = markerId;
  });
}
```

Also check: if any other site in `main.ts` synthesizes pieces (it currently does not, but `updateSelectedMarkerId` reshapes existing pieces). Those are spread-preserving — no change needed beyond the construction site above.

Run: `corepack pnpm --dir apps/editor exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Update any remaining `scenarioSchema` references**

Search the repo:

```bash
```

Run this search via Grep tool:
- Pattern: `scenarioSchema|fieldcraft\.scenario\.v0`
- Scope: `apps/editor/src`

Each hit is either a reference that needs to move to `schemaIdentifier`/`currentSchemaVersion`, or a string literal that migrates through to v1. Update each. Do **not** update the smoke-test literals yet — those are intentionally v0 for Task 11's upgrade-on-open test.

- [ ] **Step 6: Run all checks**

```bash
corepack pnpm --dir apps/editor exec tsc --noEmit
corepack pnpm test:unit
```

Expected: both pass. Smoke is still broken (fixtures still v0); that's fine — it's fixed in Task 10.

- [ ] **Step 7: Commit**

```bash
git add apps/editor/src/scenario.ts apps/editor/src/main.ts
git commit -m "Promote scenario types to v1 shape"
```

---

## Task 4: Write v0→v1 migration fixtures and failing test

**Files:**
- Create: `apps/editor/test-fixtures/migrations/v0-to-v1/pre-tile.json`
- Create: `apps/editor/test-fixtures/migrations/v0-to-v1/post-tile.json`
- Create: `apps/editor/test-fixtures/migrations/v0-to-v1/pre-free.json`
- Create: `apps/editor/test-fixtures/migrations/v0-to-v1/post-free.json`
- Create: `apps/editor/test-fixtures/migrations/v0-to-v1/pre-empty.json`
- Create: `apps/editor/test-fixtures/migrations/v0-to-v1/post-empty.json`
- Create: `apps/editor/src/scenario-migrations/v0-to-v1.test.ts`

- [ ] **Step 1: Create the tile scenario fixture pair**

`apps/editor/test-fixtures/migrations/v0-to-v1/pre-tile.json`:

```json
{
  "schema": "fieldcraft.scenario.v0",
  "title": "Tile migration sample",
  "space": {
    "type": "square-grid",
    "width": 6,
    "height": 4,
    "tileSize": 48,
    "scale": { "distancePerTile": 1, "unit": "tile" },
    "grid": { "lineColor": "#aeb8c1", "lineOpacity": 1 },
    "background": { "color": "#f9fbfb" }
  },
  "assets": [
    { "id": "board-bg", "kind": "image", "path": "assets/board-bg.png" }
  ],
  "pieces": [
    { "id": "marker-2-1", "kind": "marker", "side": "neutral", "x": 2, "y": 1 },
    { "id": "scout-alpha", "kind": "marker", "side": "neutral", "x": 4, "y": 3 }
  ],
  "metadata": { "editorVersion": "0.1.0-experiment", "savedAt": "2026-04-10T00:00:00.000Z" }
}
```

`apps/editor/test-fixtures/migrations/v0-to-v1/post-tile.json`:

```json
{
  "schema": "fieldcraft.scenario",
  "schemaVersion": 1,
  "title": "Tile migration sample",
  "space": {
    "type": "square-grid",
    "width": 6,
    "height": 4,
    "tileSize": 48,
    "scale": { "distancePerTile": 1, "unit": "tile" },
    "grid": { "lineColor": "#aeb8c1", "lineOpacity": 1 },
    "background": { "color": "#f9fbfb" }
  },
  "assets": [
    { "id": "board-bg", "kind": "image", "path": "assets/board-bg.png" }
  ],
  "pieces": [
    { "id": "piece_STUB01", "label": "marker-2-1", "kind": "marker", "side": "neutral", "x": 2, "y": 1 },
    { "id": "piece_STUB02", "label": "scout-alpha", "kind": "marker", "side": "neutral", "x": 4, "y": 3 }
  ],
  "metadata": { "editorVersion": "0.1.0-experiment", "savedAt": "2026-04-10T00:00:00.000Z" }
}
```

The `piece_STUBnn` ids come from a deterministic stub generator injected by the test.

- [ ] **Step 2: Create the free-coordinate scenario fixture pair**

`apps/editor/test-fixtures/migrations/v0-to-v1/pre-free.json`:

```json
{
  "schema": "fieldcraft.scenario.v0",
  "title": "Free-coordinate migration sample",
  "space": {
    "type": "free-coordinate",
    "bounds": { "x": -10, "y": -10, "width": 100, "height": 60 },
    "scale": { "distancePerWorldUnit": 1, "unit": "unit" },
    "background": { "color": "#f9fbfb" }
  },
  "assets": [],
  "pieces": [
    { "id": "marker-1p5-3p25", "kind": "marker", "side": "neutral", "x": 1.5, "y": 3.25 },
    { "id": "marker-neg2-5", "kind": "marker", "side": "neutral", "x": -2, "y": 5 }
  ],
  "metadata": { "editorVersion": "0.1.0-experiment", "savedAt": null }
}
```

`apps/editor/test-fixtures/migrations/v0-to-v1/post-free.json`:

```json
{
  "schema": "fieldcraft.scenario",
  "schemaVersion": 1,
  "title": "Free-coordinate migration sample",
  "space": {
    "type": "free-coordinate",
    "bounds": { "x": -10, "y": -10, "width": 100, "height": 60 },
    "scale": { "distancePerWorldUnit": 1, "unit": "unit" },
    "background": { "color": "#f9fbfb" }
  },
  "assets": [],
  "pieces": [
    { "id": "piece_STUB01", "label": "marker-1p5-3p25", "kind": "marker", "side": "neutral", "x": 1.5, "y": 3.25 },
    { "id": "piece_STUB02", "label": "marker-neg2-5", "kind": "marker", "side": "neutral", "x": -2, "y": 5 }
  ],
  "metadata": { "editorVersion": "0.1.0-experiment", "savedAt": null }
}
```

- [ ] **Step 3: Create the empty scenario fixture pair**

`apps/editor/test-fixtures/migrations/v0-to-v1/pre-empty.json`:

```json
{
  "schema": "fieldcraft.scenario.v0",
  "title": "Empty scenario",
  "space": null,
  "assets": [],
  "pieces": [],
  "metadata": { "editorVersion": "0.1.0-experiment", "savedAt": null }
}
```

`apps/editor/test-fixtures/migrations/v0-to-v1/post-empty.json`:

```json
{
  "schema": "fieldcraft.scenario",
  "schemaVersion": 1,
  "title": "Empty scenario",
  "space": null,
  "assets": [],
  "pieces": [],
  "metadata": { "editorVersion": "0.1.0-experiment", "savedAt": null }
}
```

- [ ] **Step 4: Write the failing migration test**

Create `apps/editor/src/scenario-migrations/v0-to-v1.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { migrateV0ToV1 } from "./v0-to-v1";

const fixturesDir = join(__dirname, "../../test-fixtures/migrations/v0-to-v1");

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(fixturesDir, name), "utf8"));
}

function makeStubIdGenerator(): () => string {
  let counter = 0;
  return () => {
    counter += 1;
    return `piece_STUB${String(counter).padStart(2, "0")}`;
  };
}

describe("migrateV0ToV1", () => {
  it("migrates a tile scenario, preserving labels from old ids", () => {
    const pre = loadFixture("pre-tile.json");
    const post = loadFixture("post-tile.json");
    expect(migrateV0ToV1(pre, { generateId: makeStubIdGenerator() })).toEqual(post);
  });

  it("migrates a free-coordinate scenario with decimal positions", () => {
    const pre = loadFixture("pre-free.json");
    const post = loadFixture("post-free.json");
    expect(migrateV0ToV1(pre, { generateId: makeStubIdGenerator() })).toEqual(post);
  });

  it("migrates an empty scenario", () => {
    const pre = loadFixture("pre-empty.json");
    const post = loadFixture("post-empty.json");
    expect(migrateV0ToV1(pre, { generateId: makeStubIdGenerator() })).toEqual(post);
  });
});
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `corepack pnpm test:unit`
Expected: FAIL — import of `./v0-to-v1` unresolved.

- [ ] **Step 6: Commit**

```bash
git add apps/editor/test-fixtures/migrations apps/editor/src/scenario-migrations/v0-to-v1.test.ts
git commit -m "Add v0-to-v1 migration fixtures and failing test"
```

---

## Task 5: Implement v0→v1 migration

**Files:**
- Create: `apps/editor/src/scenario-migrations/v0-to-v1.ts`

- [ ] **Step 1: Implement the migration**

Create `apps/editor/src/scenario-migrations/v0-to-v1.ts`:

```ts
import { schemaIdentifier, currentSchemaVersion } from "../scenario";

export type MigrateV0ToV1Options = {
  generateId: () => string;
};

export function migrateV0ToV1(
  input: unknown,
  options: MigrateV0ToV1Options
): unknown {
  if (!isRecord(input)) {
    throw new Error("migrateV0ToV1: expected an object.");
  }

  const pieces = Array.isArray(input.pieces) ? input.pieces : [];
  const migratedPieces = pieces.map((piece) => migratePiece(piece, options));

  const output: Record<string, unknown> = {
    ...input,
    schema: schemaIdentifier,
    schemaVersion: currentSchemaVersion,
    pieces: migratedPieces
  };

  return output;
}

function migratePiece(
  piece: unknown,
  options: MigrateV0ToV1Options
): unknown {
  if (!isRecord(piece)) {
    return piece;
  }

  const label = typeof piece.id === "string" ? piece.id : "";
  const { id: _oldId, ...rest } = piece;

  return {
    ...rest,
    id: options.generateId(),
    label
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
```

Key points:

- Migration preserves field order approximately (`id` first, then `label`, then the rest via spread). Fixture JSON is formatted to match this order; Vitest `toEqual` ignores order but JSON review improves when the fields are stable.
- Unknown fields on pieces are preserved by the `...rest` spread. v1 validation rejects unknown shapes later, but migration should be additive.
- `generateId` is injected so the test can use a deterministic stub.

- [ ] **Step 2: Run tests**

Run: `corepack pnpm test:unit`
Expected: v0-to-v1 tests pass. Identity tests still pass.

- [ ] **Step 3: Confirm typecheck**

Run: `corepack pnpm --dir apps/editor exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/editor/src/scenario-migrations/v0-to-v1.ts
git commit -m "Implement v0-to-v1 scenario migration"
```

---

## Task 6: Migration registry and `loadScenario` entry point

**Files:**
- Create: `apps/editor/src/scenario-migrations/index.ts`
- Create: `apps/editor/src/scenario-migrations/index.test.ts`

- [ ] **Step 1: Write the failing registry tests**

Create `apps/editor/src/scenario-migrations/index.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CURRENT_SCHEMA_VERSION,
  loadScenario,
  loadScenarioWithMeta,
  ScenarioLoadError
} from "./index";

const fixturesDir = join(__dirname, "../../test-fixtures/migrations/v0-to-v1");

function readFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), "utf8");
}

describe("loadScenario", () => {
  it("loads a v1 payload directly", () => {
    const text = readFixture("post-tile.json");
    const scenario = loadScenario(text);
    expect(scenario.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(scenario.pieces[0]?.label).toBe("marker-2-1");
  });

  it("migrates a v0 payload (legacy composite schema string)", () => {
    const text = readFixture("pre-tile.json");
    const scenario = loadScenario(text);
    expect(scenario.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(scenario.pieces[0]?.label).toBe("marker-2-1");
    expect(scenario.pieces[0]?.id).toMatch(/^piece_[0-9A-Z]{6}$/);
  });

  it("rejects a future version with a readable error", () => {
    const future = JSON.stringify({
      schema: "fieldcraft.scenario",
      schemaVersion: 99,
      title: "from the future",
      space: null,
      assets: [],
      pieces: [],
      metadata: { editorVersion: "future", savedAt: null }
    });

    expect(() => loadScenario(future)).toThrowError(ScenarioLoadError);
    try {
      loadScenario(future);
    } catch (error) {
      expect(error).toBeInstanceOf(ScenarioLoadError);
      if (error instanceof ScenarioLoadError) {
        expect(error.kind).toBe("future-version");
        expect(error.message).toContain("99");
      }
    }
  });

  it("rejects invalid JSON", () => {
    try {
      loadScenario("{ not json");
      throw new Error("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ScenarioLoadError);
      if (error instanceof ScenarioLoadError) {
        expect(error.kind).toBe("invalid-json");
      }
    }
  });

  it("rejects non-scenario JSON", () => {
    try {
      loadScenario(JSON.stringify({ hello: "world" }));
      throw new Error("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ScenarioLoadError);
      if (error instanceof ScenarioLoadError) {
        expect(error.kind).toBe("not-a-scenario");
      }
    }
  });

  it("reports a migration side effect so callers can mark docs dirty", () => {
    const v0Text = readFixture("pre-tile.json");
    const v1Text = readFixture("post-tile.json");
    expect(loadScenarioWithMeta(v0Text).migrated).toBe(true);
    expect(loadScenarioWithMeta(v1Text).migrated).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `corepack pnpm test:unit`
Expected: FAIL — `./index` does not resolve yet.

- [ ] **Step 3: Implement the registry**

Create `apps/editor/src/scenario-migrations/index.ts`:

```ts
import { parseScenario, schemaIdentifier, type Scenario } from "../scenario";
import { generatePieceId } from "./identity";
import { migrateV0ToV1 } from "./v0-to-v1";

export const CURRENT_SCHEMA_VERSION = 1;

type MigrationStep = {
  from: number;
  to: number;
  migrate: (input: unknown) => unknown;
};

const migrations: readonly MigrationStep[] = [
  {
    from: 0,
    to: 1,
    migrate: (input) =>
      migrateV0ToV1(input, { generateId: () => generatePieceId(collectPieceIds(input)) })
  }
];

export type ScenarioLoadErrorKind =
  | "invalid-json"
  | "not-a-scenario"
  | "future-version"
  | "invalid-payload";

export class ScenarioLoadError extends Error {
  readonly kind: ScenarioLoadErrorKind;

  constructor(kind: ScenarioLoadErrorKind, message: string) {
    super(message);
    this.name = "ScenarioLoadError";
    this.kind = kind;
  }
}

export function loadScenario(text: string): Scenario {
  return loadScenarioWithMeta(text).scenario;
}

export function loadScenarioWithMeta(text: string): {
  scenario: Scenario;
  migrated: boolean;
} {
  const parsed = safeJsonParse(text);
  const version = detectSchemaVersion(parsed);

  if (version > CURRENT_SCHEMA_VERSION) {
    throw new ScenarioLoadError(
      "future-version",
      `This scenario was saved by a newer Fieldcraft editor (schema version ${version}). ` +
        `This editor understands up to version ${CURRENT_SCHEMA_VERSION}.`
    );
  }

  let payload: unknown = parsed;
  const migrated = version < CURRENT_SCHEMA_VERSION;
  for (let v = version; v < CURRENT_SCHEMA_VERSION; v += 1) {
    const step = migrations.find((entry) => entry.from === v);
    if (!step) {
      throw new ScenarioLoadError(
        "invalid-payload",
        `No migration registered from schema version ${v} to ${v + 1}.`
      );
    }
    payload = step.migrate(payload);
  }

  const scenario = parseScenario(JSON.stringify(payload));
  return { scenario, migrated };
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new ScenarioLoadError(
      "invalid-json",
      error instanceof Error ? error.message : "Could not parse JSON."
    );
  }
}

function detectSchemaVersion(value: unknown): number {
  if (!isRecord(value)) {
    throw new ScenarioLoadError("not-a-scenario", "Input is not a JSON object.");
  }

  if (value.schema === schemaIdentifier && typeof value.schemaVersion === "number") {
    if (!Number.isInteger(value.schemaVersion) || value.schemaVersion < 0) {
      throw new ScenarioLoadError(
        "not-a-scenario",
        "schemaVersion must be a non-negative integer."
      );
    }
    return value.schemaVersion;
  }

  if (value.schema === "fieldcraft.scenario.v0") {
    return 0;
  }

  throw new ScenarioLoadError(
    "not-a-scenario",
    "Input is not a Fieldcraft scenario (missing or unrecognized schema)."
  );
}

function collectPieceIds(input: unknown): Set<string> {
  const ids = new Set<string>();
  if (!isRecord(input) || !Array.isArray(input.pieces)) {
    return ids;
  }
  for (const piece of input.pieces) {
    if (isRecord(piece) && typeof piece.id === "string") {
      ids.add(piece.id);
    }
  }
  return ids;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
```

Note: this module reuses `parseScenario` from `scenario.ts` — `parseScenario` validates the v1 payload shape after migration. A `throw` in `parseScenario` maps to `invalid-payload` via a wrapper below.

- [ ] **Step 4: Wrap `parseScenario` throws as `invalid-payload`**

Wrap the `parseScenario` call in `loadScenarioWithMeta` with a try/catch:

Replace:
```ts
const scenario = parseScenario(JSON.stringify(payload));
return { scenario, migrated };
```

With:
```ts
let scenario: Scenario;
try {
  scenario = parseScenario(JSON.stringify(payload));
} catch (error) {
  throw new ScenarioLoadError(
    "invalid-payload",
    error instanceof Error ? error.message : "Payload failed v1 validation."
  );
}
return { scenario, migrated };
```

- [ ] **Step 5: Run tests**

Run: `corepack pnpm test:unit`
Expected: all registry tests pass.

- [ ] **Step 6: Typecheck**

Run: `corepack pnpm --dir apps/editor exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/editor/src/scenario-migrations/index.ts apps/editor/src/scenario-migrations/index.test.ts
git commit -m "Add migration registry and loadScenario entry point"
```

---

## Task 7: Route editor load paths through `loadScenario`

**Files:**
- Modify: `apps/editor/src/main.ts`

- [ ] **Step 1: Find every current call to `parseScenario`**

Run Grep with pattern `parseScenario` over `apps/editor/src`. Each call site is a load path: file-open, source-editor apply, draft-recovery. Confirm the call sites (there are typically three).

- [ ] **Step 2: Import `loadScenarioWithMeta` and `ScenarioLoadError`**

In `apps/editor/src/main.ts`, update the import from `"./scenario"` to continue to import the types and constants, and add:

```ts
import {
  loadScenarioWithMeta,
  ScenarioLoadError
} from "./scenario-migrations";
```

- [ ] **Step 3: Replace each `parseScenario(text)` call with `loadScenarioWithMeta(text)`**

For each load path:

- File-open handler: catch `ScenarioLoadError` and surface its `.message` in the status line / file-dialog error (use the existing error-surfacing helper; preserve its shape).
- Source-editor apply: catch and place the error in the existing source diagnostics slot.
- Draft-recovery on load: if `loadScenarioWithMeta` throws, discard the draft with a status message matching today's "Draft could not be recovered" wording.

For each call, capture `{ scenario, migrated }` and:

- Assign `scenario` where the previous `parseScenario` result was assigned.
- If `migrated === true`, mark the document dirty via the existing dirty-flag helper (search for where loads currently reset dirty state — invert or skip the reset when migrated).

Pseudo-example for one path:

```ts
try {
  const { scenario: loaded, migrated } = loadScenarioWithMeta(text);
  applyLoadedScenario(loaded);
  if (migrated) {
    markDocumentDirty();
    statusMessage = "Scenario upgraded to current format. Save to keep the changes.";
  } else {
    clearDocumentDirty();
  }
} catch (error) {
  if (error instanceof ScenarioLoadError) {
    statusMessage = error.message;
    render();
    return;
  }
  throw error;
}
```

- [ ] **Step 4: Keep the direct `parseScenario` call on save output paths if any exist**

Search for `parseScenario` after the changes above. Any remaining caller must be on the save/round-trip side, where input is known to be v1. Leave those alone.

- [ ] **Step 5: Typecheck + unit tests**

```bash
corepack pnpm --dir apps/editor exec tsc --noEmit
corepack pnpm test:unit
```

Expected: both pass.

- [ ] **Step 6: Manually verify in the browser editor**

```bash
corepack pnpm start
```

Open http://127.0.0.1:5173/, exercise the editor, and stop:

```bash
corepack pnpm stop
```

This is a manual sanity check that the load-path wiring didn't regress. Full smoke comes later.

- [ ] **Step 7: Commit**

```bash
git add apps/editor/src/main.ts
git commit -m "Route editor load paths through loadScenario"
```

---

## Task 8: New-placement uses `generatePieceId`, delete `createMarkerId`

**Files:**
- Modify: `apps/editor/src/main.ts`

- [ ] **Step 1: Replace `createMarkerId` call with generator**

In `placeDefaultMarker` (around `main.ts:1449`):

```ts
function placeDefaultMarker(x: number, y: number): void {
  if (!scenario.space) {
    return;
  }

  const existingIds = new Set(scenario.pieces.map((piece) => piece.id));
  const markerId = generatePieceId(existingIds);

  commitUndoableChange("marker placement", "Marker placed", () => {
    scenario = {
      ...scenario,
      pieces: [
        ...scenario.pieces,
        {
          id: markerId,
          label: "",
          kind: "marker" as const,
          side: "neutral" as const,
          x,
          y
        }
      ]
    };
    selectedMarkerId = markerId;
  });
}
```

- [ ] **Step 2: Import `generatePieceId`**

Add to the imports at the top of `main.ts`:

```ts
import { generatePieceId } from "./scenario-migrations/identity";
```

- [ ] **Step 3: Delete `createMarkerId` and `formatCoordinateForId`**

In `main.ts`, delete both functions (currently `main.ts:2733-2753`):

```ts
function createMarkerId(x: number, y: number, pieces: Scenario["pieces"]): string { ... }
function formatCoordinateForId(value: number): string { ... }
```

Search for any residual callers. The plan expects zero.

- [ ] **Step 4: Typecheck**

Run: `corepack pnpm --dir apps/editor exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual spot-check**

Run `corepack pnpm start`, drop a marker, confirm its id looks like `piece_XXXXXX` by inspecting the saved JSON or the source-editor pane. Stop the server.

- [ ] **Step 6: Commit**

```bash
git add apps/editor/src/main.ts
git commit -m "Use opaque id generator for new marker placement"
```

---

## Task 9: Inspector — label field + read-only id disclosure

**Files:**
- Modify: `apps/editor/src/main.ts`
- Modify: `apps/editor/src/styles.css` (if new style needed for the disclosure)

- [ ] **Step 1: Replace `createMarkerIdInput` with label + id disclosure**

In `main.ts` (currently `createMarkerIdInput` at `main.ts:834`):

```ts
function createMarkerLabelInput(selectedMarker: Scenario["pieces"][number]): HTMLElement {
  const field = textInput(
    "Label",
    selectedMarker.label,
    "selected-marker-label-input"
  );
  field.input.placeholder = "Name this marker";
  field.input.addEventListener("change", () =>
    updateSelectedMarkerLabel(field.input.value)
  );
  return field.label;
}

function createMarkerIdDisclosure(
  selectedMarker: Scenario["pieces"][number]
): HTMLElement {
  const details = element("details", "inspector-disclosure");
  const summary = element("summary", "inspector-disclosure-summary", "Show id");
  const value = element("code", "inspector-id-value", selectedMarker.id);
  value.dataset.testid = "selected-marker-id";
  details.append(summary, value);
  return details;
}
```

And update the caller (`createSelectedMarkerSection`, around `main.ts:825`):

```ts
section.append(
  createMarkerLabelInput(selectedMarker),
  createMarkerIdDisclosure(selectedMarker),
  metric("Position", getMarkerPositionLabel(selectedMarker), "selected-marker-position"),
  metric("Kind", "Marker", "selected-marker-kind")
);
```

- [ ] **Step 2: Replace `updateSelectedMarkerId` with `updateSelectedMarkerLabel`**

Replace the `updateSelectedMarkerId` function (`main.ts:1395`) with:

```ts
function updateSelectedMarkerLabel(value: string): void {
  const selectedMarker = getSelectedMarker();
  if (!selectedMarker) {
    return;
  }

  const nextLabel = value;
  if (nextLabel === selectedMarker.label) {
    return;
  }

  commitUndoableChange("marker label edit", "Marker label updated", () => {
    scenario = {
      ...scenario,
      pieces: scenario.pieces.map((piece) =>
        piece.id === selectedMarker.id ? { ...piece, label: nextLabel } : piece
      )
    };
  });
}
```

Key changes vs. the old id editor:

- No uniqueness check — labels are non-unique by design.
- Empty string is accepted.
- Selection tracks ids, not labels, so `selectedMarkerId` does not move.

- [ ] **Step 3: Add minimal styles for the disclosure**

Append to `apps/editor/src/styles.css`:

```css
.inspector-disclosure {
  margin: 6px 0 10px 0;
  font-size: 12px;
  color: var(--fg-muted, #536576);
}

.inspector-disclosure-summary {
  cursor: pointer;
  user-select: none;
}

.inspector-id-value {
  display: inline-block;
  padding: 2px 6px;
  margin-left: 6px;
  background: var(--code-bg, #f0f3f5);
  border-radius: 3px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 11px;
}
```

If those CSS variables don't exist in the theme, fall back to literal colors that match the existing palette (check the top of `styles.css` for the current tokens and use analogous ones).

- [ ] **Step 4: Typecheck**

Run: `corepack pnpm --dir apps/editor exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual spot-check**

Run `corepack pnpm start`, drop a marker, select it, confirm:
- Inspector shows a **Label** input (empty by default, placeholder visible).
- Disclosure "Show id" reveals the `piece_XXXXXX` id as read-only text.
- Typing into the label field and pressing enter / blurring commits the change.
- Two markers can share the same label.
- Undo/redo cycles the label edit.

Stop the server.

- [ ] **Step 6: Commit**

```bash
git add apps/editor/src/main.ts apps/editor/src/styles.css
git commit -m "Inspector edits label; id surfaced read-only"
```

---

## Task 10: Update smoke fixtures and id-based assertions

**Files:**
- Modify: `scripts/test-browser-smoke.mjs`

- [ ] **Step 1: Bump every in-memory scenario fixture to v1**

Search `scripts/test-browser-smoke.mjs` for the string `"fieldcraft.scenario.v0"`. Each hit is inside a fixture-builder function (e.g. `createMenuOpenFixture`, `createOversizedGridFixture`, `createDuplicateMarkerIdFixture`, and similar).

**Important:** these fixtures exist to test the v1 editor, not to test migration. They should all be *born as v1* (so the editor consumes them without running migration, which would reassign ids and defeat the duplicate-id test). The v0-upgrade path is covered separately in Task 11 by a dedicated v0 fixture.

For **each fixture builder**:

- Replace `"schema": "fieldcraft.scenario.v0"` with `"schema": "fieldcraft.scenario"`, `"schemaVersion": 1`.
- For each piece, preserve the existing `id` value as the new `label`, and assign a fresh opaque-style id (use a fixed stub for fixtures that don't collide with each other, e.g. `piece_FIXT01`, `piece_FIXT02`, …).
- For `createDuplicateMarkerIdFixture` specifically: the whole point is two pieces sharing the **same `id`**. Keep the collision on `id`, not on `label`. Labels can be unique or not; the fixture exercises the `validateUniquePieceIds` path.
- Keep the old position fields (`x`, `y`) untouched.
- Keep `kind`, `side` untouched.

Example transformation of one fixture object:

```js
// Before
{
  schema: "fieldcraft.scenario.v0",
  pieces: [
    { id: "marker-2-1", kind: "marker", side: "neutral", x: 2, y: 1 }
  ],
  // ...
}

// After
{
  schema: "fieldcraft.scenario",
  schemaVersion: 1,
  pieces: [
    { id: "piece_FIXT01", label: "marker-2-1", kind: "marker", side: "neutral", x: 2, y: 1 }
  ],
  // ...
}
```

- [ ] **Step 2: Change id-based piece assertions to label-based**

Search for `piece.id ===` inside the smoke script. Each assertion checks that a specific piece survived a round trip. Convert each to `piece.label ===` with the same string:

```js
// Before
!parsedFirstRecoveredSave.pieces.some((piece) => piece.id === "marker-2-1")

// After
!parsedFirstRecoveredSave.pieces.some((piece) => piece.label === "marker-2-1")
```

Confirm: every id-based assertion that exists today has an obvious label analog (because the fixture's `id` value becomes the same-string `label`).

- [ ] **Step 3: Update the selected-marker id-input interactions to target label input**

Search for `selected-marker-id-input` in the smoke script. The hits are places where the test:
- Reads the selected marker's id (line ~1821): change to `selected-marker-label-input`.
- Types a new id to rename a marker (line ~1878, ~1885): change to `selected-marker-label-input`; update the assertion that follows to check `piece.label` instead of `piece.id`.

If a test relied on the post-rename `piece.id` being the typed value (previously true because editing id renamed id), switch to post-rename `piece.label` being the typed value.

- [ ] **Step 4: Run the smoke test**

```bash
corepack pnpm test:smoke
```

Expected: pass end to end. If a failure surfaces, it is almost certainly:
- An id-based assertion missed in Step 2.
- A fixture builder that still uses v0 shape.
- A testid still using the old `selected-marker-id-input`.

Fix the gap and re-run. Do not add coverage; just match the pre-existing assertions to the new shape.

- [ ] **Step 5: Commit**

```bash
git add scripts/test-browser-smoke.mjs
git commit -m "Migrate smoke fixtures to v1 and switch id assertions to labels"
```

---

## Task 11: Smoke test for v0-file-upgrade-on-open

**Files:**
- Modify: `scripts/test-browser-smoke.mjs`

- [ ] **Step 1: Add a v0 fixture builder**

Near the top of the smoke test (alongside `createMenuOpenFixture` etc.), add:

```js
function createLegacyV0Fixture() {
  return JSON.stringify(
    {
      schema: "fieldcraft.scenario.v0",
      title: "Legacy upgrade sample",
      space: {
        type: "square-grid",
        width: 4,
        height: 3,
        tileSize: 48,
        scale: { distancePerTile: 1, unit: "tile" },
        grid: { lineColor: "#aeb8c1", lineOpacity: 1 },
        background: { color: "#f9fbfb" }
      },
      assets: [],
      pieces: [
        { id: "marker-0-0", kind: "marker", side: "neutral", x: 0, y: 0 },
        { id: "scout-alpha", kind: "marker", side: "neutral", x: 2, y: 1 }
      ],
      metadata: { editorVersion: "0.1.0-experiment", savedAt: "2026-03-01T00:00:00.000Z" }
    },
    null,
    2
  );
}
```

And near the other fixture writes:

```js
const legacyV0FixturePath = path.join(smokeDir, "legacy-v0-scenario.fieldcraft.json");
fs.writeFileSync(legacyV0FixturePath, createLegacyV0Fixture(), "utf8");
```

- [ ] **Step 2: Add a new smoke case**

Inside the main smoke flow, after the existing fixture-open cases (search for where `menuOpenFixturePath` is consumed and mirror the pattern):

```js
// v0 upgrade-on-open
await openScenarioFromPath(page, legacyV0FixturePath);
await page.waitForSelector('[data-view="editor"]');
await expectStatusLine(page, "Scenario upgraded to current format. Save to keep the changes.");

// Labels preserved from old ids
const selectedAfterOpen = await page.evaluate(() =>
  Array.from(document.querySelectorAll('[data-testid="palette-marker"]')).length
);
// (adjust the query above to match the assertions used for other scenarios
// — position-based `data-marker-positions` checks are sufficient)

await waitForMarker(page, "board-surface", "0-0");
await waitForMarker(page, "board-surface", "2-1");

// Save, re-read file, assert v1 on disk
await page.click('[data-testid="save-scenario"]');
await expectStatusLine(page, "Scenario saved");

const upgradedOnDisk = JSON.parse(fs.readFileSync(legacyV0FixturePath, "utf8"));
if (upgradedOnDisk.schema !== "fieldcraft.scenario" || upgradedOnDisk.schemaVersion !== 1) {
  throw new Error("Saved scenario did not write v1 schema.");
}
if (!upgradedOnDisk.pieces.every((p) => typeof p.label === "string" && /^piece_[0-9A-Z]{6}$/.test(p.id))) {
  throw new Error("Saved scenario pieces missing label/opaque id.");
}
```

Adapt the exact helper names to match existing smoke helpers (`openScenarioFromPath` is illustrative — check for the helper used by `menuOpenFixturePath` and reuse it verbatim).

- [ ] **Step 3: Run the full smoke test**

```bash
corepack pnpm test:smoke
```

Expected: pass end to end, including the new case.

- [ ] **Step 4: Commit**

```bash
git add scripts/test-browser-smoke.mjs
git commit -m "Smoke test: v0 scenario upgrades on open and saves as v1"
```

---

## Task 12: Full verification + docs update

**Files:**
- Modify: `PLAN.md`
- Modify: `README.md` (one-line mention of `pnpm test:unit`)

- [ ] **Step 1: Run the full build and test matrix**

```bash
corepack pnpm --dir apps/editor exec tsc --noEmit
corepack pnpm test:unit
corepack pnpm build
corepack pnpm test:smoke
```

Expected: all four pass.

- [ ] **Step 2: Manual desktop smoke (release-significant per decision 009)**

Walk the checklist in `DESKTOP-TESTING.md` on the desktop build:

```bash
corepack pnpm desktop
```

Focus on load paths touched by this slice:
- Open a v0 file saved before this slice (if one exists on disk). Verify the upgrade message appears, the file is dirty, save writes v1.
- Open a v1 file saved after this slice. Verify no dirty flag.
- Import an image asset and save; confirm bundle still round-trips.
- Export a runtime bundle and confirm it opens correctly in a browser.

Record any deviation. Expect none.

- [ ] **Step 3: Update `PLAN.md`**

In `PLAN.md`:

- Move the `codex/scenario-format-hardening` bullet from "Near-Term Branch Sequence" to "Recently Completed Baseline Slices" with a short what-changed description:

```md
- `codex/scenario-format-hardening`
  - Scenario file shape is now `schema: "fieldcraft.scenario"` + `schemaVersion: 1`; pieces carry an opaque `id` (generator output) plus an author-facing `label`.
  - Migration registry ships as `apps/editor/src/scenario-migrations/`, chained per adjacent version; v0 files upgrade on open, dirty the doc, and save as v1.
  - Forward-version files hard-reject with a readable error at every load surface.
  - First unit test runner (Vitest) lives in the editor workspace; migrations have pre/post fixture tests in addition to the browser smoke.
```

- Prune any deferred items this slice closed (review "Scenario source and packaging" and "Boards, space, and scale" bullets — most stay, but double-check for item overlap).
- Update the Current Focus paragraph if the list of baseline capabilities needs the new line about format/migration hardening.

- [ ] **Step 4: Update `README.md`**

Under the Development / Browser Testing section, near the existing `test:smoke` paragraph, add:

```md
Run unit tests (migration and identity modules):

\`\`\`sh
corepack pnpm test:unit
\`\`\`
```

- [ ] **Step 5: Commit docs**

```bash
git add PLAN.md README.md
git commit -m "Document scenario format v1 and migration baseline"
```

- [ ] **Step 6: Push and open a PR**

```bash
git push -u origin codex/scenario-format-hardening
gh pr create --title "Scenario format hardening (v1)"
```

PR body: reference the spec at `docs/superpowers/specs/2026-04-18-scenario-format-hardening-design.md` and summarize the three user-visible changes (opaque ids + label, schema/version split, auto-upgrade on open). Include the desktop-smoke notes from Step 2 in the test plan.

---

## Self-review notes

Checked against the spec sections in order:

- **Format at rest v1** → Task 3, 4, 5, 6 (types, fixtures, migration, registry).
- **Piece id generation** → Task 2 (generator + alphabet + retry) and Task 8 (placement uses it).
- **Label semantics** → Task 3 (type), Task 4 (migration copies old id → label), Task 8 (empty on placement), Task 9 (inspector edits label, non-unique accepted).
- **Migration contract: registry shape / version detection / side effects / forward incompat / missing version / testing** → Task 6 (registry), Task 7 (dirty-on-migrate), Task 4/5 (fixture testing).
- **Module layout** → Task 2, 5, 6 (three files in `scenario-migrations/`).
- **Error surface** → Task 6 (ScenarioLoadError) and Task 7 (wired into file/source/draft paths).
- **Editor behavior changes** → Tasks 7, 8, 9.
- **Smoke test churn** → Task 10.
- **Success criteria** → Task 12 (build + all test runners + manual desktop).

No placeholders (no TBD/TODO/etc.). Types are consistent across tasks: `Scenario`, `ScenarioPiece` with `label: string`, `schemaIdentifier`, `currentSchemaVersion` (module-level consts) and `CURRENT_SCHEMA_VERSION` (registry const — deliberate distinction: one is the scenario module's shape pin, the other is the registry's chain-terminator). Both are `1` throughout this slice; if that duplication bothers the engineer, consolidate in a follow-up refactor — it does not block the plan.
