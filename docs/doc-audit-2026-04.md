# Documentation Audit — April 2026

## Summary

Twenty-one findings across the project's top-level docs and the redesign bundle. The dominant theme is redesign drift: `docs/redesign/BRIEF.md` (PR #13) and `codex/design-tokens-foundation` (PR #14) have landed since `PLAN.md` was last touched, and `PLAN.md`'s Current Focus and Near-Term Branch Sequence have not been reconciled with either. The second theme is feature-summary drift in `README.md`: the Current Baseline paragraph reads like a snapshot from several slices ago and omits shipped capabilities that `PLAN.md` and the code confirm. The third theme is missing commitments: BRIEF.md treats nine architectural items as settled, and scenario format v2 introduced load-bearing contracts (opaque piece ids, migration registry, forward-version rejection), but none of these are in `DECISIONS.md`.

No outright contradictions were found where two docs make mutually exclusive claims about the same feature. Several near-contradictions exist where one doc's description is a subset or softened version of another's.

## Part 1 — Factual consistency

### Stale assertions

**1. `PLAN.md`:76 — "next branch is a no-code redesign planning pass" is no longer true.**
The sentence "The next branch is intentionally a no-code redesign planning and ideation pass before more editor surface area lands" is stale. That planning work shipped via `codex/redesign-bundle` (commit `6c38bee`, PR #13), producing `docs/redesign/BRIEF.md` and the reference bundle. The first implementation branch from BRIEF.md (`codex/design-tokens-foundation`, PR #14) has also landed and is already listed in `PLAN.md`'s Recently Completed. Severity: **drift**.

**2. `README.md`:9-18 — Current Baseline omits several shipped capabilities.**
README lists eight bullets: square/hex/free-coordinate boards, marker placement, in-app JSON editing, desktop save/open, desktop image/audio import, marker artwork, read-only runtime view, browser export with bundled assets. It does not mention: undo/redo (`main.ts:90,362-373`), System/Light/Dark theme persistence (`main.ts:149,161,253-258`), the command registry for file actions (`main.ts:146`), viewport pan/zoom/reset (surfaced in `PLAN.md`:9), draft-recovery autosave (`main.ts:150,2426`), or the v2 scenario format with opaque piece ids and the migration registry (`apps/editor/src/scenario-migrations/index.ts`, `scenario.ts:7`). `PLAN.md`:9 covers all of these. Severity: **drift**.

**3. `README.md`:288-293 — Docs list omits the redesign spec.**
The Docs section lists `AGENTS.md`, `DECISIONS.md`, `PLAN.md`, `DESKTOP-TESTING.md` but does not list `docs/redesign/BRIEF.md` or `docs/redesign/reference/README.md`. BRIEF.md is a durable spec (per its own line 1, "Durable reference for the editor UX/UI redesign"). Severity: **drift**.

**4. `AGENTS.md`:127 — Redesign-docs bullet is filed under the wrong heading.**
The bullet "`docs/redesign/BRIEF.md` is the durable spec for the editor UX/UI redesign; `docs/redesign/reference/` contains the mockup bundle it references" is the last line of the `## Release testing` section. The `## Docs` section (lines 86-95) is where AGENTS.md otherwise enumerates doc ownership — that's where this bullet belongs. Severity: **drift**.

**5. `docs/redesign/BRIEF.md`:7 — main.ts line/function counts have already drifted.**
BRIEF.md states "main.ts reached 3,338 lines and 152 functions". Actual at audit time: 3,318 lines (`wc -l apps/editor/src/main.ts`). Function count depends on counting method (134 top-level `function` keywords; higher if arrow-function consts are included). The specific numbers were true when BRIEF.md was written but will drift with every non-trivial main.ts edit. Severity: **drift-risk**.

**6. `DESKTOP-TESTING.md`:36,56 — `/tmp/fieldcraft-desktop-smoke/` is Linux-specific phrasing.**
The doc says "Use the automated smoke artifacts under `/tmp/fieldcraft-desktop-smoke/`" and "Open any saved smoke scenario from `/tmp/fieldcraft-desktop-smoke/package-a/`". `scripts/test-desktop-smoke.mjs:25` uses `os.tmpdir()`, which is `/tmp` on Linux but `/var/folders/...` on macOS and `C:\Users\<user>\AppData\Local\Temp` on Windows. A macOS or Windows tester following the doc literally will not find the directory. Severity: **drift**.

**7. `PLAN.md`:71 — scenario-format-hardening slice description pins `schemaVersion: 1`.**
The entry says scenario files now carry "integer `schemaVersion: 1`". Accurate for that slice at merge time, but `codex/asset-library-follow-ons` moved the format to `schemaVersion: 2` (`scenario.ts:7` `currentSchemaVersion = 2`; noted correctly at `PLAN.md`:39). Not wrong when read as a historical slice note, but a casual reader may take the first mention as current state. Severity: **drift-risk**.

### Cross-doc contradictions

**8. `BRIEF.md`:112 vs `PLAN.md`:18-20 — design-tokens-foundation described as visual-change vs no-change.**
BRIEF.md § "Implementation sequence" says `codex/design-tokens-foundation` produces "No visual change beyond guaranteed light/dark parity." PLAN.md's Recently Completed entry for the same slice (`PLAN.md`:18-20) says it "shifts new-scenario default grid and background colors for both themes toward the redesign reference." Both can be true simultaneously (the token values match BRIEF.md's intent, but they differ from what `main.ts` previously hardcoded), but the one-liner in BRIEF.md and the detailed note in PLAN.md read as disagreeing on scope. Severity: **contradiction**.

