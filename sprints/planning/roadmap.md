# Roadmap — get to kfdc

> This markdown *is* the plan while kfdc is being built. Once Phase 3 lands,
> the plan moves into korg (programs + proposals) and kfdc becomes the way
> to see kfdc. Keep it current; detail lives in the sprint records.

kfdc answers the question Ken can no longer hold in his head: overall status,
what's actively being worked (project + synopsis), what's related, what's
blocked, what's waiting on him — across ~29 active projects. The approved
concept is `docs/design/kfdc-concept.html` (2026-08-04, populated with real
korg data).

Two-layer architecture, decided up front:

- **Deterministic layer** — the board renders korg reads only: queue by rank,
  active sprints, coverage, counts, staleness, awaiting-Ken. No LLM in the
  render path, ever.
- **Curator layer** — a headless agent (`claude -p`, kmon's timer pattern)
  that reads proposal/comment prose and writes durable, typed things *back
  into korg*: sequencing edges, mission synopses, report nodes. Agent as
  curator, never as renderer. Over time proposals record sequencing as typed
  edges at write time and the curator only catches strays.

## Phase 0: korg prerequisites — COMPLETE 2026-08-05

Shipped as korg sprints 043 (971), 044 (972), 045 (973) plus the 825 sprint,
all in one day. Dogfood done the same day: the first real program is korg
node 979 ("kfdc Phase 0 - the board substrate", slices 825→971→972→973) and
the awaiting lane is seeded with live rows (#964 khound call, #841, #842,
and 979 itself — closes when Ken's user test passes). Board endpoint:
`GET /api/board` on korg.

- [x] **Single-project proposals enforced, not conventional** — require a
      project on every new proposal; refuse a `covers` edge when the WI's
      project differs from the proposal's; backfill the 6 mechanically
      resolvable project-less proposals. (The 2026-07-23 linking-layer review
      measured exactly one real cross-project `covers` edge — the rest are
      artifacts.)
- [x] **korg proposal 825 lands** (proposal membership on rows and rails) —
      already queued at rank 6.5; it is the substrate for "what's spoken
      for". Sequencing recorded on 825: after #817's page rewrite; fold with
      #861's contract revision, whichever lands second.
- [x] **`program` node type** — the multi-project layer. A program `covers`
      *proposals* (ordered), and occasionally standalone WIs; proposals stay
      strictly single-project. Replaces the informal markdown "program plan"
      pattern (project-routing 2026-07-31, infra-cleanup 2026-08).
- [x] **"Awaiting Ken" expressible** — an edge or flag agents can set and
      one read can list. Commander's Call renders it.
- [x] **Board rollup read** — one call returning active sprints + queue +
      programs + blocked/awaiting, so the board is one request, not a
      17-call crawl.

## Phase 1: walking skeleton — BUILT 2026-08-05, awaiting Ken's user test

Sprint 001 (proposal kfdc:987): all four WIs including the stretch. The
board is live at **https://kai.encke-wahoo.ts.net:8100** — Fire Missions,
On Deck (+depth), statline, Commander's Call, rendering production korg.
Record: `sprints/001-walking-skeleton.md`.

- [x] SvelteKit + TypeScript scaffold (node adapter); `just check` rewired
      to real gates (lint, svelte-check, build, test).
- [x] Fire Missions + On Deck panels rendered deterministically from korg
      REST via server routes; token in `.env`.
- [x] Concept CSS applied (tokens in `docs/design.md`); tailscale serve on
      kai, one ts.net URL.
- [x] Stretch #986 taken: Commander's Call from `board.awaiting`.

## Phase 1.5: Net Log — BUILT 2026-08-05 (sprint 002, proposal kfdc:994)

Added 2026-08-05 after the first real loss: sprint-ship + refresh removed a
fire mission AND a commander's-call row, and nothing said which. The board
renders state; transitions vanish between glances. Record:
`sprints/002-net-log.md`.

- [x] #992 Observer: every `fetchBoard` observes (page load, proxy, and a
      3-min poll from `hooks.server.ts`), diffs against the last digest,
      appends to JSONL in `~/.local/state/kfdc` (~30d retention, survives
      redeploys). Viewer state, not work data — korg #977 stays the
      principled home for work history; lines carry observation time,
      never invented precision.
- [x] #993 Strip: full-width under the panels, separator above, one line
      per change — `FM: complete kfdc 984 - proposal completed` — panel
      codes FM/CC/OD/OP, ids deep-linked where korg has a page (korg's own
      AwaitingLane scheme).

## Phase 2: curator — BUILT 2026-08-06 (sprint 003, proposal kfdc:999)

Write vocabulary decided with Ken 2026-08-05 (recorded in
`sprints/003-curator.md`): `depends_on` for mined sequencing,
new `collides-with` registry label for collisions, one `⟦curator⟧`-marked
comment per proposal for synopses, `origin: "kfdc-curator"` on every edge.
The korg substrate slice (label + board `proposal_edges`/`synopsis`) landed
as korg sprint 046 / proposal korg:1004 inside this sprint window —
sequencing recorded at write time as kfdc:999 `depends_on` korg:1004, the
direction of travel's first instance. Curator runs on kai (kmon timer).

- [x] #995 Curator prompt in-repo (`curator/prompt.md`, the single source
      of truth) + `bin/update-fdc` (headless `claude -p`, korg-only tools)
      + `kfdc-curator.timer` (daily 10:30 UTC).
