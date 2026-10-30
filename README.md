# GeoGrind

A React map application for the Czech Republic controlled by natural language.
Type commands like "Zoom to Prague" or "Show cycling routes" and the map reacts.

## Status

Early development. No application code yet.

Tech stack: TypeScript (strict), React, Vite, Vitest and an i18n library. The UI is available
in Czech and English.

## AI agents

The project uses Claude Code subagents (`.claude/agents/`) for its workflow:

- **analyst** – turns requests into specs in `docs/specs/`
- **architect** – turns specs into technical designs in `docs/design/` and keeps
  `docs/architecture.md` up to date
