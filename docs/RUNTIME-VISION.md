# Runtime Vision Draft

Status: working draft. This is not a specification, not settled architecture, and not a replacement for `PLAN.md` or `DECISIONS.md`. It structures questions that the project has not yet asked about what a shipped Fieldcraft game is, and will be iterated on before any of it becomes a decision.

## 1. Purpose

The editor is roughly 85% of the codebase. The runtime that ships to players — `apps/editor/src/runtime-export/browser-runtime.js` — is 1,098 lines that render a board and let the reader pan and zoom. There is no gameplay.

`AGENTS.md` describes the target experience as "design a map, place units, write rules, play-test, and export a finished game from within one environment." Three of those five verbs are not possible today. "Export a finished game" is technically possible, but the artifact produced is a viewer, not a game.

This document exists to name the gap. Several editor branches in `PLAN.md`'s Near-Term sequence (`codex/asset-strip`, `codex/new-scenario-page`, `codex/command-palette`, `codex/tool-rail`) can proceed regardless of what is in this document. Later branches (`codex/rules-expression-spike`, `codex/unit-entity-model`, `codex/rules-authoring-system`, `codex/standalone-runtime-export`) are increasingly hard to design without a target for what the runtime delivers. This draft is the source material for that target.

## 2. What currently exists (baseline)

The current runtime export is descriptive, not interactive. It produces a self-contained HTML/JS/CSS bundle with the authored scenario embedded inline plus a `bundledAssets` dictionary of data-URL payloads.

What the export contains:

- The parsed `Scenario` structure from `apps/editor/src/scenario.ts` (title, space, assets, pieces, metadata). Pieces today are typed as `kind: "marker"`, `side: "neutral"` (see `apps/editor/src/scenario.ts:31-39`).
- Bundled asset data URLs for images referenced by the scenario (board background, per-piece artwork).
- A generated-at timestamp.

What the runtime does with it:

- Renders a sidebar with static scenario metrics (board label, marker count, asset count, generated-at, background summary).
- Renders a stage header reading "Runtime View" / "Read-only board preview."
- Draws the board geometry for square-grid, hex-grid, or free-coordinate scenarios onto a canvas (`apps/editor/src/runtime-export/browser-runtime.js:292-436`).
- Draws markers (filled circles or clipped images) at authored coordinates, including the colocation fan-out behavior used in the editor.
- Supports pan (pointer drag), zoom (wheel and buttons), and view reset.
- Exposes dataset attributes on the surface element for automated smoke tests (`apps/editor/src/runtime-export/browser-runtime.js:790-831`).

What the runtime does not do:

- Identify a player, a side, or a session.
- Accept any input that affects scenario state.
- Express turns, phases, orders, or any time-advancement concept.
- Evaluate any rule, run any logic beyond layout, or check any condition.
- Define victory, an end state, or any notion of "game over."
- Persist session state between launches.
- Distinguish itself visibly from a static document viewer.

The exported bundle is a faithful rendering of the authored scenario file. It is not yet a game.

## 3. The core question

**What makes a Fieldcraft game a *game* (something players play) rather than a *viewer* (a scenario rendered read-only)?**

The sub-questions below have to be answered, at least roughly, before the runtime can grow past the current baseline. This section is a table of contents for section 4, not an answer.

1. **Player model.** Who plays a Fieldcraft game?
2. **Side control.** Given a session, how is each side controlled — human, local co-presence, remote peer, bundled AI?
3. **First-five-seconds experience.** When a player launches an exported Fieldcraft game, what do they see? What tells them they are in a game and not a viewer?
4. **Turn structure as player experience.** Decision `005` commits to plotted simultaneous turns. What does that feel like in the UI — how are orders entered, submitted, revealed, resolved?
5. **Information visibility.** Does each side see the same board, or do sides have private views (hidden units, hidden orders, fog of war)?
6. **Digital affordances.** What does a Fieldcraft runtime do that a physical tabletop version of the same scenario cannot?
7. **Win condition model.** Does every Fieldcraft game end? Is a win condition part of the scenario format, optional, or absent?
8. **Persistence and session.** Does an in-progress session survive between launches? Is the session the same artifact as the authored scenario, or something separate?
9. **Runtime-authoring boundary.** What is authored in the editor vs. configurable by the player at runtime?

If other questions surface during discussion, add them here and in section 4 together. The list is not frozen.

## 4. Candidate answers with tradeoffs

