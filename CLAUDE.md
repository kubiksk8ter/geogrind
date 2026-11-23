# GeoGrind

A Next.js (App Router) map application controlled by natural language. The user types a command
such as "Zoom to Prague" or "Přibliž na Brno"; the server interprets it with AI (Groq), looks the
place up with a geocoder (Nominatim) and the browser moves a MapLibre map there. A side panel
shows command history, AI and application metrics, and the terms and privacy notice.

The app is small and expects low traffic. Fixed product constraints:

- All external services must be free of charge (free tiers are fine, paid plans are not).
- The whole UI exists in Czech and English; every user-visible text goes through next-intl
  (`messages/cs.json`, `messages/en.json`), never hard-coded.
- Only the latest Chrome, Firefox, Safari and Edge are supported; no polyfills.
- Secrets stay in server-side code (`.env.local`, git-ignored); never commit them.

## Where to look

- [`docs/architecture.md`](docs/architecture.md): stack, folder structure, external services and
  the list of key decisions. **Read it first** and keep it in mind for any change.
- [`docs/specs/`](docs/specs/): numbered specifications (what and why), written by the analyst.
- [`docs/design/`](docs/design/): numbered technical designs (how), written by the architect.
- [`README.md`](README.md): feature list, setup, env vars, scripts. `.env.example` lists env vars.
- [`.claude/agents/`](.claude/agents/): definitions of the `analyst`, `architect` and `developer`
  agents.

Code layout in short: `src/app` (routes, API handlers), `src/components` (one folder per
feature), `src/map` (`MapEngine` behind MapLibre), `src/server` (server-only code),
`src/shared` (contracts used by browser and server), `src/i18n`, `messages/`.

## Commands

```
npm run dev         # dev server
npm run typecheck   # next typegen && tsc --noEmit
npm run lint        # biome check .
npm test            # vitest run
npm run build       # production build
```

Before reporting work as done, run typecheck, lint and tests (and a build for larger changes).
Never skip or weaken a check to make it pass. For larger changes, running a code review (the
`/code-review` skill) before handing the work over is recommended, but optional.

## Development workflow

The project is developed with AI agents (`.claude/agents/`), each with one role:

1. **analyst**: turns a request into a spec in `docs/specs/NNN-*.md`. Use it first for every
   new feature, change request or idea.
2. **architect**: turns a spec into a design in `docs/design/NNN-*.md` and updates
   `docs/architecture.md`. Needed for new modules, external services, AI integration, shared
   state or cross-cutting changes.
3. **developer**: implements the design (or, for small local changes, the spec) with tests,
   updates `README.md` and bumps the version.

Guidance:

- For anything non-trivial, hand the request to the **analyst** first, then, depending on the
  spec's recommendation, to the **architect** (larger or cross-cutting) or straight to the
  **developer** (small, local).
- Trivial changes (typos, small fixes, wording, docs like this file) can be done directly
  without the agents.
- Agents do not modify requirements or architecture outside their role: the developer does not
  edit specs, designs or `architecture.md`.
- Follow existing patterns. Logic lives outside React components; external services sit behind
  interfaces that tests can fake; external data is validated with Valibot at the boundary.
  Code, comments and docs are in English; no `any`, no dead code.

## Git

- Branches: `feature/...`, `fix/...`, `docs/...`, and so on, created from `develop`;
  merged into `develop` via pull request. `main` receives releases of `develop`.
- Do not create commits or push on your own; leave changes in the working tree. When asked,
  propose the commit message and wait for approval.

### Commit messages

Conventional Commits with a matching gitmoji, in English:

```
{gitmoji} {type}: short summarising description

Longer description of the commit, if needed.

- various further details that are worth recording
- another detail
- ...

Bump version to {current project version, only if it was bumped}.
```

- Types and gitmoji: `✨ feat`, `🐛 fix`, `📝 docs`, `♻️ refactor`, `✅ test`, `🔧 chore`,
  `💄 style`, `⚡️ perf`; first commit `🎉`.
- The first line is imperative, lowercase after the colon, without a trailing period.
- Add the `Bump version to ...` line only when the version changed (see [Versioning](#versioning)).
- Bullets are imperative too ("add ...", "move ...") and describe what changed, not how.
- No `Co-Authored-By` trailer and no other AI attribution.

Example:

```
✨ feat: add terms and privacy notice with start-up modal

- show an informative modal on start with a CZ/EN switch and a link to the terms
- store the acknowledgement with the terms version in localStorage (Zustand persist)
- add a Terms tab to the side panel with the full terms and privacy notice (CZ/EN)
- add spec 012

Bump version to 0.3.0.
```

## Versioning

Semantic versioning `MAJOR.MINOR.PATCH`, kept in `package.json` and `package-lock.json` (root
entries only, never dependency versions):

- **Patch** (last number): a fix (`🐛 fix`), e.g. `0.3.0` → `0.3.1`.
- **Minor** (second number): a new feature (`✨ feat`, one per implemented spec), patch reset to 0,
  e.g. `0.3.1` → `0.4.0`.
- **Major** (first number): a release to production (`develop` → `main`), minor and patch reset.
  The first release is `1.0.0`; the next features continue from there (`1.1.0`, `1.2.0`, ...).

The developer agent bumps the version when it implements a spec (minor) or a fix (patch). When
you (the main session) make a fix or feature without the agent, bump it yourself by the same
rules. The major bump belongs to the maintainer at release. When a commit includes a bump,
mention it in the last line of the commit message.
