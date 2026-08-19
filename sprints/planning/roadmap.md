# kfdc — architecture of record, and how it was built

> **The live plan is korg, and the board is how you read it.** This file
> stopped being the plan on 2026-08-12 (sprint 009, korg #1189). What
> remains here is the architecture that does not change and the record of
> what was built, both of which are history — and history does not drift.
> Plans do, which is why they left.

**Where to look for what:**

| Question | Answer |
|---|---|
| What's next for kfdc? | The board — <https://kubsdb.encke-wahoo.ts.net:8100> |
| Why is the board built this way? | Below, and `docs/design.md` |
| What did sprint N do? | `sprints/NNN-<name>.md` |
| How does it deploy? | `docs/deploying.md` |
| The recorded-but-unbuilt ideas? | korg kfdc #1202–#1207 (see below) |

If answering "what's next for kfdc" ever requires opening a file in this
repo again, the retirement did not hold.

## The two-layer architecture, decided up front

This is the load-bearing decision and it has not moved since 2026-08-04:

- **Deterministic layer** — the board renders korg reads only: queue by
  rank, active sprints, coverage, counts, staleness, awaiting-Ken. **No LLM
  in the render path, ever.**
- **Curator layer** — a headless agent (`claude -p`, kmon's timer pattern)
  that reads proposal/comment prose and writes durable, typed things *back
  into korg*: sequencing edges, mission synopses, report nodes. Agent as
  curator, never as renderer. Over time proposals record sequencing as
  typed edges at write time and the curator only catches strays.

## Standing constraints

These outlive any particular sprint, and a change that violates one is a
design change, not an implementation detail:

- **Agents curate korg; the board renders korg.** If a panel needs data
  korg cannot hold, that is a korg work item, not a side file the board
  reads.
- **The FDC vocabulary is deliberate.** Fire missions, on deck,
  deconfliction, commander's call. Ken is ex-11C. Keep it; keep the
  density. `docs/design.md` and `docs/design/kfdc-concept.html`.
- **Two transition feeds that must not converge.** The Net Log is
  observer-relative and speaks FDC; the Ticker is korg-authoritative and
  quotes korg verbatim. Measured and argued in sprint 008 — reopen only
  with a new measurement.
- **Honesty about absence.** An empty window renders no footer rather than
  an empty state that would read as a claim about history (sprint 008).
  Ages are computed against the board's own `generated`, never invented.
- **kfdc does not build in place.** `just publish` to the store, `just
  deploy` installs that artifact. `docs/deploying.md`. Since sprint 013
  `just deploy` is a **knarr** call, so the deploy mechanism is the fleet's,
  not kfdc's — changing it is a knarr work item. What stays kfdc's is
  `deploy/bootstrap.sh`: the once-per-host config and unit, which knarr will
  never write.
- **The curator runs on kai; the board runs on kubsdb.** kubsdb gets no
  agent tooling (k-homelab #988).

## What was built

The record. Each phase links its sprints; the sprint records carry the
detail and the decisions.

### Phase 0: korg prerequisites — COMPLETE 2026-08-05

Shipped as korg sprints 043 (971), 044 (972), 045 (973) plus the 825
sprint, all in one day. Dogfood done the same day: the first real program is
korg node 979 ("kfdc Phase 0 - the board substrate", slices
825→971→972→973). Board endpoint: `GET /api/board` on korg.

- [x] **Single-project proposals enforced, not conventional** — require a
      project on every new proposal; refuse a `covers` edge when the WI's
      project differs from the proposal's. (The 2026-07-23 linking-layer
      review measured exactly one real cross-project `covers` edge — the
      rest were artifacts.)
- [x] **korg proposal 825 lands** — proposal membership on rows and rails;
      the substrate for "what's spoken for".
- [x] **`program` node type** — the multi-project layer. A program `covers`
      *proposals* (ordered); proposals stay strictly single-project.
- [x] **"Awaiting Ken" expressible** — a flag agents can set and one read
      can list. Commander's Call renders it.
- [x] **Board rollup read** — one call returning active sprints + queue +
      programs + blocked/awaiting, so the board is one request, not a
      17-call crawl.

### Phase 1: walking skeleton — BUILT 2026-08-05

Sprint 001 (proposal kfdc:987): all four WIs including the stretch.
Record: `sprints/001-walking-skeleton.md`.

- [x] SvelteKit + TypeScript scaffold (node adapter); `just check` rewired
      to real gates.
- [x] Fire Missions + On Deck rendered deterministically from korg REST via
      server routes; token in `.env`.
- [x] Concept CSS applied; tailscale serve, one ts.net URL.
- [x] Stretch #986 taken: Commander's Call from `board.awaiting`.

### Phase 1.5: Net Log — BUILT 2026-08-05

Added after the first real loss: sprint-ship + refresh removed a fire
mission AND a commander's-call row, and nothing said which. The board
renders state; transitions vanish between glances. Sprint 002 (proposal
kfdc:994). Record: `sprints/002-net-log.md`.

- [x] #992 Observer: every `fetchBoard` observes, diffs against the last
      digest, appends to JSONL in `~/.local/state/kfdc` (~30d retention,
      survives redeploys). Viewer state, not work data.
- [x] #993 Strip: full-width under the panels, one line per change, panel
      codes FM/CC/OD/OP, ids deep-linked where korg has a page.

### Phase 2: curator — BUILT 2026-08-06

Write vocabulary decided with Ken 2026-08-05: `depends_on` for mined
sequencing, `collides-with` for collisions, one `⟦curator⟧`-marked comment
per proposal for synopses, `origin: "kfdc-curator"` on every edge. Sprint
003 (proposal kfdc:999). Record: `sprints/003-curator.md`.

- [x] #995 Curator prompt in-repo (`curator/prompt.md`, the single source
      of truth) + `bin/update-fdc` + `kfdc-curator.timer`. The *timer* was
      in fact dead from here until sprint 006 (#1040): a systemd user unit
      inherits no PATH, so `exec claude` exited 127 while both hand-run
      paths kept working. Only kmon noticed.
- [x] #996 Two supervised passes against production: 3 sequencing edges + 9
      synopses, all provenance-stamped. Re-run wrote zero edges and zero
      duplicate synopses — the mechanical idempotence contract.
- [x] #997 Deconfliction + Sensor Net panels render `proposal_edges` +
      `synopsis` + `reports`; parser pins a real body as a test fixture.
- [x] #998 Stretch: `/update-fdc` runs the same prompt interactively.

### Phase 3: full board, and switch over — COMPLETE 2026-08-12

Filed into korg 2026-08-11 as program **korg:1192**. Sprint 009 closed it.

- [x] **Operations (programs) panel** — sprint 004 (proposal kfdc:1030:
      #1029 + ride-alongs #990 SPLASH, #1027 arrow).
      `sprints/004-operations-panel.md`.
- [x] **Deploy from the store** — sprint 005 (proposal korg:1024, #1014),
      slice 4 of program korg:1026. The service runs out of
      `~/.local/share/kfdc/current`, so it no longer depends on the clone —
      which is what turned the kubsdb move from a rebuild into a placement
      change. `sprints/005-deploy-from-store.md`; `docs/deploying.md`.
      Sprint 006 (#1035) made shipping *invoke* it.
- [x] **Program-ordered work renders once** — sprint 007 (proposal
      korg:1077, #1064 + #1070 + #1102), slice 2 of program korg:1078. On
      Deck collapses a program's queue rows into one; Deconfliction sets
      aside dependencies korg reports as `sequenced_by` a live program.
      `sprints/007-program-rollup.md`.
- [x] **Ticker from korg events** — sprint 008 (proposal korg:1190, #1186 +
      #1187 + #1183), slice 1 of program korg:1192. #1186 measured the two
      feeds against live production and kept them separate. **The Phase-1.5
      promise to enrich Net Log lines is deliberately not kept** — the
      argument is a comment on korg:1186. `sprints/008-ticker.md`.
- [x] **Production placement: the board moved to kubsdb** — sprint 009
      (proposal korg:1191, #1188), slice 2 of program korg:1192. Same
      published artifact fetched on kubsdb, Net Log store carried across
      before first start, kai's unit and `:8100` retired,
      `manifests/{kai,kubsdb}.yml` filed as kenhia/k-homelab#39.
      `sprints/009-production-placement.md`.
- [x] **This roadmap retired into korg** — sprint 009 (#1189). The plan is
      korg rows; this file is architecture and record.

## Recorded but unbuilt

*Later / Ideas* lived here until sprint 009. It is now korg work items —
**unqueued on purpose**, because preservation is not queue-stuffing — each
carrying its recorded design verbatim rather than a summary of it, since
the decisions were in the detail:

| | |
|---|---|
| #1202 | Transmit drawer — one-shot missions dispatched from the board |
| #1203 | Expanded mode — korg in an iframe pane right of the board |
| #1204 | Wall mode — auto-refresh, zero chrome |
| #1205 | Deterministic collision hints feeding the curator |
| #1206 | Session-freshness feed |
| #1207 | kdeskdash deep-link; korg-dash on the same rollup |

Do not re-add them here. They drifted out of a plan document once already,
which is the whole argument for this file no longer being one.
