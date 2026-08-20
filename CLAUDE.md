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
- A few projects share contract surfaces with siblings and have a
  **guiding plan** constraining how those change; most have none, and one
  grep is the whole cost of finding out. Grep the `index.md` routing
  table in `kai:~/src/tools/cross-project-planning` — a local path on
  kai, read through kaed from any other host (`root: "kai:src"`, path
  `tools/cross-project-planning/…`); don't clone a second copy. Not
  listed → nothing applies. Listed → read the mapped plan folder before
  planning sessions and before changing a contract surface it names, and
  amend the plan in the same ship when what you build diverges from it.
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
clone and the curator and serves nothing. Sprint 014 added **wall mode** at
`/wall` on the same service — unattended widescreen: no chrome, self-
refreshing on the board's own poll cadence, and it keeps the last good board
marked `NO REFRESH` through a korg outage rather than blanking to No Comms.
`docs/design.md` § Wall mode carries the rules, notably that the wall draws
no affordance it cannot honour. Sprint 016 added **expanded mode** on `/`:
clicking any ref opens *real korg* in an iframe pane beside the board
(korg's `/n/:node_id` plus its `frame-ancestors` allowlist, korg sprint
070). That is what makes kfdc edit-free by construction rather than by
discipline — the board renders the rollup and **delegates** the node, so
there is no gap for an edit surface to grow into (korg+ GP-1/GP-18). Refs
are real `<a href>`s first and the pane takes only the plain left-click; the
wall gets a *disabled* pane, so its refs stay ordinary links. **Every korg
URL is built by `src/lib/korglink.ts` and takes no `kind`** — a
consumer-side kind→path map is forbidden (GP-16), and the one kfdc kept
until sprint 016 emitted a URL korg never served. The pane cannot render
under `npm run dev`: 127.0.0.1 is not on korg's allowlist, which is correct
default-closed behaviour, not a bug. Sprint 017 gave the pane its width back
and kfdc its **first client-side preference**: a gear right of the statline
(`src/lib/MastheadControl.svelte`, a reusable slot — #1202's drawer supplies
contents and nothing else) opening a settings popover whose one setting is
pane width. **px in, percent stored** in `localStorage`
(`src/lib/settings.svelte.ts`); the percent is of `.deck`'s content box, not
the viewport. The pane's upper bound is a **floor under the board**
(`calc(100% - 640px - 14px)`), never a cap on the pane — 016's fixed `900px`
pinned the pane on a 3440px screen and would have silently discarded any
setting, which is the bug wearing a settings dialog. Nothing stored means no
`--pane-w` at all, so app.css keeps the single default. No gear on `/wall`.
`docs/design.md` § Expanded mode. Sprint 018 stopped the desk **reloading**:
both routes now hold their payload in one `BoardFeed`
(`src/lib/feed.svelte.ts`) and replace it from `/api/page` — the desk on a ↻
beside the gear and on `Ctrl+R`/`F5`, the wall on its timer. `Ctrl+Shift+R`
is deliberately never claimed. The korg pane surviving is a **consequence of
not unmounting**, not a feature: the iframe keeps exactly what it was
showing, which no restore can match. `sessionStorage` (`kfdc.pane.v1`,
restored from an *effect*, never the constructor — the server renders the
pane closed and an `{#if}` that differs is a hydration mismatch) is only the
floor under the two reload paths no page can intercept, and it restores only
the node kfdc set. Also sprint 018: the pane's **capability surface is a
knob** — `allow="clipboard-write"` on the iframe, which is delegation, not
the `postMessage` channel GP-17 forbids; the next "X doesn't work in the
pane" goes to that list first. And the installed app finally gets the
reticle instead of a generated "K" (`static/manifest.webmanifest` + committed
32/128/192/512 rasters, declared in `src/app.html` so the paths stay
un-hashed) — **Edge caches the shortcut icon at install time, so seeing it
takes an uninstall/reinstall**. `docs/design.md` §§ Staying current, Expanded
mode, The installed app.

