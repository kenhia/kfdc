# Sprint 002 — Net Log: the board remembers what it showed

korg proposal: **kfdc:994** · branch `002-net-log` · started 2026-08-05

## Goal

Born from a real loss: sprint-ship + refresh silently removed a fire mission
AND a commander's-call row, and nothing said which. A server-side observer
digests every board read (plus a modest interval poll), diffs against the
last digest, and appends significant changes to a small local store (#992);
a full-width strip under the panels renders the traffic (#993). Sequenced
#992 → #993, one PR.

## Standing decisions honored (handoff korg:974, proposal notes — not relitigated)

- **Viewer state, not work data.** The store holds what THIS board showed —
  "since Ken last looked" is observer-relative. korg #977 (transition log)
  stays the principled home for work history; no korg write grew out of this
  sprint.
- **Honesty rule**: every line carries its observation time (the observing
  board's `generated`, Postgres's clock — same convention as ages) and never
  invents precision between observations.
- Poll is modest: 3 minutes (inside the proposal's 2–5 band) — continuity,
  not surveillance-grade resolution.
- Line format is Ken's, verbatim; panel codes FM/CC/OD/OP.

## Decisions made this sprint

- **JSONL over SQLite**: no native dependency, append-only by nature, ~30d
  of lines is a few KB. `netlog.jsonl` + `last-digest.json` (the baseline a
  restart resumes from) per directory.
- **Store location**: prod `KFDC_STATE_DIR` or `~/.local/state/kfdc`
  (outside the build tree — survives redeploys; created by the app, no unit
  change and no machine-change record needed). Dev uses the repo's
  git-ignored `.scratch/netlog` so a dev server on kai never pollutes the
  transcript prod is writing.
- **One hook point**: `fetchBoard` observes, so the page load, the
  `/api/board` proxy, the deploy healthcheck and the interval poll are all
  the same observation path. The poll lives in `hooks.server.ts` `init`
  (HMR-guarded), which also compacts retention daily.
- **Diff vocabulary v1** (expand only deliberately): FM `firing` /
  `splash … work complete` (first transition to all-work-complete) /
  `complete … proposal completed` (departure while `proposals_omitted.done`
  rose) / `out … left the board` / `out … back on deck`; CC `call made`
  (with the awaiting note) / `cleared`; OD `on deck` / `off deck` — rank
  shuffles are silent *by construction* (rank is not in the digest), and
  promotion/demotion collapses to the FM line alone; OP `status a→b` only.
- **Splash now, not gated on #990**: the observer emits `splash` on the
  work-complete transition today; #990 is the board's visual SPLASH state
  and lands independently.
- **Deep links mirror korg's own AwaitingLane scheme** (found via klams):
  WI → `/work-items?wi=N`, program → `/programs/:id`, proposal →
  `/planning`; anything else renders unlinked rather than faking a URL —
  the per-node deep-link gap is korg's.
- Stale/duplicate reads (same or older `generated` than the last digest)
  are not observations — no diff, no lines.

## Shipped

- **#992** — pure digest/diff/format derivations in `src/lib/netlog.ts`
  (written test-first; Ken's example lines are literal test expectations);
  append-only JSONL store factory in `src/lib/server/netlog-store.ts`
  (baseline-silently, restart-survival, 30d compaction — all tested);
  wiring in `src/lib/server/netlog.ts` + observe call in `fetchBoard` +
  3-minute poll in `src/hooks.server.ts`.
- **#993** — `NetLog.svelte`: full-width strip under the three panels,
  separator line above, mono, newest-first, last 20 lines, muted
  observation stamps (`08-05 20:43Z`), panel codes colored to their panel
  accents (FM amber, CC red, OD cyan, OP green), IDs deep-linked into korg.
  `GET /api/netlog?n=` serves the store (no korg call). Verified end-to-end
  in dev against production korg by doctoring the saved digest and watching
  `FM: firing` / `CC: cleared` lines render with correct links.

## Follow-ups

- When korg #977 (transition log) lands, enrich lines with real actor/exact
  time; the observer keeps owning recency-relative truth.
- When kfdc #990 (SPLASH board state) lands, the strip's `splash` lines get
  a visual counterpart on the FM cards.
- Wall mode (roadmap Later) would want the strip to refresh client-side;
  today it renders per page load like everything else.
