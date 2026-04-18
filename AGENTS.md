# AGENTS.md

This file is the primary guide for coding agents working in this repo.

`CLAUDE.md` and any other agent-oriented file should point here. `DECISIONS.md` is canonical for settled architectural points; if this file conflicts with it, follow `DECISIONS.md` and update this file.

## What this project is

Fieldcraft is a visual authoring tool for turn-based tactical board game experiences.

The editor is the product. Everything else — the engine, the rules interpreter, the export pipeline — serves the editor. A scenario author should be able to design a map, place units, write rules, play-test, and export a finished game from within one environment.

The engine runs inside the editor, not the other way around.

## What this project is not

This is not a real-time game engine. This is not a general-purpose simulation framework. This is not a programming IDE with a game preview.

The target experience is authored, turn-based, tactical — board games and tabletop wargames with the advantages of a digital medium.

## Stack baseline

Current stack decisions live in `DECISIONS.md`:
- `002` — Tauri shell with TypeScript application logic
- `003` — pnpm as the package manager
- `007` — browser and standalone binary exports

## Workflow

Before starting feature, fix, or exploratory implementation work, check `PLAN.md` for the current branch plan and update it if manual testing has changed the order.

Use discussion to frame the next question, especially for structural or hard-to-reverse choices.
Answer it with the smallest runnable experiment that preserves flexibility and avoids premature assumptions.

Build in small, manually testable slices. Every slice should result in something visible and interactive in the editor. If a feature doesn't show up in the editor yet, it isn't testable in the way that matters.

Preferred loop:
1. Discuss the next question
2. Build a small working piece
3. Test it in the editor
4. Revise from actual use
5. Repeat

Use the editor to build the editor. Once the tool can author scenarios at all, every subsequent feature should be built by authoring a scenario that needs that feature, then adding support for it.

Bootstrap exception: features whose authoring UI does not yet exist (for example, the first pass at a rules expression language, or the first entity-model foundation) may ship behind a source-editor-only path. Add the editor surface in the next slice once the authored shape settles. Do not use this exception to skip authoring surfaces once they are practical to add.

Prefer short-lived, descriptively named branches for ideas, comparisons, and spikes.
Name branches for the question or capability they explore, not by phase or sequence.
Start feature, fix, and exploratory coding work on a branch unless the user explicitly asks to work on `main`.

Keep `main` as the current best known runnable baseline.
Do not merge into `main` until something has been manually tested and shown useful.

## Architecture guardrails

Settled architecture lives in `DECISIONS.md`. Do not reopen those choices casually.

Relevant decisions: `001` (editor-first), `004` (two space models), `005` (plotted simultaneous turns), `006` (structured data plus expression language), `007` (browser and binary exports), and `008` (human-readable scenario files).

Establish the structural seams that those decisions require early. Generalize specific mechanics, rule patterns, or UI workflows only after at least two concrete scenarios justify it.

## What to optimize for

Choose changes that make the project more:
- interactive in the editor
- testable by authoring and playing a scenario
- readable in both code and authored data
- adaptable to new space models, grid types, rule mechanics, and export targets
- useful to the next scenario authoring loop

## What to avoid

Avoid **premature generalization**:
building large abstractions or systems before at least two concrete uses justify them.

Avoid **premature lock-in**:
binding the engine or editor to one grid type, one rule pattern, or one export target so tightly that adding a second requires a rewrite.

Avoid **premature sprawl**:
broadening scope, adding heavy docs, or creating complexity before the current authoring loop works.

Avoid **engine-first thinking**:
building engine features that don't surface in the editor. If the editor can't show it, it doesn't exist yet.

## Docs

Keep docs light and split by ownership:

- `README.md` is for project overview, setup, and commands.
- `AGENTS.md` is for agent workflow and contribution guardrails.
- `DECISIONS.md` is for settled architectural and design choices.
- `PLAN.md` is for mutable branch plans, open questions, and deferred design space.
- `DESKTOP-TESTING.md` is the manual desktop smoke checklist (release-significant per decision `009`).
- `CLAUDE.md` is only a compatibility pointer to `AGENTS.md`.

When a durable architectural choice is made, record it once in `DECISIONS.md` instead of duplicating rationale across files.

Do not create planning or process docs until the work earns them.

### Maintaining these docs

When landing a slice, update `PLAN.md`:
- Add the slice to "Recently Completed Baseline Slices".
- Remove any deferred items the slice closed.
- Prune deferred items whose motivation has faded.

When a slice changes settled architecture, add or update a decision in `DECISIONS.md` rather than layering rationale into other docs.

Treat the status and near-term sections in `README.md` and `PLAN.md` as append-light: prefer replacing a stale sentence over extending a growing one.

## Runtime behavior

Development workflows should be predictable and non-obtrusive.

When scripts are added and they launch processes, they should:
- track what was started
- stop what they started
- free known ports on teardown

The project should play nice on Linux, macOS, and Windows.

## Release testing

Per decision `009`, the desktop editor is authoritative. A passing browser smoke run does not imply a releasable desktop build. Desktop verification — native file dialogs, asset import, save-as carrying packaged assets forward, runtime launch, and export — is manual and release-significant. The current desktop checklist lives in `DESKTOP-TESTING.md`.