Each subsection frames the question, enumerates two or three candidates with their codebase implications and tradeoffs, states an explicit opinion labeled as an opinion, and names where the answer constrains or is constrained by other questions. Opinions are leans, not conclusions.

### 4.1 Player model

Who plays determines almost everything downstream — UI shape, session persistence, information visibility, AI work, and whether networking enters the architecture. It has to be answered before turn structure and information visibility are even tractable.

**Candidate A — solitaire against the scenario.** A single player takes one or more sides; the other sides do nothing (static opposition, puzzle-style) or follow authored scripted orders.

- Codebase implication: smallest. Orders are a single-player input; resolution is deterministic against zero-or-scripted opposing orders.
- Tradeoff: many of the tabletop archetypes the project cites (SFB, 40K, milsims) are two-player by nature. A pure solitaire model may mis-shape the runtime for scenarios that want opposition.

**Candidate B — hot-seat on one machine.** Two humans share the same runtime; the runtime manages whose turn it is and hides one side's orders from the other when needed. No networking.

- Codebase implication: moderate. Requires a side-switch UI, per-side order entry, and the minimum of a private-information posture. No server, no accounts.
- Tradeoff: awkward in the real world (sharing a screen, passing a device). For the tabletop archetypes the project targets, it matches the physical game closely.

**Candidate C — networked multiplayer.** Two or more humans on separate machines; the runtime becomes a client that exchanges orders over the network.

- Codebase implication: largest. Introduces a networking layer, session identity, authentication, conflict resolution. Would require revisiting decision `007`: the runtime is no longer a purely static bundle.
- Tradeoff: matches most contemporary digital board games. It is a category jump from the current "open the bundle and play" shape. `PLAN.md`'s Out of Scope section explicitly rejects "server-hosted or multiplayer game hosting driving current editor architecture" — not adopted without first revisiting that entry.

**Candidate D — solitaire against bundled AI.** Runtime includes an AI that plays one or more sides.

- Codebase implication: moderate to large. Scripted-behavior AI is cheaper than search-based AI, but both require a rules engine that can evaluate state deterministically.
- Tradeoff: AI authoring is scope the project has not touched. Even scripted AI depends on the rules-expression language being usable by authors.

**My lean — A + B together, AI deferred.** Solitaire and hot-seat are both reachable without networking; both demonstrate the turn loop; hot-seat gives two-player scenarios something to run against without committing to AI. A human should consider whether hot-seat's real-world awkwardness is worth the scope, or whether solitaire-only is a better first-playable target.

**Cross-cutting dependencies.** Constrains 4.2 (side control), 4.3 (opening screen), 4.5 (hot-seat forces a "pass the device" moment around hidden orders), 4.8 (asynchronous play requires a persistence story).

### 4.2 Side control

Orthogonal to "how many humans exist" is "which sides does a human control in a given session." Even solitaire can be one-human-controls-all-sides or one-human-plays-one-side-only.

**Candidate A — one side per player, declared mapping.** The scenario declares sides (tracked for `codex/unit-entity-model` in `PLAN.md`); at session start a player picks or is assigned a side.

- Codebase implication: moderate. Session start needs a side selector and somewhere to store the local assignment.
- Tradeoff: clean, matches tabletop norms. Forces 4.1 to answer "who's the other side?" concretely.

**Candidate B — one player controls all sides.** Single human drives every side's orders. Useful as an in-editor play-test posture.

- Codebase implication: small. The session does not enforce side-exclusive visibility.
- Tradeoff: does not match real end-user play but matches "editor-as-play-test" closely. A candidate for a dev/playtest mode, not a shipped default.

**Candidate C — roles distinct from sides.** Sides are authored factions; roles (Player 1, Player 2, Observer) are assigned per session and can see or control one or more sides.

- Codebase implication: larger. Adds a role layer between player and side that the scenario format today has no concept of.
- Tradeoff: flexible enough for referee-style or asymmetric-observation scenarios. Probably premature.

**My lean — Candidate A as the shipped default; Candidate B as an in-editor play-test mode.** Roles (C) wait until a concrete scenario needs asymmetry.

**Cross-cutting dependencies.** Depends on `codex/unit-entity-model` landing author-defined sides. Depends on 4.1's answer.

### 4.3 First-five-seconds experience

When a player launches an exported Fieldcraft game, the opening moment has to distinguish itself from a document viewer. Today it literally reads "Read-only board preview."

**Candidate A — start on the board, side pre-assigned.** Launch goes straight to the playable view. A brief title overlay names the scenario and the side the player controls, then fades; board and order-entry affordances are active immediately.

