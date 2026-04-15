# Fieldcraft

A visual authoring tool for turn-based tactical board game experiences.

## Vision

Fieldcraft aims to be an editor-first environment for designing, play-testing, and exporting tactical scenarios. Scenario authors should be able to draw maps, define units, author rules in a small expression language, and play-test without leaving the editor. Finished work should export to a playable browser build or a standalone desktop binary.

## Status

Greenfield. No implementation yet.

This repository currently defines product direction, working style, and architectural constraints. It does not yet contain the editor or engine implementation.

## Stack

- **Editor shell:** Tauri
- **Engine and editor UI:** TypeScript
- **Package manager:** pnpm
- **Export targets:** Browser bundle, Tauri standalone binary

## Docs

- `README.md` — project overview and current status
- `AGENTS.md` — workflow, contribution guardrails, and how to work in this repo
- `DECISIONS.md` — canonical record of settled architectural and design decisions
- `CLAUDE.md` — compatibility pointer to `AGENTS.md`