- [x] #996 Two supervised passes against production: 3 sequencing edges +
      9 synopses, all provenance-stamped; ambiguous references dropped
      with reasons. Re-run wrote zero edges and zero duplicate/changed
      synopses (the mechanical idempotence contract); the synopsis-worthy
      threshold wobbled once (3 rows skipped by pass 1, written by pass
      2), answered with a never-rephrase rule in the prompt.
- [x] #997 Deconfliction + Sensor Net panels render `proposal_edges` +
      `synopsis` + `reports`; Fire Missions cards carry the synopsis line;
      parser pins the first real body as a test fixture.
- [x] #998 Stretch taken: `/update-fdc` skill runs the same prompt
      interactively.

## Phase 3: full board — switch over

- [ ] Operations (programs) panel. (Commander's Call shipped early —
      sprint 001 took the stretch.)
- [ ] Ticker from korg events/reports.
- [ ] Production deploy: move kfdc hosting to **kubsdb** alongside korg;
      retire kai's interim unit + serve entry (recorded as k-homelab #988,
      whose comment carries the fold-in-then-retire plan). kai:8100 stays
      the dev host until then; kubsdb needs no agent tooling for this.
- [ ] Retire this roadmap into korg: file the remaining plan as a program,
      manage kfdc *in* kfdc.

## Later / Ideas

- kdeskdash tile deep-linking to the board; korg-dash consumes the same
  rollup read for the Pi panel.
- Deterministic collision hints (same-contract / same-file heuristics)
  feeding the curator.
- Wall mode: auto-refresh, zero chrome, for the widescreen monitor.
- Expanded mode: korg hosted in an iframe pane right of the board — click a
  WI/proposal and the pane deep-links to the item in the real korg UI. Keeps
  kfdc edit-free: the board renders only the rollup; the full node (notes,
  comments, edit, clear-awaiting) is always real korg in the pane. korg
  prereqs when picked up: stable per-node deep-link routes (also serves
  korg-vs resolve-by-ID) and a frame-ancestors policy allowing kfdc's
  ts.net origin; v1 control is one-way (`iframe.src`), no postMessage.
  Interim: kfdc + korg as two grouped windows and Alt-Tab. Decided
  2026-08-05; build after kfdc has some mileage.
- Session-freshness feed (which sprints have live agent activity).
- Transmit drawer (Ken, 2026-08-05): collapsed chat strip between the
  panels and the Net Log — type a one-shot mission, dispatched to headless
  `claude -p` (Sonnet default, Opus button) via the Phase-2 curator harness
  on kai, which it reuses (sequence AFTER Phase 2; also survives the
  Phase-3 kubsdb move, since the runner stays on kai). Wrapper prompt:
  background one-shot, constrained tools (korg/klams MCP, no shell),
  outcome written as a korg comment/report on the node acted on — never a
  side file — so the board and Net Log show the result through the normal
  path (the Net Log is the read-back). On ambiguity the runner does not
  guess: it comments its question and sets awaiting — the ask comes back
  to Ken on the board itself. Click a row → drawer prefills
  `re: <project> <id>` for zero-alt-tab locality. Endpoint needs a trivial
  token (tailnet-only but still arbitrary-agent-execution). Does NOT
  replace korg #981 — register-decision-and-clear stays deterministic.
