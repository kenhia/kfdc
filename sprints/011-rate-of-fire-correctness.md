# 011 — Rate of Fire: correct the delta, and label the partial durable-in

Proposal korg:1436 (slice 2 of program korg:1437). One item: **#1434**.

Ken read the live header and could not reconcile it:

    in 119  out 136  durable out 42  backlog 157  -8/6d

`119 − 136` is `−17`. He was right to be suspicious, and the panel was
wrong twice over — once already, once about to be.

## Fix 1 — the delta had no baseline to measure from

`rateOfFire` computed `bars[n-1].backlog - bars[0].backlog`. Every row's
`backlog` is that day's **end**, so `bars[0]` already has day one's own
arrivals and closures applied: the delta spanned N−1 days while
`added`/`closed` totalled N, and both wore the same `/6d` label.

The series was never wrong — every row reconciles exactly against the one
before it. It was being asked a question its rows structurally cannot
answer, which is why the fix belonged to korg and not here. korg #1432
put `backlog_before` on the envelope (korg sprint 067); this sprint
consumes it.

    backlogDelta = bars[n-1].backlog - backlog_before   ✅
    backlogDelta = bars[n-1].backlog - bars[0].backlog  ❌ eats day one's net

`backlogDelta` is now `number | null`. **No baseline, no delta** — korg
sends `null` at the horizon, and a korg predating #1432 omits the field
entirely; both render nothing rather than a number. Falling back to
`bars[0]` *is* the bug, so the type makes the fallback unreachable rather
than merely discouraged. `typeof === 'number'` guards it, so a legitimate
`backlog_before: 0` still yields a delta — a zero is a real backlog
level, not a missing one, and there is a test pinning that apart.

The rejected alternative — fetch `days + 1` and slice off the first row —
is now a cross-project decision, not a preference: **GP-13** in
`korg+/PLAN.md`, authored from this program's korg half. It puts horizon
reasoning back in the consumer, which the endpoint's own contract tells
callers not to do, and degrades silently to N−1 days under an N-day
label: the same class of bug.

## Fix 2 — the widening made "durable in" partial

At 6 days `added_durable` was structurally zero across the whole window
(nothing could reach `durable_after_days` = 7), so the panel showed no
durable-in figure at all. Correct, and the reason Ken had never seen one.

korg #1433 widened the default to 10 and that ends. The oldest ~3 days
now clear the lag and carry real `added_durable`, so a summed durable-in
covers **3 days** while the `durable out` beside it covers **10**. Two
numbers on one line implying a comparison they do not support — the same
misreading the panel exists to kill, one column to the left.

Took option 1 of #1434's preference order: **name the span**.
`totals.addedDurableDays` is now derived alongside the sum, and the panel
appends `oldest 3d of 10` whenever it is less than `bars.length`. Once a
window is wide enough that every day has cleared the lag (17 days at the
current lag, or any window with `durable_after_days` 0) the qualifier
disappears on its own — no constant to revisit. Suppression (option 2)
was declined: it gives up the signal for a week to say nothing, when
saying the span costs one faint span tag.

The invariant this holds: **no two numbers on the totals line may imply a
comparison they do not support.**

## Verified

Both sides of the korg deploy were rendered end-to-end, not just
unit-tested — the sprint was built and checked *before* korg 067 shipped,
and re-checked against it after.

**Before** (live korg still on the old shape, 6 days, no
`backlog_before`):

    in 127  out 143  durable out 42  backlog 158

The wrong delta is simply gone. That is the designed degradation, and it
is what made this sprint safe to land ahead of korg's deploy rather than
behind it.

**After** korg 067 deployed (2026-08-19 ~03:30, envelope now 10 days with
`backlog_before` 153), against real production data:

    in 170  out 165  durable out 45  durable in 6 oldest 3d of 10  backlog 158  +5/10d

Every figure reconciles:

- `170 − 165 = +5` and `158 − 153 = +5` — the header and the totals line
  now make the same claim, which is the whole point of the sprint.
- `153 + Σ(added − closed) = 158` — korg's own invariant, holding from
  this side of the wire.
- The old form would have printed **`-4/10d`** against a flow of `+5`.
  Widening the window did not shrink the error; it moved it across zero,
  so the board would have reported the backlog *falling* on a day it
  actually rose. Worth recording: the pre-widening symptom (a delta of
  the wrong size) had become a delta of the wrong **sign**.
- `durable in 6` covers Aug 9–11 (`[5, 0, 1]`), three days of a ten-day
  window, beside a `durable out 45` covering all ten. The span is stated;
  the pair no longer reads as matched.

One detail the live data surfaced that the fixtures did not: only **two**
added bars render solid while `addedDurableDays` is 3, because Aug 10's
`added_durable` is legitimately 0. The count is days whose durability is
*knowable*, not days with durable arrivals — which is the correct
semantic for a span label, and would have been the wrong one had it been
derived from the marks.

## Notes

- No server-side edit. `fetchFlow` passes korg's envelope through whole,
  so `backlog_before` arrived for free; `days` is still deliberately
  unnamed so the window stays korg's call.
- The derivation test carries the production window (Aug 13–18, baseline
  174) as a fixture, and asserts the delta is *not* the
  `bars[last] − bars[0]` value — the bug is pinned by name, not just the
  fix.
- Panel name and column-3 placement remain open from #1319; still out of
  scope.
- korg #1432/#1433 (korg sprint 067, `74a71c0`) deployed to kubsdb
  mid-sprint. Both sides were verified live, which is a better outcome
  than either alone: the no-baseline path is not a hypothetical branch
  here, it was observed serving the board.

## Deployed

2026-08-19, version **0.5.0-4805647** (the sprint's squash-merge commit)
published to the store and installed on kubsdb via `just deploy
0.5.0-4805647`. Rollback target: `0.5.0-7351ecf` (sprint 010, running
before this deploy).

Verified live:

- cwd assertion on kubsdb: `pid 1280372 running 0.5.0-4805647`.
- Viewer path from kai: `https://kubsdb.encke-wahoo.ts.net:8100/` → 200,
  `FIRE MISSIONS` marker present (SSR rendered the board, not an error
  shell).
- `just versions`: store `latest`, host `here` top entry, and `running`
  all report `0.5.0-4805647`.

**The sprint's own behaviour**, captured on the deployed board either side
of the install:

    before  in 170  out 165  durable out 45  durable in 6                  backlog 158  -4/10d
    after   in 170  out 165  durable out 45  durable in 6 oldest 3d of 10  backlog 158  +5/10d

The `before` line is the sign-flip this sprint predicted, observed in
production rather than argued from a fixture: `170 − 165 = +5`, and the
board said `-4`. Both bugs were visible in that one line — the wrong
delta, and a `durable in 6` covering three days sitting bare beside a
`durable out 45` covering ten.

Reconciled against korg's live flow at deploy time: `backlog_before` 153,
last backlog 158, so the delta must be `+5`, and `170 − 165` is `+5` —
they agree. Durability lag 7 over a 10-day window leaves 3 knowable days,
which is the span the label names.