- Codebase implication: small to moderate. Needs a default side assignment (first side, or scenario-authored default) and a minimal title overlay.
- Tradeoff: fast to gameplay; hides the side-selection decision.

**Candidate B — menu-first.** Launch shows title, scenario summary, side selection, and a Start button.

- Codebase implication: moderate. A menu layer over the runtime plus a game-state machine with at least two states (menu, playing).
- Tradeoff: matches most digital games. Adds UI scope before gameplay exists.

**Candidate C — in-editor vs. exported differ.** In-editor playtest goes straight to board (editor posture); exported runtime shows menu-first (player posture).

- Codebase implication: moderate. Same menu code, conditional on context.
- Tradeoff: honors the spirit of decision `010` — editor and export are different surfaces — at the cost of two runtime postures to maintain.

**My lean — Candidate C, with the menu kept very small.** The in-editor playtest should not impose menu friction on the author iterating; the exported runtime should at least name the scenario and the controlled side before the board appears. A one-screen menu with title, side selection, and Start is probably the minimum useful shell.

**Cross-cutting dependencies.** Depends on 4.1 and 4.2.

### 4.4 Turn structure as player experience

Decision `005` settles *what* the time model is: plotted simultaneous turns, universally. It does not settle *how that feels* — order entry, submission, reveal, resolution. That UX work has not started.

**Candidate A — direct-manipulation orders plus explicit Submit.** The player clicks a piece, targets a destination or action, and the UI records an order. A visible queue of entered orders builds up. Submit commits all orders for the side; the other side resolves (via pre-authored orders, AI, or hot-seat submission), then the turn resolves.

- Codebase implication: moderate. Orders buffer data structure, per-piece order entry UX, submit action, resolution animation or step-through.
- Tradeoff: feels like a digital board game. Requires the rules engine to represent "a pending order on a piece" — which `codex/unit-entity-model` and `codex/rules-expression-spike` have to accommodate.

**Candidate B — text-first orders.** Orders are typed or composed as structured text, similar to the current source editor. Submit commits them.

- Codebase implication: small. Reuses source-editor-style affordance.
- Tradeoff: terrible UX for a non-author. Fine for a bootstrap spike (see `AGENTS.md` bootstrap exception); wrong for a shipped game.

**Candidate C — phase-stepper UI.** The turn is chunked into authored phases (e.g., "movement plot," "combat plot," "resolution") the player advances through, each with its own affordance.

- Codebase implication: moderate. Requires a phase model in the scenario format or rules engine, plus a phase-stepper UI.
- Tradeoff: matches SFB and 40K directly. Heavier than a first scenario probably needs.

**My lean — Candidate A is the eventual answer; Candidate B is a reasonable first spike under the bootstrap exception.** Candidate C should wait until a concrete scenario justifies authored phases — do not design a phase system before a rule needs one.

**Cross-cutting dependencies.** Tightly coupled to `codex/rules-expression-spike`, `codex/unit-entity-model`, and `PLAN.md`'s deferred "Turns, phases, and play-testing" block. Downstream constraint on 4.5 (resolution is when hidden orders are revealed).

### 4.5 Information visibility

Plotted simultaneous turns create a natural privacy boundary: orders entered before resolution are at minimum unresolved. Whether they are also *hidden from the other side* is a design choice. So is whether piece positions, piece identities, or board state are hidden.

**Candidate A — all open information.** Both sides see everything. Simultaneous resolution is about timing, not secrecy.

- Codebase implication: smallest. Runtime already shows everything.
- Tradeoff: loses the plot-and-reveal dynamic that gives plotted simultaneous turns most of their interest. Matches some open-information tabletop games; not the SFB/milsim archetype.

**Candidate B — hidden orders, open board.** Pieces and positions are visible to both sides; orders are private until submitted and revealed at resolution.

- Codebase implication: moderate. Per-side order buffer and a reveal step.
- Tradeoff: strong match for plot-and-reveal tabletop games. In hot-seat, the UI must physically switch visibility when entering each side's orders.

**Candidate C — full fog of war.** Each side sees only what its pieces can perceive under authored rules. Positions and identities may be partial.

- Codebase implication: largest. Per-side rendering, visibility rules as authored logic, scenario-format design so visibility survives export.
- Tradeoff: matches milsims and some modern board games. Significantly raises the rules-engine complexity bar.

