<!-- kproject:begin — managed by kprojects/install.sh; do not edit inside this block -->
## kproject conventions

This project uses the kproject minimal harness
(`~/src/ai-agents/kprojects`). Keep context small; prefer doing over
ceremony.

### Layout

- `sprints/` — the project's evolution, one record per PR-sized unit of
  work (a "sprint")
  - `planning/` — planning docs; at minimum `roadmap.md` (the general plan)
  - `review/` — more formal reviews as the project matures
  - sprint records: `###-<short-name>.md` for small projects, or a
    `###-<short-name>/` directory of files for larger/more formal ones
  - a sprint record is one informal narrative: goal, decisions, what
    shipped, follow-ups — written during the sprint, not after
- `docs/` — project documentation, architecture, usage
- `.scratch/` — git-ignored scratch space for user or agent ephemera;
  use it instead of /tmp
- `justfile` — dev recipes; default recipe is `@just --list`; `just check`
  runs the CI gates; `just deploy` (or variants) if the project deploys
- `.env` — git-ignored; tokens and environment vars

### Workflow

- One sprint ≈ one PR. Sprint proposals and work items are managed in
  `korg`; durable cross-project knowledge goes in `klams`.
- If the korg or klams MCP tools are unavailable in your session, say so
  up front — don't silently work around missing infrastructure.
- TDD preferred: write the failing test first when practical.

### Tooling preferences

- Python managed by `uv`; lint/format with `ruff`; typecheck with `ty`
  (astral toolchain)
- License is MIT unless specifically directed otherwise
<!-- kproject:end -->

## Project

kfdc — **K Fire Direction Center**: the homelab overseer board. A widescreen,
deliberately dense web dashboard that answers *what's firing, what's on deck,
what's blocked, what's waiting on Ken* across every project, reading `korg`
(the system of record) — plus a headless **curator** agent pass that writes
summaries and sequencing edges *back into korg* for the board to render.

Status: **Phase 2 live** at `https://kai.encke-wahoo.ts.net:8100` — Fire
Missions, On Deck, statline, Commander's Call, Net Log, Deconfliction,
Sensor Net and Operations render production korg (sprints 001–004). kai is
the interim host; production moves to kubsdb in Phase 3. The plan onward is
`sprints/planning/roadmap.md`. Read it before doing anything.

- Stack: SvelteKit + TypeScript, node adapter (adapter configured on the
  `sveltekit()` plugin in `vite.config.ts` — no `svelte.config.js`; that is
  the current scaffold style, not an omission). One server-only path to
  korg: `src/lib/server/korg.ts`; pure board derivations + types:
  `src/lib/board.ts` (three-part progress per korg #980, statline per D-3,
  ages against the board's `generated`); panels in `src/lib/panels/`.
  `just check` runs the real gates (prettier/eslint, svelte-check, build,
  vitest + harness invariants).
- Deploy: **kfdc does not build in place** (sprint 005). `just publish`
  puts a versioned bundle in the homelab package store; `just deploy
  [version]` installs *that artifact* on the serving host and naming an
  older version is the rollback. The service runs out of
  `~/.local/share/kfdc/current`, not the clone, with placement (PORT,
  ORIGIN) in `~/.config/kfdc/kfdc.env` — which is why moving to kubsdb
  touches no file here. `docs/deploying.md`; doctrine is k-homelab
  `docs/deploying.md`. The curator is the one thing that still runs from
  the clone on kai, and stays there.
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
- Read first: `sprints/planning/roadmap.md`, `docs/design.md`,
  `docs/design/kfdc-concept.html`. Cross-repo: `korg`
  (kai:~/src/tools/korg) owns the data model; `korg-dash`
  (kai:~/src/tools/korg-dash) stays the small-panel summary feed for
  kdeskdash — kfdc does not replace it; both consume korg's
  `GET /api/board` rollup.