**9. `AGENTS.md`:127 vs `AGENTS.md`:86-95 — redesign docs are filed in two places and omitted from one.**
Same doc contradicts itself: the `## Docs` section enumerates every other ownership doc but leaves BRIEF.md out; the redesign bullet appears under `## Release testing` instead. (Listed once under Stale assertions #4 for the filing error, repeated here because it is also an internal cross-section inconsistency.) Severity: **contradiction**.

### Feature-summary drift

**10. `README.md`:9-18 vs `PLAN.md`:9 vs code — README's summary is a strict subset of reality.**
`PLAN.md`:9 (Current Focus paragraph) lists: square/hex/free-coordinate boards; permissive colocated marker placement/selection/deletion; viewport pan/zoom/reset; browser+desktop file commands with unsaved-change guards; command registry for file actions; in-memory undo/redo; persisted System/Light/Dark themes with dark board defaults; draft-recovery autosave; editable source pane with targeted diagnostics and shared board validation; read-only in-app runtime view; browser runtime export with bundled assets; package-local asset model (image/audio import, board backgrounds, marker artwork, Save As carry-forward); v2 scenario format with opaque piece ids, labels, marker image refs, chained migration registry; automated desktop-semantic smoke pass. Each of these is verified in code (see §Stale #2 for specific file:line). `README.md`:9-18 covers roughly half. Neither doc mentions source-editor line/column diagnostics explicitly in its summary, though PLAN.md covers this under the `codex/source-editor-hardening` slice (`PLAN.md`:55-58). Severity: **drift**.

**11. `PLAN.md`:9 is accurate but long; `README.md`:9-18 is short but stale.**
Not itself a finding beyond #10, but flagging the shape: the project's "append-light" doc norm (`AGENTS.md`:110) has produced a PLAN summary that grew and a README summary that shrank-by-omission rather than shrank-by-rewrite. Severity: **drift-risk**.

### Orphaned references

**12. `PLAN.md`:22-34 — three "Recently Completed" branch names don't exist in git.**
The entries `codex/readme-workflow-clarity`, `codex/desktop-debug-launch-clarity`, and `codex/desktop-semantic-smoke-automation` name branches that are absent from both local and `origin/` branch lists (`git branch -a`). Main-line commits that presumably carry this work include `857e2f8 Clarify desktop workflows and marker art checks` and `655bd94 Add marker artwork and desktop smoke automation (#12)`. The content shipped; the branch names are orphans relative to the repo's branch record. Severity: **orphan**.

**13. `PLAN.md`:80 — Near-Term Branch Sequence #1 `codex/editor-ux-redesign-planning` never shipped under that name.**
The planning work landed as `codex/redesign-bundle` (PR #13, commit `6c38bee`). The branch name listed in PLAN.md was never pushed. Severity: **orphan**.

**14. `docs/redesign/reference/README.md`:73-78 — screenshots list omits two files.**
The doc lists `01-theme-test.png` and `02-theme-test.png` under "Screenshots" but `ls docs/redesign/reference/screenshots/` also shows `01-theme-test2.png` and `02-theme-test2.png`. Either the `*2.png` variants are transient and should be removed, or the README should list them. Severity: **orphan**.

**15. `docs/redesign/reference/README.md`:53-67 — file map omits `design-canvas.jsx`.**
The file map enumerates `components/*.jsx` but does not mention `docs/redesign/reference/design-canvas.jsx`, which exists at the reference folder root. Either it's a leftover from an earlier mockup iteration or it's part of the bundle and missing from the map. Severity: **orphan**.

### Branch-status inconsistencies

**16. `PLAN.md`:80-83 — `codex/editor-ux-redesign-planning` is in Near-Term but the planning has shipped.**
The branch's description ("Run a no-code planning and ideation session…") describes work that is complete (BRIEF.md exists, reference bundle exists, design-tokens-foundation has landed). This entry belongs in Recently Completed under its actual branch name, not at the top of the near-term queue. Severity: **contradiction** (between PLAN.md's own "Recently Completed" and "Near-Term Branch Sequence", which together imply planning is both done and upcoming).

**17. `PLAN.md`:31-34 vs `PLAN.md`:41-44 — `desktop-semantic-smoke-automation` and `desktop-release-smoke` describe overlapping work.**
Both are in Recently Completed. The former centers on `corepack pnpm test:desktop:smoke`; the latter on `corepack pnpm desktop:check` and the `DESKTOP-TESTING.md` checklist. The two slices are distinct (one is the scripted automation, the other is the human checklist + preflight) but the ordering reads as if `desktop-release-smoke` preceded `desktop-semantic-smoke-automation`, which matches commit history (`c48754f` precedes `655bd94`). Not wrong, but a reader unfamiliar with the history may read them as redundant. Severity: **drift-risk**.

**18. `PLAN.md`:99-102 (`codex/editor-help-overlay`) vs `BRIEF.md`:122 (`codex/command-palette`) — likely subsumption.**
`codex/editor-help-overlay` is Near-Term #4, described as "lightweight, discoverable help surface for existing keyboard shortcuts and command affordances" with "data-driven content so commands added later surface automatically." BRIEF.md § Implementation sequence item 6 is `codex/command-palette`: "Fuzzy-searchable overlay over the existing command registry … does not replace the menu bar or the command bar — it's a discoverability layer." The two target the same problem (command/shortcut discoverability driven by the registry). The palette likely makes the separate help-overlay redundant. Not a contradiction in today's state (help-overlay hasn't shipped) but a planning inconsistency that will need to be resolved. Severity: **drift-risk**.

## Part 2 — Missing commitments

### Implied-but-unrecorded decisions

**19. Scenario format v2 contract is not in `DECISIONS.md`.**

- **Gap.** Opaque piece ids (Crockford base32, `piece_` prefix — `apps/editor/src/scenario-migrations/identity.ts`), author-facing `label` field (`scenario.ts:33`), optional `imageAssetId` (`scenario.ts:38`), chained per-adjacent-version migration registry (`scenario-migrations/index.ts:14-34,54-98`), and forward-version hard-reject (`scenario-migrations/index.ts:65-71`) are load-bearing format commitments. Only decision `008` is relevant ("Scenario files are human-readable") and it pre-dates this format work. Nothing in `DECISIONS.md` 001-010 pins (a) identity model, (b) migration registry contract, or (c) forward-version policy.
- **Belongs in.** `DECISIONS.md`.
- **Recommended treatment.** Write a new decision capturing the identity model (opaque ids, `label` as the human-facing name), the migration registry contract (per-adjacent-version chain, applied on load, dirties on migration), and the forward-version policy (hard reject with readable error). Land it separately from the redesign commitments below.

**20. Desktop-automation seam is a load-bearing architectural commitment.**

- **Gap.** `apps/editor/src/desktop-automation.ts` (412 lines) injects canned dialog responses and file paths only when launched with an explicit automation spec. `PLAN.md`:33 describes this seam as "intentionally narrow and test-only", but that framing sits only in a slice note. Decision `010` narrows the *purpose* of the browser editor; there is no equivalent decision narrowing the desktop automation surface.
- **Belongs in.** `DECISIONS.md`, either as a standalone decision or an addendum to `010`.
- **Recommended treatment.** Consider a short decision recording that the desktop-automation entry points are test-only and are not a public API for scripted desktop authoring. Optional but cheap; prevents later slices from broadening the seam under implicit pressure.

### Redesign commitments that should enter DECISIONS.md

**21. BRIEF.md treats nine architectural items as settled; none are in `DECISIONS.md`.**

- **Gap.** `BRIEF.md`:20-39 ("Architectural commitments this redesign adds") enumerates: four-tab inspector, tool rail on the left, bottom asset strip, status bar at the bottom, command palette (⌘K/Ctrl+K), full-page New Scenario flow, Edit Board Setup as a modal, coordinate-label stage rulers, and author-defined sides with a `sideId` reference model (a `schemaVersion: 3` migration). BRIEF.md's own Open questions (`BRIEF.md`:130) flags this: *"Do we commit to the four-tab inspector as a new decision in DECISIONS.md? (Recommended: yes, as decision 011 — 'Editor information architecture.')"*
- **Belongs in.** `DECISIONS.md`.
- **Recommended treatment.** Consolidate the layout-structural commitments (four-tab inspector, tool rail, asset strip, status bar, command palette, New Scenario page) into a single new decision — BRIEF.md itself proposes "011 — Editor information architecture." Do not bundle author-defined sides into that decision; it is a scenario-format change (schemaVersion: 3) and is better as its own decision when `codex/unit-entity-model` shipped work earns it. Coordinate rulers and the Edit-Board-Setup modal are smaller in scope and can land as annotations when their branches ship, unless a future audit finds them drifting.

### Planning questions raised by the redesign work

**22. `PLAN.md` Near-Term Branch Sequence and `BRIEF.md` Implementation sequence do not agree.**

- **Gap.** `BRIEF.md`:108-124 specifies six implementation branches: `codex/design-tokens-foundation` (shipped), `codex/inspector-tabbed-rewrite`, `codex/status-bar`, `codex/asset-strip`, `codex/new-scenario-page`, `codex/command-palette`. Of the five unshipped, none appear in `PLAN.md`:78-117 (Near-Term Branch Sequence). PLAN.md's Near-Term #1 is the planning branch, which has shipped.
- **Belongs in.** `PLAN.md` Near-Term Branch Sequence.
- **Recommended treatment.** Rewrite `PLAN.md`'s Near-Term sequence to interleave BRIEF.md's five remaining branches with existing feature branches (`codex/rules-expression-spike`, `codex/unit-entity-model`, `codex/token-styling`, `codex/rules-authoring-system`, `codex/standalone-runtime-export`). The specific interleaving is a judgment call; `BRIEF.md`:114 notes `codex/inspector-tabbed-rewrite` is "the biggest single UX win" and should precede feature work that will compound right-column crowding. Also resolve the `codex/editor-help-overlay` vs `codex/command-palette` subsumption (see finding 18).

### Reference-document pinning

**23. `docs/redesign/reference/` is not pinned to a revision.**

- **Gap.** `BRIEF.md`:4 says "When the two disagree, this file wins", which sets the precedence but not the synchronization. `BRIEF.md`:134-140 (§ "Files in this folder") lists the bundle's contents but does not state which mockup iteration it represents or what triggers a refresh. If the design iterates further in the external design tool, the reference could silently diverge from BRIEF.md without a signal to readers.
- **Belongs in.** `docs/redesign/BRIEF.md`.
- **Recommended treatment.** Add a one-line "Reference bundle revision" note at the top of BRIEF.md (or alongside § Files in this folder), pinning the bundle to a date or mockup version and stating that design iterations require updating BRIEF.md or shipping a new bundle. Out of scope to produce in this audit branch.

## Recommendations

Five-to-ten concrete next actions, priority-ordered. A follow-up fix branch can work from this list.

1. **Rewrite `PLAN.md` Current Focus and Near-Term Branch Sequence.** Move `codex/editor-ux-redesign-planning` to Recently Completed under its actual branch name (`codex/redesign-bundle`, PR #13). Remove `PLAN.md`:76's "next branch is a no-code planning pass" paragraph. Interleave BRIEF.md's five remaining implementation branches into Near-Term. Resolve whether `codex/editor-help-overlay` is dropped in favor of `codex/command-palette`. (Findings 1, 13, 16, 18, 22.)
2. **Write `DECISIONS.md` 011 — Editor information architecture.** Consolidate BRIEF.md's layout commitments (four-tab inspector, tool rail, asset strip, status bar, command palette, New Scenario page). Leave author-defined sides and rulers for later decisions. (Finding 21.)
3. **Write a separate `DECISIONS.md` entry for scenario format v2.** Record opaque-id identity model, migration registry contract, and forward-version rejection. (Finding 19.)
4. **Update `README.md` Current Baseline and Docs list.** Either refresh the Current Baseline to match `PLAN.md`:9, or scope it explicitly to "authoring flows" and drop the pretense of completeness. Add `docs/redesign/BRIEF.md` to the Docs list. (Findings 2, 3, 10.)
5. **Update `AGENTS.md` Docs section.** List `docs/redesign/BRIEF.md` and `docs/redesign/reference/README.md` under `## Docs` (lines 86-95). Remove the orphan bullet currently under `## Release testing` (line 127). (Findings 4, 9.)
6. **Pin the reference bundle revision in `BRIEF.md`.** Add a revision note so future mockup iterations are explicit about superseding the current bundle. (Finding 23.)
7. **Normalize `DESKTOP-TESTING.md` path references.** Either describe the smoke artifacts as `os.tmpdir()/fieldcraft-desktop-smoke/...` with a platform note, or scope the doc to Linux explicitly. (Finding 6.)
8. **Clean the redesign reference inventory.** Either remove `01-theme-test2.png` / `02-theme-test2.png` / `design-canvas.jsx` from `docs/redesign/reference/` if they are leftovers, or add them to `reference/README.md`'s file map and screenshots list. (Findings 14, 15.)
9. **Consider (low priority) a short decision narrowing the desktop-automation seam** to test-only use, as an addendum to decision 010 or a new entry. (Finding 20.)
10. **Do not try to fix branch-name orphans in `PLAN.md` Recently Completed retroactively** (finding 12). The branches are gone; the content shipped. Adjust the doc norm going forward — either drop branch names from Recently Completed, or only list branch names that correspond to shipped PR references.