- Stack: SvelteKit + TypeScript, node adapter (adapter configured on the
  `sveltekit()` plugin in `vite.config.ts` — no `svelte.config.js`; that is
  the current scaffold style, not an omission). One server-only path to
  korg: `src/lib/server/korg.ts`; pure board derivations + types:
  `src/lib/board.ts` (three-part progress per korg #980, statline per D-3,
  ages against the board's `generated`), with per-feature derivations beside
  it in `netlog.ts` / `curator.ts` / `ticker.ts`; panels in
  `src/lib/panels/`. The layout itself is `src/lib/Board.svelte` — **two
  routes render it**: `/` (desk) and `/wall` (sprint 014). Wall mode is a
  display MODE, not a second layout, so a panel that differs there takes a
  `wall` prop; anything wanting a different layout means the desk board's
  density was wrong. **Two transition feeds that must not converge**
  (sprint 008): the Net Log is observer-relative and speaks FDC, the Ticker
  is korg-authoritative and quotes korg verbatim — `docs/design.md` carries
  the measurement behind that split.
  `just check` runs the real gates (prettier/eslint, svelte-check, build,
  vitest + harness invariants). vitest has two projects (sprint 007):
  `server` (node) for everything, `client` (jsdom +
  `@testing-library/svelte`) for `*.svelte.test.ts` component tests — they
  partition on that one pattern, so a component test must carry the
  `.svelte.test.ts` suffix or it runs in the wrong environment. The same
  suffix carries rune-using `.svelte.ts` modules' tests (`feed.svelte.ts`).
  Some things kfdc can get wrong are **layout**, which jsdom cannot see:
  #1284 and #1460 were found and negative-tested with a headless browser run
  from `.scratch/`, deliberately not a dependency and deliberately not a
  `just check` gate. Sprint 018 added the other half of that lesson: a
  headless run can **measure an artifact** — its first hotkey pass concluded
  Ctrl+R was intercepted when headless Chromium simply has no browser UI to
  service a reload, which the wall (arming nothing) exposed by "surviving"
  identically. Always run the negative control. The numbers live in the sprint record; the rule they
  produced lives in `docs/design.md` (*nothing renders past its box*).
- Deploy: **kfdc does not build in place** (sprint 005). `just publish`
  puts a versioned bundle in the homelab package store; `just deploy
  [version]` installs *that artifact* on the serving host and naming an
  older version is the rollback. The service runs out of
  `~/.local/share/kfdc/current`, not the clone, with placement (PORT,
  ORIGIN) in `~/.config/kfdc/kfdc.env` — which is why sprint 009's move to
  kubsdb changed no application code. **The clone and the service are on
  different machines now**: `KFDC_DEPLOY_HOST` in `.env` names the serving
  host. Since sprint 013 `just deploy` is **one `knarr` call** — the fleet
  deploy runner — not a hand-rolled ssh bootstrap; `deploy/install.sh` is
  gone and `deploy/bootstrap.sh` keeps only what knarr never does (seed
  config, install the unit), refusing to run once both exist. knarr fetches
  and verifies the bundle *here* and uploads the verified bytes, so the
  serving host no longer needs the store for a deploy, and exit 2 literally
  means the host was never touched. Verification reads knarr's JSON status
  document — assert the `confirm` **step**, not just `ok: true`. Nothing is
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
  Since sprint 015 the curator's input has a second, **deterministic** half:
  `bin/collision-hints` (pure logic `curator/hints.ts`, I/O
  `curator/hints-run.ts`) finds live proposals naming the same file,
  endpoint or contract symbol and appends candidates to the prompt on stdin —
  because the curator's locked-down tool surface means it cannot run a script.
  It reads korg and writes nothing: the curator still decides and still
  writes every edge, so this is not a second writer. An **absent** block means
  the hint pass did not run; a block saying `none` means it ran and found
  nothing — `bin/update-fdc` and the prompt both depend on that distinction.
  `curator/` is deliberately not under `src/lib` (that is the board's
  library, and collision derivation there would read as the board deriving
  collisions), so `tsconfig.json` overrides svelte-kit's generated `include`
  and `vite.config.ts` adds `curator/**` to the `server` test project — both
  gates reach it, and both were negative-tested.
- korg's production API runs on kubsdb:5674; kfdc reads it via REST through
  SvelteKit server routes (token in `.env`, never in the client).
- **The plan lives in korg, not in this repo** (sprint 009, #1189). "What's
  next for kfdc" is answered by the board itself —
  `https://kubsdb.encke-wahoo.ts.net:8100` — or by korg's Planning page, not
  by a markdown file. `sprints/planning/roadmap.md` is no longer a roadmap:
  it now holds the two-layer architecture decision, the standing
  constraints, and the record of what each phase built. Read it for *why*
  and *what was built*; never for *what's next*. The recorded-but-unbuilt
  ideas were korg #1202–#1207; the 2026-08-19 sweep queued #1204 and #1205
  and left #1202, #1203, #1206 and #1207 unqueued, each with a comment
  saying why. Don't re-derive those reasons — read the comment.
- Read first: `sprints/planning/roadmap.md` (architecture + record),
  `docs/design.md`,
  `docs/design/kfdc-concept.html`. Cross-repo: `korg`
  (kai:~/src/tools/korg) owns the data model; `korg-dash`
  (kai:~/src/tools/korg-dash) stays the small-panel summary feed for
  kdeskdash — kfdc does not replace it; both consume korg's
  `GET /api/board` rollup.
