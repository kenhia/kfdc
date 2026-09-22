# 023 — Standing Orders: scheduled work in flight

Proposal korg:3049, one leg of program korg:3062 ("Low-hanging fruit, run 2"),
run as a karc leg (`kfdc-9a633e`) on kai under an Opus overseer.

Covers kfdc **#1645** — *Show in-flight scheduled work on the board* (S,
feature).

## The goal

A korg schedule that has materialized its work item was invisible on kfdc. The
schedule is no longer *due* (so it leaves `due_schedules`), and the open work
item it produced sits in no proposal, so no panel renders it. Ken hit this with
WI #1635, schedule 1112's first-ever materialization — the only places it
surfaced were korg's Schedules page and the find-by-ID box.

korg #1644 shipped the data half in korg sprint 076: a sibling
`in_flight_schedules` block on `get_board`. This sprint is the render.

## Premise check

**Holds.** `GET /api/board` against the deployed korg (kubsdb:5674) at
2026-09-22 04:52 UTC returned HTTP 200 with `in_flight_schedules` present —
`len=0` at the time, `due_schedules` `len=3`. The row shape matches both WI
1644's pinned comment and korg's `InFlightSchedule` struct field for field.

**One drift, and it lands on the brief rather than on the item.** The
proposal's overseer note says *"render it beside `due_schedules`, as a separate
block"*. **kfdc renders `due_schedules` nowhere**, and neither does korg-dash —
grep, both repos, 2026-09-22. That claim is asserted in four places:

- korg WI 1644's decision comment ("kfdc and korg-dash already render
  `due_schedules`, and both would have to change…"),