**My lean — Candidate B as the first target; A and C as later opt-ins.** Hidden orders with an open board is the smallest step away from "viewer" that still makes plotted turns meaningful. Open information (A) becomes a scenario-authored toggle; fog of war (C) is a later scenario pattern that the rules engine has to earn.

**Cross-cutting dependencies.** Downstream of 4.1 and 4.4. Constrains the scenario format (do scenarios declare visibility rules?) and forces session state — whose turn it is to enter orders — into the persistence model.

### 4.6 Digital affordances

`AGENTS.md` positions the project as "tabletop wargames with the advantages of a digital medium." What are those advantages, concretely? This is an additive list, not a pick-one. Each item here is a potential scope commitment.

- **Automatic rules enforcement.** The runtime knows whether a move is legal. No rule-lookup interrupts play. Requires a mature rules engine. Probably non-optional long-term.
- **Hidden-information management.** Automatic reveal of orders at resolution. See 4.5. Dominant reason to ship a digital version of a plotted-turn tabletop game.
- **Asynchronous play.** Session persists between launches; players enter orders at separate times; the game resolves when both sides have submitted. Requires session persistence (4.8); for two humans without networking, requires file exchange; with networking, a server.
- **Animated resolution.** Orders play back visibly at resolution. `PLAN.md`'s deferred "Animation authoring" block anticipates this.
- **Rich log.** Every turn's orders and outcomes are recorded and reviewable. Cheap once orders exist; valuable for learning and review.
- **Undo-within-session.** The editor has in-memory undo/redo. The runtime may want order-entry undo before submit, no undo post-submit, or post-resolution rewind for review. These are different affordances.
- **Replay.** Stepping through the log after a game ends. Overlaps with rich log.
- **Tutorials and scaffolded first scenarios.** `PLAN.md`'s "Bundled sample scenarios" block anticipates this.
- **Solo vs. authored AI.** Maps to 4.1 Candidate D.
- **Agent-playable runtime.** Following decision `010`'s logic for the editor, the runtime could expose an automation surface so authors or coding agents can drive headless playthroughs. Not required for player-facing value, but consistent with the project's automation posture.

**My lean — log, hidden-order reveal, and automatic rules enforcement are the three that earn their keep first.** Everything else is a later scope bet. A human should consider whether agent-playable runtime is worth a small upfront commitment (deterministic resolution, test hooks) or whether it should wait until the player-facing runtime is built.

**Cross-cutting dependencies.** Most items depend on 4.4 and 4.7 (rules engine). Animation and replay depend on a structured event log that the rules engine produces.

### 4.7 Win condition model

An authored scenario has a board and pieces. Does it also have an end?

**Candidate A — every scenario declares a win condition.** The scenario format gains a `victory` block, required or strongly encouraged. The runtime checks after each resolution; when met, a result screen appears.

- Codebase implication: moderate. Format additions and a result UI.
- Tradeoff: enforces closure, matches competitive tabletop games. May be rigid for sandbox or exploration scenarios.

**Candidate B — win conditions are optional.** Scenarios may declare victory; those that do not never "end" — the session continues until players stop.

- Codebase implication: small. Victory becomes an authored extension.
- Tradeoff: matches tabletop reality (many games end by agreement). Leaves beginners without guidance.

**Candidate C — runtime-provided default, author-overridable.** Every scenario gets a default ("side with the most surviving pieces after N turns" or similar) unless the author specifies.

- Codebase implication: moderate. The runtime has to encode a default-victory notion.
- Tradeoff: gives novice authors something. May actively mislead if the default does not match the scenario's actual shape.

**My lean — Candidate B, with A strongly encouraged in authored docs and templates.** Do not force a `victory` block into the format; do make it a first-class authored concept once rules land. No lean on whether the runtime should ship a default — that is a tutorial/onboarding question, answerable later.

**Cross-cutting dependencies.** Coupled to the rules-expression language (a win condition is a rule). Downstream of the entity model (victory is usually expressed in terms of pieces or sides).

### 4.8 Persistence and session

A scenario file today (v2 `fieldcraft.scenario` JSON, per decision `011`) is the author's artifact. An in-progress game is different: a player, mid-turn, with orders entered but not submitted, and a history of prior turns. How does the session artifact relate to the scenario file?

**Candidate A — sessions do not persist; each launch is fresh.** Closing the runtime loses in-progress state.

- Codebase implication: smallest.
- Tradeoff: fine for short scenarios. A non-starter for asynchronous or longer play.

