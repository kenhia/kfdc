# Sprint 001 — walking skeleton: the board renders, live, at a URL

korg proposal: **kfdc:987** · branch `001-walking-skeleton` · started 2026-08-05

## Goal

First kfdc code. A SvelteKit board that renders live korg production data at a
ts.net URL: Fire Missions + On Deck + statline in the approved visual system,
deployed on kai via tailscale serve. Stretch: Commander's Call.

Scope (sequenced): #983 scaffold + `/api/board` proxy + real CI gates →
#984 panels + statline → #985 deploy → #986 stretch (droppable).

## Standing decisions honored (handoff korg:974 — not relitigated)

- SvelteKit + TypeScript, node adapter; korg REST via one server-route proxy.
- No LLM in the render path — the board renders korg deterministically.
- Visual system: `docs/design.md` tokens + `docs/design/kfdc-concept.html`.
  FDC vocabulary and density load-bearing; single-theme dark deliberate.
- Ages computed against the board's `generated` field (Postgres clock),
  never the browser clock.
- Progress renders three-part per korg #980: work-complete
  (resolved+done+closed) / Ken-verified (closed) / total.
- Statline derives from the lists (korg D-3, no counters block): live =
  `active.length + queue.length`, shipped = `proposals_omitted.done`,
  awaiting = `awaiting.length`, projects = `depth` filtered to active.

## Decisions made this sprint

- Scaffold: `sv create` output merged into the existing repo without
  disturbing the kproject harness files (CLAUDE.md managed block, README,
  docs/, sprints/, justfile kept).
- korg base URL + optional token live in `.env`
  (`KORG_URL`, `KORG_TOKEN` — token unused today, korg is no-auth on the
  tailnet; the proxy is the single place it would go).
- The page's server `load` and the `/api/board` proxy share one server-only
  fetch module (`src/lib/server/korg.ts`) so there is exactly one path to
  korg.
- On Deck renders queue order as delivered (pinned first, then rank) —
  no client-side re-sort.

## Shipped

(updated as the sprint progresses)

## Follow-ups

(recorded as they surface)
