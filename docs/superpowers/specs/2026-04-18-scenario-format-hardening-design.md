# Scenario Format Hardening — Design

Branch: `codex/scenario-format-hardening`
Date: 2026-04-18

## Goal

Before any more scenario-format pressure lands, pay two debts:

1. **Separate durable piece identity from author-facing labels**, so renaming never breaks identity references and coordinate-derived ids like `marker-3-5` don't calcify into the long-term format.
2. **Make versioning and migration explicit**, so future format changes can ship without ad-hoc per-file surgery.

This slice ships the contract *and* the first real migration that exercises it (`v0 → v1`). No contract-without-a-migration — that drifts.

## Non-goals

- Asset id rework. `ScenarioAsset.id` stays a free-form string; the asset-library follow-on slice owns that.
- Any other payload changes beyond the piece `id`/`label` split. No opportunistic field renames, no metadata restructuring.
- A scenario-format migration CLI. Migration runs in-editor on load; no standalone tool.
- A richer inspector for pieces beyond the `label` edit + read-only `id` disclosure.

## Format at rest

### v0 (current, on disk today)

```json
{
  "schema": "fieldcraft.scenario.v0",
  "title": "...",
  "space": { ... },
  "assets": [ ... ],
  "pieces": [
    { "id": "marker-3-5", "kind": "marker", "side": "neutral", "x": 3, "y": 5 }
  ],
  "metadata": { "editorVersion": "0.1.0-experiment", "savedAt": "..." }
}
```

### v1 (this slice)

```json
{
  "schema": "fieldcraft.scenario",
  "schemaVersion": 1,
  "title": "...",
  "space": { ... },
  "assets": [ ... ],
  "pieces": [
    {
      "id": "piece_7A3fK2",
      "label": "scout alpha",
      "kind": "marker",
      "side": "neutral",
      "x": 3,
      "y": 5
    }
  ],
  "metadata": { "editorVersion": "...", "savedAt": "..." }
}
```

Two format-level changes:

- **Identifier/version split.** `schema` becomes the stable identifier string (`"fieldcraft.scenario"`). The integer version lives in its own field `schemaVersion`. This lets migrations and forward-incompat checks key off a number rather than parsing a composite string. Future migrations never touch `schema`.
- **Piece identity split.** `id` becomes an opaque short-random token (format: `piece_` prefix + 6 characters base32, e.g. `piece_7A3fK2`). `label` is free-form author text, optional (`""` allowed), non-unique across pieces.

## Piece id generation

- Format: `piece_` + 6 characters drawn from the Crockford base32 alphabet (`0123456789ABCDEFGHJKMNPQRSTVWXYZ`, avoiding `I`, `L`, `O`, `U`).
- Source of randomness: `crypto.getRandomValues(new Uint8Array(...))`. No external dep.
- Collision handling: generation is retry-on-collision within the current scenario's id set. Collision probability at any scenario author will plausibly hit is vanishingly small; retry is cheap insurance, not a hot path.
- Ids are **never reused** within a scenario, **never mutated** after assignment (not on move, not on rename, not on save).
- Authors do not type ids. The inspector shows the id read-only, behind a "Show id" disclosure. The source editor still lets authors hand-edit JSON, so hand-typed ids are possible there; same validation rules apply (non-empty string, unique within the scenario).

### Why 6 chars of base32 and not UUID / nanoid

- Review-readability: six chars stays scannable in the source-editor pane. UUID (36 chars) dominates the line.
- No dependency: `crypto.getRandomValues` is available in both browser and Tauri contexts.
- Collision surface: with six base32 characters (~30 bits) and scenarios realistically holding <10k pieces, within-file collision is irrelevant. Across-file collision doesn't matter — ids are scoped to a scenario file.

## Label semantics

- Optional. `""` is valid and meaningful ("unnamed").
- Non-unique. Two pieces may share a label (`"infantry"`, `"infantry"`). Uniqueness is an identity property, and that's what `id` is for.
- Free-form UTF-8 string, same length bounds as existing author-facing strings (no new cap introduced by this slice; if the editor grows a cap, it applies uniformly).
- Default on **new placement**: `""`. The inspector field shows placeholder text prompting a name; leaving it blank is fine.
- Default on **v0→v1 migration**: the old `id` string verbatim. A piece saved as `{ "id": "scout-alpha" }` becomes `{ "id": "piece_XXXXXX", "label": "scout-alpha" }`. Author renames survive as labels; author-visible continuity is preserved.