- korg `docs/api.md` § "In-flight schedules (#1644)" ("kfdc and korg-dash get
  the block for free"),
- `korg-core/src/repo/board.rs`'s doc comment on the field,
- korg+ `PLAN.md`, the 1393 decision row ("kfdc and korg-dash inherit it for
  free").

It does **not** change the decision it was used to justify — the additive
sibling field is still the right shape, and it still costs consumers nothing.
But "beside" had no referent, so the substance of the call was honoured
instead: due is a nag, in-flight is a tracker, and they must not be collapsed.
In-flight gets its own panel. Rendering `due_schedules` is a separate question,
unfiled, and deliberately not in this sprint.

## What shipped

**A new panel: Standing Orders**, first column, between Fire Missions and
Deconfliction — so the column reads *what is firing, what a standing order put
in flight, what collides*. `docs/design.md` § Scheduled work in flight carries
the reasoning; the short version:

- **A panel because it had no host.** Fire Missions is proposals, On Deck is
  the queue, Commander's Call is the awaiting-Ken column, Delayed Ops is
  soaking programs. Work that recurs by standing order is none of those, and
  having nowhere to sit is exactly how it became invisible.
- **Two refs per row**, the only compact line on the board that has them. korg
  carries the schedule's `node_id` expressly "so a consumer can link the
  schedule as well as the item": `#wi` is the work, `⟳ korg:<id>` is the
  standing order. The title is `wi_title` — the *substituted* one — and is
  plain text, because a clickable title too would put three links on two
  destinations.
- **The parked filter does not reach the block.** korg's predicate reads
  `WI_UNFINISHED_STATUSES` on purpose so a parked materialized item stays in
  it; suppressing it here would re-create #1644's own bug behind a checkbox.
  `withoutParked` records it in its own list of what it leaves alone, and
  `Board.svelte` passes the unfiltered board on both routes.
- **The board's first work-item status chips.** `open` unfilled and muted (the
  majority, and the panel's heading already says these are in flight),
  `resolved` green-outlined (the done family; **not** red — "wants Ken" is
  `set_awaiting` drawn by Commander's Call, never a status), `parked` reusing
  the chip parked already has, since GP-19 is a rule about every node kind.
  Unknown literals land on the neutral base (#1444).
- `--amber-dim`, not `--amber`: this is firing, but Fire Missions is directly
  above it and two stacks of full-amber cards read as one list.

Plan decisions in scope (korg+): **GP-1** (render the rollup, no side store —
no derivation was added, the rows are drawn as korg sends them), **GP-13**'s
state half and **#1444** (neutral for an unrendered literal), **GP-14**
(`wi_status` typed `string`, not the three literals that exist today),
**GP-16** (every URL through `NodeRef`/`korglink`, no `kind`), **GP-18**
(delegate the node), **GP-19** (`parked` is korg's word, across node kinds).

## Gates

`just check` green: prettier, eslint, svelte-check, build, 404 tests (28
files) — 18 of them new.

**Negative-tested, four ways**, because a gate never seen to fail is not a
gate:

| Planted fault | Gate that caught it |
|---|---|
| deleted the `.status.resolved` rule | `palette.test.ts` — *".status.resolved has no rule"* |
| painted `.status.resolved` with `--red` | `palette.test.ts` — the #1196 alarm-colour rule |
| swapped the row's two korg ids | `StandingOrders.svelte.test.ts` — *"links the item by wi_number and the standing order by node_id"*. Both links still resolved and both landed on the wrong node; nothing else could see it |
| routed the panel through the filtered board, with `withoutParked` dropping parked rows | `Board.svelte.test.ts` — both parked-in-flight assertions, desk and wall |

## Layout, measured

jsdom cannot see layout (#1284, #1460), and this row is precisely the shape
that rule was written about: a flex header of adjacent nowrap chips. Measured
with a headless Chromium run from `.scratch/` (`023-measure.mjs`), against a
**stub korg** serving the real board payload with in-flight rows injected —
the live block is empty, so there was otherwise nothing to look at. Five rows,
including two adversarial ones: a 54-character project name and an 80-character
unbroken title.

**First run, at 1280×800: `LEAKS [panel 24, column 23, board 38, deck-main 38,
document 20, order[3] 37, order[3].row1 48]`** — the long project name in a
`nowrap` `.proj` chip, 396px inside a 348px row. `.proj` is shared with three
other panels, so the remedy is scoped to `.order`: `min-width: 0` plus
ellipsis, with the full name in the chip's `title`. Clean at 3440, 1920, 1280
and 900 afterwards.

**Always run the negative control** (sprint 018's lesson). The same 54-char
name was dropped into Commander's Call's chip to ask whether the shared chip
was already like this — and that turned up something else entirely, below.

## Repaired in passing

**Commander's Call overflowed its box by 40px at 1280, and had nothing to do
with this sprint.** The awaiting note on korg:2912 names environment variables
(`KCTRLDECK_TOKEN_KWORK_PAIR`) and paths; `.call p` had no `overflow-wrap`, and
a token with no break opportunity cannot wrap without being told it may. The
card took the panel, the column, the board and the document with it.

Proven pre-existing rather than argued: a `git worktree` of `main` was served
from the same stub korg on a second port and measured at the same viewport.

```
main (control)     {"commandersCallOverflow":40,"col3Width":347,"documentOverflow":20}
023 (this sprint)  {"commandersCallOverflow":40,"col3Width":347,"documentOverflow":20}
```

Identical — Standing Orders is in column 1 and takes nothing from column 3.
Repaired here because the evidence removed the decision: one declaration,
inside a repo already held, verifiable by the measurement this sprint had to
run anyway, and *nothing renders past its box* is a rule the design doc already
declares outranks taste. `overflow-wrap: anywhere` on `.call p` **and**
`.call h3` — both are arbitrary korg strings, so both get the same permission.
After:

```
main (control)     {"commandersCallOverflow":40, "documentOverflow":20}
023 (this sprint)  {"commandersCallOverflow":0,  "documentOverflow":0}
```

**Also repaired:** `npm install playwright-core` run from `.scratch/` walked up
to the repo's own manifest and added it as a dependency. Reverted — the
headless browser is deliberately **not** a dependency and deliberately not a
`just check` gate (CLAUDE.md). It is resolved from the gitignored
`node_modules` for the measurement and goes away with the next `npm ci`.

## Follow-ups

None filed. The one thing this sprint found and could not settle is the
`due_schedules` claim above — it is a wrong premise in four decision records,
not a defect in a running thing, and correcting another repo's decision record
is not this sprint's call. Raised with the overseer instead.
