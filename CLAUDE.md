<!-- kproject:begin — managed by kprojects; do not edit inside this block -->
## kproject conventions

This project uses the kproject minimal harness
(<https://github.com/kenhia/kprojects>). Keep context small; prefer doing
over ceremony.

### Layout

- `sprints/` — the project's evolution, one record per PR-sized unit of
  work (a "sprint")
  - `planning/` — planning docs; at minimum `roadmap.md` (the general plan)
  - `review/` — more formal reviews as the project matures
  - sprint records: `###-<short-name>.md` for small projects, or a
    `###-<short-name>/` directory of files for larger/more formal ones
  - a sprint record is one informal narrative: goal, decisions, what
    shipped, follow-ups — written during the sprint, not after
  - projects that deploy end the record with a `## Deployed` section:
    what shipped, where, when, and what was verified live — appended
    after the deploy, not predicted before it
- `docs/` — project documentation, architecture, usage
- `.scratch/` — git-ignored scratch space for user or agent ephemera;
  use it instead of /tmp
- `justfile` — dev recipes; default recipe is `@just --list`; `just check`
  runs the CI gates; `just deploy` (or variants) if the project deploys
- `.env` — git-ignored; tokens and environment vars

### Workflow

- One sprint ≈ one PR. Sprint proposals and work items are managed in
  `korg`; durable cross-project knowledge goes in `klams`.
- Mark each work item resolved as its work completes — don't batch the
  resolutions into sprint-ship. A proposal's progress should be readable
  while the sprint is running, which is the only time it is useful.
- If the korg or klams MCP tools are unavailable in your session, say so
  up front — don't silently work around missing infrastructure.
- TDD preferred: write the failing test first when practical.

### Tooling preferences

- No stack the harness could name, so `just check` is yours to write. Ask
  what this repo can actually get wrong — a documents repo's failure mode is
  a stale cross-reference, not a type error
- Add no dependency to make a gate: a stdlib script or a shell one-liner
  keeps a repo that had no dependencies still having none
- Skip what isn't yours to verify — external URLs, machine-local paths
- **Negative-test it.** Plant the error the gate exists to catch and watch it
  exit 1. A gate never seen to fail is not a gate, and the seeded placeholder
  fails on purpose until you replace it
- License is MIT unless specifically directed otherwise
<!-- kproject:end -->

## Project

kfdc — **K Fire Direction Center**: the homelab overseer board. A widescreen,
deliberately dense web dashboard that answers *what's firing, what's on deck,
what's blocked, what's waiting on Ken* across every project, reading `korg`
(the system of record) — plus a headless **curator** agent pass that writes
summaries and sequencing edges *back into korg* for the board to render.

Status: **built and in production** at
`https://kubsdb.encke-wahoo.ts.net:8100` — Fire Missions, On Deck, statline,
Commander's Call, Net Log, Deconfliction, Sensor Net, Operations and the
Ticker render production korg (sprints 001–008). Sprint 009 closed Phase 3
by moving the board off kai, its interim host, to kubsdb; kai keeps the
clone and the curator and serves nothing.

- Stack: SvelteKit + TypeScript, node adapter (adapter configured on the
  `sveltekit()` plugin in `vite.config.ts` — no `svelte.config.js`; that is
  the current scaffold style, not an omission). One server-only path to
  korg: `src/lib/server/korg.ts`; pure board derivations + types:
  `src/lib/board.ts` (three-part progress per korg #980, statline per D-3,
  ages against the board's `generated`), with per-feature derivations beside
  it in `netlog.ts` / `curator.ts` / `ticker.ts`; panels in
  `src/lib/panels/`. **Two transition feeds that must not converge**
  (sprint 008): the Net Log is observer-relative and speaks FDC, the Ticker
  is korg-authoritative and quotes korg verbatim — `docs/design.md` carries
  the measurement behind that split.
  `just check` runs the real gates (prettier/eslint, svelte-check, build,
  vitest + harness invariants). vitest has two projects (sprint 007):
  `server` (node) for everything, `client` (jsdom +
  `@testing-library/svelte`) for `*.svelte.test.ts` component tests — they
  partition on that one pattern, so a component test must carry the
  `.svelte.test.ts` suffix or it runs in the wrong environment.
- Deploy: **kfdc does not build in place** (sprint 005). `just publish`
  puts a versioned bundle in the homelab package store; `just deploy
  [version]` installs *that artifact* on the serving host and naming an
  older version is the rollback. The service runs out of
  `~/.local/share/kfdc/current`, not the clone, with placement (PORT,
  ORIGIN) in `~/.config/kfdc/kfdc.env` — which is why sprint 009's move to
  kubsdb changed no application code. **The clone and the service are on
  different machines now**: `KFDC_DEPLOY_HOST` in `.env` names the serving
  host, and `just deploy` / `just versions` reach it over ssh, where the
  remote fetches and checksum-verifies its own `install.sh`. Nothing is
  copied from the clone — a clone-less serving host is the point.
  `docs/deploying.md`; doctrine is k-homelab
  `docs/deploying.md`. Shipping deploys automatically: `.sprint-deploy`
  names the `deploy-board` skill, which sprint-ship's Phase 7 invokes after
  the merge (sprint 006 — before that the deploy was silently skipped). The
  curator is the one thing that still runs from the clone on kai, and stays
  there — its unit needs an explicit `Environment=PATH=` because a systemd
  *user* unit inherits no login PATH.
- Design: `docs/design/kfdc-concept.html` is the approved concept mockup
  (self-contained, open in a browser); `docs/design.md` records the visual
  identity and panel vocabulary. The FDC metaphor (fire missions / on deck /
  deconfliction / commander's call) is deliberate — Ken is ex-11C. Keep the
  vocabulary; keep the density.
- Architecture rule: **agents curate korg; the board renders korg.** The
  curator (sprint 003) writes typed edges and ⟦curator⟧-marked comments
  into korg — never a side file the board reads. `curator/prompt.md` is
  the single source of truth; `bin/update-fdc` runs it headless (daily
  timer `kfdc-curator.timer` on kai, `just curator` by hand) and the
  `/update-fdc` skill runs the same file interactively — never fork the
  prompt. The read side is `src/lib/curator.ts` (format is a contract:
  both sides move together). If a panel needs data korg can't hold,
  that's a korg work item, not a workaround.
- korg's production API runs on kubsdb:5674; kfdc reads it via REST through
  SvelteKit server routes (token in `.env`, never in the client).
- **The plan lives in korg, not in this repo** (sprint 009, #1189). "What's
  next for kfdc" is answered by the board itself —
  `https://kubsdb.encke-wahoo.ts.net:8100` — or by korg's Planning page, not
  by a markdown file. `sprints/planning/roadmap.md` is no longer a roadmap:
  it now holds the two-layer architecture decision, the standing
  constraints, and the record of what each phase built. Read it for *why*
  and *what was built*; never for *what's next*. Recorded-but-unbuilt ideas
  are korg #1202–#1207, unqueued on purpose.
- Read first: `sprints/planning/roadmap.md` (architecture + record),
  `docs/design.md`,
  `docs/design/kfdc-concept.html`. Cross-repo: `korg`
  (kai:~/src/tools/korg) owns the data model; `korg-dash`
  (kai:~/src/tools/korg-dash) stays the small-panel summary feed for
  kdeskdash — kfdc does not replace it; both consume korg's
  `GET /api/board` rollup.