## Migration contract

### Registry shape

```ts
type SchemaVersion = number;
const CURRENT_SCHEMA_VERSION: SchemaVersion = 1;

type Migration = {
  from: SchemaVersion;
  to: SchemaVersion; // always from + 1
  migrate: (input: unknown) => unknown;
};

const migrations: readonly Migration[] = [
  { from: 0, to: 1, migrate: migrateV0ToV1 }
];
```

Each migration is a pure function that takes the previous version's validated shape and returns the next version's shape. Each migration is tested in isolation.

### Version detection

On file open / source apply / draft recovery, the parse pipeline is:

1. `JSON.parse` the string (line/col error preserved as today).
2. **Detect declared version**:
   - If input has `schemaVersion` as a finite integer ≥ 0 → that's the version.
   - Else if input has `schema === "fieldcraft.scenario.v0"` and no `schemaVersion` → version `0` (legacy composite identifier).
   - Else → reject as "not a Fieldcraft scenario."
3. **Version bounds check**:
   - If version > `CURRENT_SCHEMA_VERSION` → reject: `"This scenario was saved by a newer Fieldcraft editor (schema version N). Update Fieldcraft to open it."`
   - If version < 0 or non-integer → reject as not-a-scenario.
4. **Chain migrations** from declared version to `CURRENT_SCHEMA_VERSION`, running each adjacent step. `v0 → v1 → v2 → ...` (today only `v0 → v1`).
5. **Validate** the resulting payload against the current validator (`parseScenarioValue` + invariants).

### Migration side effects

- Migration is pure on the data. It does not write to disk, not to storage, not to logs other than a status message.
- When any migration runs during a load path, the loaded document is marked **dirty**. The author's normal save flow writes the `v1` payload. Close-without-save goes through the existing unsaved-changes prompt.
- Rationale: reading a file never mutates disk. Upgrading is an author-controlled save. This matches option C from brainstorming Q5.

### Forward incompatibility

Hard reject with a readable error naming the version gap. No best-effort parse of future-version files. Surfaces:

- File open dialog → error toast / status message.
- Source editor apply → inline error in the existing diagnostics slot.
- Draft recovery → draft is discarded with a status message.

### Missing/malformed version field

After v0's sunset window (not this slice), a missing or non-integer `schemaVersion` is treated as not-a-scenario. During v0 sunset, the legacy composite `schema: "fieldcraft.scenario.v0"` is still honored (see Version detection step 2).

### Testing contract

Each migration ships with a fixture pair and a unit test:

- `apps/editor/test-fixtures/migrations/v{N}-to-v{N+1}/pre.json`
- `apps/editor/test-fixtures/migrations/v{N}-to-v{N+1}/post.json`
- Automated test that runs the migration over `pre.json` and deep-equals `post.json`, with a seam for opaque-id generation replaced by a deterministic stub (so the test is stable).

For `v0 → v1`, the fixture covers at least:

- A tile scenario with multiple pieces, including an author-renamed id (not coordinate-encoded).
- A free-coordinate scenario with decimal / negative positions (the hardest current id-format cases).
- A scenario with an asset reference intact.
- A scenario with no pieces.

The smoke test suite gets a parallel set of fixtures migrated and re-saved to exercise the browser load path end to end.

## Module layout

New module: `apps/editor/src/scenario-migrations/`

- `index.ts` — exports `migrateScenario(unknown) => Scenario` or throws with a tagged error type; holds the `migrations` registry and the version-detection logic.
- `v0-to-v1.ts` — pure function `migrateV0ToV1(v0Input) => v1Input`. Uses a seam `{ generateId: () => string }` dependency so tests pass a deterministic stub.
- `identity.ts` — `generatePieceId()` and the base32 alphabet. Lives here so both runtime placement and migration import the same generator.

Existing `scenario.ts`:

- `parseScenario` becomes the "validate a v1 payload" function; it no longer guesses at the schema string.
- A new entry point `loadScenario(input: string)` runs: JSON.parse → `migrateScenario` → `parseScenario`. File-open, source-apply, and draft-recovery all call `loadScenario` instead of `parseScenario` directly. The existing `parseScenario` export is kept for callers that already have a parsed JS value.
- Constants split: `schemaIdentifier = "fieldcraft.scenario"`, `currentSchemaVersion = 1`. The existing `scenarioSchema` export is deleted (call sites updated); composite-string handling lives only in version detection.

Error surface:

- Add a tagged error type (`ScenarioLoadError` with discriminant: `"not-a-scenario" | "future-version" | "invalid-payload" | "invalid-json"`). Callers map to their existing UI slots (file dialog, source-editor diagnostics, draft recovery).

## Editor behavior changes

- **Inspector.** The current "Marker ID" input becomes a "Label" input (`selected-marker-label-input` testid). A disclosure toggle reveals the read-only id (`selected-marker-id` testid).
- **Placement.** `placeDefaultMarker` calls `generatePieceId()` instead of the coordinate-derived `createMarkerId`. `createMarkerId` and `formatCoordinateForId` are deleted.
- **Duplicate-id validation.** Source-editor validation continues to reject duplicate ids (authors editing by hand could produce collisions). The runtime generator's retry-on-collision handles placement.
- **Manual id shape.** The source editor does *not* enforce the `piece_XXXXXX` format on hand-edited ids. Any non-empty, unique string is accepted. Rationale: the opaque format is the *generator's* output, not a format-wide invariant. Authors hand-editing JSON retain that flexibility; the validator only enforces identity (non-empty, unique) and field presence.
- **Metadata.** `metadata.editorVersion` is untouched by migration — it records which editor *saved* the file, and migration isn't a save. The next save updates `editorVersion` and `savedAt` as it does today.
- **Draft autosave.** Drafts are stored in the current (v1) format. On recovery, if an older-version draft shows up, it goes through the same migration pipeline.
- **Undo/redo.** Label edits are undoable (already the case for id edits today). Migration itself is *not* an undoable action — it happens before the document enters the editor's history stack.

## Out-of-scope files in this repo

The smoke test (`scripts/test-browser-smoke.mjs`) constructs v0 scenarios inline (`"schema": "fieldcraft.scenario.v0"`). Those fixtures update to v1 shape. A small parallel set of literal v0 fixtures stays in the migrations test suite (not the smoke test) to exercise the load path.

The runtime export (`apps/editor/src/runtime-export/browser-runtime.js`) reads the already-parsed scenario out of the bundle — no change to the runtime's parser, but the export path needs to confirm it writes v1-shaped payloads (which it does automatically once the editor's save output is v1).

## Risks

- **Forward-compat rejection messaging.** If we later ship a non-breaking `v2`, authors on an older editor still get the hard-reject. That's the cost of the hard-reject model; we accept it because "mostly works but subtly wrong" is worse. Re-evaluate when we have a concrete `v2` change that could plausibly be forward-compatible.
- **Opaque id generation randomness.** `crypto.getRandomValues` is available in both Tauri WebView and browser. Guarded at module load with a clear error if unavailable.
- **Smoke test churn.** Every fixture in `scripts/test-browser-smoke.mjs` updates. Mechanical churn, but large diff. Mitigated by touching it once with search-and-replace semantics.

## Success criteria

- New scenarios save with `schema: "fieldcraft.scenario"`, `schemaVersion: 1`, opaque piece ids, and `label` fields.
- Opening a `v0` file loads into the editor with labels equal to the prior ids, marks the document dirty, and saves cleanly as `v1`.
- `v0 → v1` migration fixture test passes.
- Forward-incompat files (hand-crafted `schemaVersion: 99`) show the expected error at every load surface.
- Browser smoke passes end to end on v1 scenarios.
- Desktop smoke checklist items still apply (file commands, asset import, export) — no regressions expected, but this slice touches the open path so the full desktop pass is required.

## Deferred

Tracked here, not in PLAN.md, until this slice lands:

- Asset id opaque-izing and asset labels — picked up by `codex/asset-library-follow-ons`.
- Label length limits / character validation — if authoring shows a need.
- Migration tooling outside the editor (CLI, batch upgrade) — unclear need; revisit if repo-scale scenario corpora appear.