**Candidate B — session saved inside the scenario file.** The scenario grows a `session` block (current turn, side-to-move, order buffer, log). Loading reconstitutes the session.

- Codebase implication: moderate. The scenario format becomes mutable-in-play.
- Tradeoff: collapses authoring and play into one artifact, which is simpler in one way and riskier in several. Authoring a scenario after playing it becomes confusing. Probably wrong.

**Candidate C — session is a separate sidecar file.** `scenario.json` plus `scenario.session.json` (or similar). Scenario stays author-owned; session is runtime-owned. Both human-readable per decision `008`.

- Codebase implication: moderate. A new file type with its own migration lineage (decision `011`'s policy would likely extend to cover it).
- Tradeoff: more files to manage. Cleanly separates authoring from play.

**Candidate D — session in memory or local storage, not as a shareable file.** Runtime remembers across launches on the same device; session is not portable.

- Codebase implication: small. Reuses the editor's existing draft-recovery pattern.
- Tradeoff: breaks asynchronous networked or hot-seat-across-devices play. Fine as a first step.

**My lean — Candidate D for the first playable; Candidate C as the next step.** Local-device persistence matches the editor's draft-recovery pattern and gets the runtime a session concept cheaply. Sidecar session files (C) earn their cost when asynchronous play is real. Candidate B is probably actively wrong: it collapses authoring and play in a way the project's editor-first stance resists.

**Cross-cutting dependencies.** Depends on 4.1 (networked play forces sidecar or server-hosted sessions). Touches the migration policy of decision `011`. Interacts with the editor: loading a scenario with an existing session should not clobber the session on save.

### 4.9 Runtime-authoring boundary

The editor authors; the runtime plays. What, if anything, is configurable at runtime outside the player's gameplay actions themselves?

**Candidate A — nothing. The authored scenario is frozen at export.** The only runtime choice is side selection.

- Codebase implication: smallest.
- Tradeoff: preserves authorial intent; prevents the runtime from becoming a parallel editor.

**Candidate B — authored-exposed configuration.** The scenario can declare configurable fields (difficulty, rule variants, AI behavior choice, map seed). The runtime offers them at session setup. Not free-form authoring — only what the author marked as configurable.

- Codebase implication: moderate. Scenario format gains a `configuration` block; runtime gets a setup step.
- Tradeoff: matches modern digital board games well (difficulty sliders, variant rules). Adds scope the first playable does not need.

**Candidate C — full runtime authoring.** The runtime contains some subset of the editor, so players can tweak anything.

- Codebase implication: largest. Blurs the editor/runtime distinction the project's editor-first stance rests on.
- Tradeoff: out of bounds. Directly conflicts with decision `001` (editor-first) and with `AGENTS.md`'s "what this project is not." Not adopted without revisiting both.

**My lean — Candidate A, with B as a possible later slice.** Ship a frozen-scenario runtime first; let authored configuration become a pattern only if a real scenario wants it. C is out of bounds.

**Cross-cutting dependencies.** Candidate C conflicts with decision `001`. Candidate B touches the scenario format in a way that cannot land before the entity model does.

## 5. Minimum first playable

A reference point, not a rules design. If the project can ship this, everything else is scope expansion from a working foundation. If the project cannot describe it, the vision is too abstract.

**Space model.** A 6×6 pointy-top hex grid. Decision `004` already supports hex; hex matches the tabletop archetype the project cites most directly (SFB). Size 6×6 is small enough to grasp at a glance and large enough that movement choices are non-trivial.

**Sides.** Two: "Red" and "Blue." Author-defined sides (the `codex/unit-entity-model` plan) are assumed here but not a blocker — the simplest version uses the current `side: "neutral"` placeholder from `apps/editor/src/scenario.ts:35`.

**Pieces.** Two per side, placed in opposite corners. Two is the minimum that demonstrates tactical choice: one piece per side reduces the game to a single move-and-collide decision.

**Unit types.** One. Every piece has the same capabilities.

**Orders per turn.** Each piece receives exactly one order chosen from: *stay* or *move to an adjacent hex*. Orders are entered privately by each side and submitted. When both sides have submitted, orders are revealed and resolved simultaneously.

**Resolution rule.** All moves execute at once. If after move resolution two pieces from opposing sides occupy the same hex, both pieces are destroyed. If same-side pieces share a hex, nothing happens (colocation is legal — the `codex/object-occupancy-semantics` slice from `PLAN.md`'s Recently Completed block already establishes this).

**Win condition.** A side wins when the opposing side has no pieces. If both sides reach zero in the same resolution, the game ends in a draw. No turn limit in the first playable.

**First-five-seconds.** Runtime launches to a minimal title screen: scenario name, "You are playing Red," Start. Start reveals the board with all four pieces visible and the order-entry affordance active on Red's two pieces. Selecting a piece shows its six adjacent hexes and a "stay" option as targets. Clicking a target registers an order. A "Submit turn" button commits both orders. In hot-seat, after Red submits, the UI prompts for device hand-off and Blue enters orders; otherwise (solitaire against a trivial AI or against pre-authored Blue orders) Blue's orders resolve automatically. At resolution, orders are revealed, pieces animate or step to their outcomes, and any destroyed pieces are removed. If the win condition is met, a result screen appears; otherwise the next turn begins.

**What this playable proves.**

- Orders can be entered, submitted, and resolved per decision `005`.
- Hidden-order reveal (4.5, Candidate B) works in the simplest form.
- A scenario has a start and an end (4.7).
- The runtime is visibly a game, not a viewer (4.3).

**What it does not prove.**

- Free-coordinate space. Deliberately out of the first playable; a hex-first target is the smallest thing, not a commitment to tile-before-free.
- Rich rules: no combat systems, terrain, line-of-sight, or varied unit types.
- Multi-unit asymmetric sides.
- Networked play.
- Persistence across launches.

## 6. What this document does not settle

- **Rules-expression syntax.** Premature. Already on the plan as `codex/rules-expression-spike`. Sections 4.4 and 4.7 touch it but do not choose.
- **Entity model fields.** Premature. Already on the plan as `codex/unit-entity-model`. Sections 4.1 and 4.2 touch it.
- **Authored-scenario packaging and distribution.** Separate concern. Where players get exported games — a web page, a binary download, a marketplace — is a later product question, not architecture.
- **Monetization or licensing of authored games.** Separate concern. The runtime itself should not care.
- **Multiplayer networking protocol.** Premature. If 4.1 Candidate C is ever chosen, the architectural question (client-server vs. peer-to-peer vs. relay) is a separate decision from the protocol (what bytes, what schema). Keep them separable.
- **AI implementation.** Premature. Named in 4.1 Candidate D and 4.6, but not explored.
- **Accessibility and input-method parity.** Already tracked in `PLAN.md`'s Cross-cutting deferred block; deserves its own pass when gameplay UI exists to evaluate.

## 7. Next steps

A proposal, not a plan change. This branch does not reorder `PLAN.md` and does not add entries to `DECISIONS.md`.

**Decisions that may eventually land in `DECISIONS.md`.** None of these should be written until the corresponding section-4 discussion has happened. Named only so future branches know what they might become:

- A decision on the player model (4.1) and side control (4.2). These are entangled; they likely land together.
- A decision on information visibility posture (4.5) — in particular, whether hidden-order reveal is the default.
- A decision on the session-persistence artifact (4.8) — in particular, whether sessions are sidecar files and whether they are covered by the migration policy of decision `011`.
- A decision on the runtime-authoring boundary (4.9) — in particular, whether authored scenarios can declare player-configurable fields.

**Plan revisit.** After this draft is discussed, `PLAN.md`'s Near-Term sequence probably wants revisiting in at least two ways:

1. `codex/rules-expression-spike` should treat the section-5 minimum first playable as one of its target scenarios. A spike that cannot express "each piece gets one move order; simultaneous resolution; opposing co-occupation destroys both" is too narrow for even the smallest Fieldcraft game.
2. `codex/standalone-runtime-export` is currently described as repackaging the browser runtime as a Tauri binary. If the player model grows beyond pure solitaire, desktop and browser builds may diverge in persistence (4.8, filesystem vs. local storage) and hidden-order visibility (4.5, different UI for pass-the-device on desktop vs. browser). That divergence is currently unmodeled.

Revisiting `PLAN.md` is a separate branch, after this draft is discussed.

**Possible exploratory code branch.** If any open question in section 4 is better sharpened by a spike than by discussion, the most likely candidate is order-entry UX (4.4). A very small branch — a fixed hex scenario with two pieces per side, click-to-order, visible order queue, Submit button — would make the candidates concrete in a way discussion cannot. The spike should not touch the rules engine or the scenario format; it should demonstrate order-entry affordance against the section-5 minimum first playable. Suggested name if it runs: `codex/order-entry-spike`. Do not start it until 4.1, 4.2, and 4.4 have at least been discussed.
