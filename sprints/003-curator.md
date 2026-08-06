# Sprint 003 — Curator: agents curate korg, the board renders it

korg proposal: **kfdc:999** · branch `003-curator` · started 2026-08-05

## Goal

The second layer of the two-layer architecture. A headless `claude -p`
curator on kai (kmon timer pattern) mines proposal/comment prose across the
live queue and writes durable, typed things back INTO korg — mission
synopses, sequencing/collision edges, all with mined-from provenance — and
the Deconfliction + Sensor Net panels render that output deterministically.
Sequenced #995 (harness) → #996 (mining pass) → #997 (panels); #998
(interactive skill over the same prompt) is stretch, droppable like 001's.

## Standing decisions honored (handoff korg:974, proposal notes — not relitigated)

- **Agents curate korg; the board renders korg.** No LLM in the render
  path; the curator writes into korg, never a side file the board reads.
- **Curator runs on kai** — `claude -p`, korg MCP and the kmon timer
  pattern already live there. No phase puts agent tooling on kubsdb.
  Record the timer/unit per record-machine-change when it lands.
- **Idempotence is a contract**: re-runs write nothing new when nothing
  changed. The live Net Log will visibly log any churn the curator causes,
  which makes sloppy passes embarrassing in exactly the right way.
- If korg's substrate lacks a needed label/type, or `GET /api/board`
  doesn't expose what #997 needs, that is a **korg WI first** — filed, not
  worked around.

## Substrate survey (korg docs/api.md, read at sprint start)

What korg holds today, measured before deciding the write vocabulary:

- **Label registry is closed and enforced** (LB-2): `covers`, `includes`,
  `finding`, `depends_on`, `related-to`, `has_handoff`. `relate` rejects
  anything else. Extending it is deliberately cheap: one entry in
  `korg_core::relationships` + `just gen` (has_handoff took this path).
- **`depends_on` is directed, any→any** — proposal→proposal is legal
  today. Reads "dependent depends on dependency", i.e. `Y depends_on X`
  is "Y after X". `related-to` is the only undirected label and is
  semantically vacuous ("the two nodes are related").
- **Edges carry write-side provenance** (`created` + self-reported
  `origin`) but **no read surface exposes it yet** — korg's docs name the
  first consumer as "likely the handoff flow"; the curator is now that
  consumer.
- **Comments are not nodes**: delete-only ("correcting them is the edit"),
  no author field, no archived state. A curator-owned comment must be
  identified by a body convention, not by authorship.
- **The board rollup carries no inter-proposal edges and no comments.**
  Rows are summary + covered rollup; `reports` rides newest-5 global.
  `finding` edges are report→workitem only, so a report cannot formally
  attach to a proposal.
- The concept's Deconfliction card shape (docs/design/kfdc-concept.html):
  two node chips, relation kind (`⟂ SAME CONTRACT` collision vs `⟵ AFTER`
  sequencing), a prose explanation, and a `mined from: <source>, <date>`
  line. The prose is load-bearing — a bare edge can't render this panel.

## Decisions made this sprint (write vocabulary settled with Ken, 2026-08-05)

- **Sequencing edge**: existing `depends_on` proposal→proposal — `Y
  depends_on X` reads "Y after X". Right semantics, zero korg surgery,
  same label the homelab-ai plan already uses cross-repo; curator writes
  are distinguishable via edge `origin`, not a parallel label.
- **Collision edge**: new undirected `collides-with` registry label —
  `related-to` is too vacuous to drive a Deconfliction card. Filed as
  korg #1002 (registry entry + `just gen`, the has_handoff path).
- **Synopsis + conflict prose home**: one curator-owned comment per
  proposal, first line the fixed marker `⟦curator⟧`, updated in place
  via `update_comment` only when content changes — idempotent, no thread
  pollution, never appended per pass.
- **Provenance format**: edges stamp `origin: "kfdc-curator"` on
  `relate`; comment bodies end with a trailer matching the concept
  mockup — `mined from: korg:<node> (<what>), observed <YYYY-MM-DD>`.
- **Board exposure**: korg WI #1003 — the rollup grows the curated layer
  (depends_on/collides-with edges among live proposals with
  origin/created, plus the ⟦curator⟧ comment per row). First read
  surface for LB-2's write-side edge provenance.
- **korg slice lands inside this sprint window** (Ken's call, with the
  refinement that it be tracked properly): filed as korg proposal
  **korg:1004** covering #1002 + #1003, marked *active*, branch
  `046-curated-layer` + `.korg-sprint-proposal` marker in
  kai:~/src/tools/korg — so the korg queue shows the slice as spoken for
  and no competing korg sprint gets started. Sequencing recorded at
  write time as a typed edge — kfdc:999 `depends_on` korg:1004 (rel
  702, origin `kfdc-sprint-003`) — the roadmap's direction-of-travel,
  dogfooded on its own sprint.

## Shipped

(filled as it lands)

## Follow-ups

(filled as they surface)
