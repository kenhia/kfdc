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

## Now — Phase 0: korg prerequisites

The build work lives in the **korg** project (proposals to be filed); tracked
here because kfdc is blocked on it.

- [ ] **Single-project proposals enforced, not conventional** — require a
      project on every new proposal; refuse a `covers` edge when the WI's
      project differs from the proposal's; backfill the 6 mechanically
      resolvable project-less proposals. (The 2026-07-23 linking-layer review
      measured exactly one real cross-project `covers` edge — the rest are
      artifacts.)
- [ ] **korg proposal 825 lands** (proposal membership on rows and rails) —
      already queued at rank 6.5; it is the substrate for "what's spoken
      for". Sequencing recorded on 825: after #817's page rewrite; fold with
      #861's contract revision, whichever lands second.
- [ ] **`program` node type** — the multi-project layer. A program `covers`
      *proposals* (ordered), and occasionally standalone WIs; proposals stay
      strictly single-project. Replaces the informal markdown "program plan"
      pattern (project-routing 2026-07-31, infra-cleanup 2026-08).
- [ ] **"Awaiting Ken" expressible** — an edge or flag agents can set and
      one read can list. Commander's Call renders it.
- [ ] **Board rollup read** — one call returning active sprints + queue +
      programs + blocked/awaiting, so the board is one request, not a
      17-call crawl.

## Next — Phase 1: walking skeleton

- [ ] SvelteKit + TypeScript scaffold (node adapter); `just check` rewired
      to real gates (lint, svelte-check, build, test).
- [ ] Fire Missions + On Deck panels rendered deterministically from korg
      REST via server routes; token in `.env`.
- [ ] Concept CSS applied (tokens in `docs/design.md`); tailscale serve on
      kai, one ts.net URL.

## Phase 2: curator

- [ ] Curator prompt in-repo + `bin/update-fdc` wrapper (headless
      `claude -p` with korg MCP; runnable by hand and by systemd user
      timer — kmon pattern).
- [ ] Mission synopses + deconfliction mined from proposal prose → written
      into korg as typed edges/comments with a `mined-from` provenance note.
- [ ] Deconfliction + Sensor Net panels render the curator's output from
      korg.
- [ ] Optional `update-fdc` skill as interactive sugar over the same prompt.

## Phase 3: full board — switch over

- [ ] Operations (programs) + Commander's Call panels once the Phase-0 node
      types land.
- [ ] Ticker from korg events/reports.
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
