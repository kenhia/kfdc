# 019 — Suppress parked on the board

korg:1548, slice 2 of program korg:1549 ("Parked work leaves the board without
leaving the record"). Covers kfdc #1536 (mirror + palette) and #1540 (the
setting). Slice 1 — korg:1546, korg #1534/#1535 — shipped and deployed to
kubsdb on 2026-08-22, authoring **GP-19** in cross-project-planning.

## Goal

korg can now say `parked`: deferred until a condition fires, no end date. kai's
5090 is out for RMA, and korg:1478 has been sitting `active` for a month with a
comment asking people not to pick it up — *a comment doing a status's job is the
tell that a status is missing*. korg grew the status; this sprint is kfdc's half
— render the new literal honestly, then let Ken take dormant work off the board
without taking it out of the record.

The order was not negotiable and the proposal said so: **#1536 before #1540.**
With the filter off — the state a reader lands in the first time — the board has
to already draw parked properly. Building the filter first would have hidden the
thing whose appearance was never chosen.

## What shipped

**The mirror and the palette (#1536).** `PROGRAM_STATUSES` gains `parked`, and
`palette.test.ts` failed the moment it did — `.op-parked has no rule`, which is
#1444's gate working exactly as designed and the negative test this repo asks
for, obtained for free rather than staged.

The treatment is a real choice. kfdc's palette is warm throughout, so korg's own
rule for parked — *nearest `done`, but keeps a hue where done has none, because
dormant is not finished* — translates to **cool where done is warm**. New
`--slate: #8a97a0`, the board's only cool-neutral, existing for this one status.
`.op-parked` is the only program card built on `--ground` rather than `--panel`,
so it reads as a recess in the board rather than a card on it. The chip is
unfilled like `holding`'s but **dashed**, which is what separates them at 10px.
No `--red`, and the #1196 guard now covers both new selectors.

**The GP-14 check found a live hit.** `ProposalRow.status` was typed
`'active' | 'proposed'` — a sampled enum, and korg had already shipped a third
live value. Now `'proposed' | 'active' | 'parked'`, taken from korg-core
`vocab.rs`'s `PROPOSAL_LIVE_STATUSES` rather than from a window.

**`PROPOSAL_FINISHED` was already right, and is now pinned.** `parked` is
deliberately absent: GP-19's third property is that parked is *unfinished*, so a
parked slice still counts toward a program's `remaining`. Admitting it would
have the On Deck roll-up report progress that came entirely from putting work on
hold. The parked specimen is pinned permanently in `board.test.ts` beside the
declined one (GP-14: the rare value goes in the corpus).

**The setting (#1540).** Sprint 017's prediction held exactly — `kfdc.settings.v1`
is one key holding an object, and this was an added field, not a format
migration. `includeParked`, default **false**, because the request was that
dormant work stops occupying the board and a default of *show* would have
shipped the switch and none of the benefit.

Two things in `settings.svelte.ts` did have to change shape, and both were the
one-setting shell showing: `persist()` wrote `{ panePct }` literally, and
`reset()` cleared the whole key. `persist()` now writes only what differs from
the defaults and removes the key when nothing does — the default has to reach
localStorage as *absent*, not as a stored `false`, or a reader who ticks and
un-ticks ends up quietly pinned to today's defaults. `reset()` became
`resetPaneWidth()`: it always was the width's reset and the button always said
so, but with one setting in the shell the two readings were the same sentence.

**One filter, one place.** `withoutParked` in `board.ts` filters exactly `queue`
and `programs`, and carries the per-collection reasoning for everything it
leaves alone. The panels downstream do not know the setting exists.

**The wall suppresses parked unconditionally**, guarded twice: no `localStorage`
handed to it, and `!wall &&` written again at the point of use. The negative
test showed the point-of-use literal is load-bearing on its own — remove both
and the wall test fails; remove only the storage guard and it still passes.

## Two things the sprint found that the plan did not predict

**A test had gone stale in the exact way it was written to prevent.**
`Operations.svelte.test.ts` used `status: 'parked'` as its hypothetical unknown
literal — and korg then shipped `parked`. The test kept passing while asserting
the opposite of its own name: that a *known* literal gets a class, which is the
`it.each` directly above it. A hypothetical borrowed from korg's plausible
future is a hypothetical with an expiry date. The specimen is now a word korg
has no use for, and the test **asserts its own fictionality** against
`PROGRAM_STATUSES` rather than trusting it — which is the check that would have
caught this.

**The board's first rule applied to this feature and had been missed.**
*Nothing disappears silently — a panel that hides rows names what it hid and
where it went.* Suppressing parked is the largest piece of hiding kfdc does, so
it is the last place that rule may be skipped. On Deck and Operations now print
`· n parked, hidden by a board setting` on korg's own omitted line. The count is
kfdc's, not korg's: korg's `*_omitted` says what korg withheld, and only the
board knows what the board chose not to draw. In `--slate` rather than
`--faint`, because of the two halves of that sentence this is the one the reader
can undo from here.

Both were found by **looking at the rendered board**, not by a test — which is
also how the third one turned up.

## The thing jsdom could not see

With the setting *on*, a parked row on On Deck was **indistinguishable from a
queued one**. The palette gate covers the program literals; a queue row carries
no status chip at all in the ordinary case, so nothing failed. But the reader
who ticks "include parked" is asking precisely *which rows are parked*, and the
board was not answering. Queue rows now carry a dashed `PARKED` chip inside the
`.chips` wrapper — inside, so it wraps with the project chip rather than
extending the unbreakable inline run #1284 measured.

## Measurements

`.scratch/019-stub.mjs` proxies production korg and marks rows parked on the way
past, so the probe measures a board that *has* them without touching real korg —
korg:1478/1480 are still Ken's to park (below). `.scratch/019-layout.mjs`
measures at 3440/2560/1920/1600/1366. Neither is a dependency and neither is a
`just check` gate.

| | setting off | setting on | wall (setting stored on) |
|---|---|---|---|
| page overflow | 0 | 0 | 0 |
| panel spills | none | none | none |
| On Deck rows | 1 | 3 | 1 |
| Operations cards | 5 | 6 | 5 |
| parked card / chip | 0 / 0 | 1 / 3 | 0 / 0 |
| statline `live` | 4 | 6 | 4 |

Identical at all five widths. The wall column is the gate: with
`includeParked: true` in that browser's `localStorage`, `/wall` renders exactly
what the desk renders with the setting off.

Popover with two rows: 318×197, on top, inside the viewport, no internal
scroll, at every width. One measured nit left alone — the checkbox's right edge
sits 17px right of the number input's, because row 1 ends with a `px` unit label
and row 2 does not. That is ordinary for a settings list, and chasing it would
mean adding an empty element for pixel alignment.

Treatment, computed: parked chip `rgb(138,151,160)` dashed vs holding
`rgb(162,157,133)` solid — different in hue *and* border style, so the two
resting states cannot be confused. The parked card resolves darker than the
neutral base, which is the recess doing its job.

## Gates, negative-tested

Every gate this sprint touched was seen to fail on purpose:

- `.op-parked` with no CSS rule → `palette.test.ts` exit 1 (obtained for free —
  it failed before any CSS was written).
- `--red` seeded into `.op-parked` → the #1196 guard exit 1.
- `parked` added to `PROPOSAL_FINISHED` → the unfinished-slice pin exit 1.
- the filter over-reaching (dropping parked *slices*) → exit 1.
- the filter under-reaching (forgetting `programs`) → exit 1.
- both wall guards removed → the wall gate exit 1; storage guard alone removed
  → still passes, so the `!wall &&` literal is genuinely load-bearing.

One probe metric read `0` at every width in the first pass because the selector
was wrong, which is indistinguishable from *there are no rows*. Fixed and
re-run. That is sprint 018's lesson repeating: **always run the negative
control**.

`just check`: prettier + eslint clean, svelte-check 0 errors, build OK, 285
tests green.

## Cross-project plan

Amended in the same ship (cross-project-planning `9890d5a`), per the amend rule
— both are refinements implementation turned up, and only this session had the
context:

- **GP-19** gains two corollaries. Its forbidden-derivation list ran bottom-up
  (don't infer a program's dormancy from its slices); the tempting error in
  practice is top-down — filtering a parked program's *still-live slices* out
  along with it. It looks like a feature and it is the same violation. And: a
  consumer that filters says what it filtered, because korg's `*_omitted` counts
  structurally cannot describe what a consumer chose not to draw.
- **GP-14** gains its mirror image in the test register. It says *pin the rare
  value in the corpus*; its opposite pole is the test that needs a value korg
  does **not** have, and this sprint is the worked example of that expiring
  silently.

## Follow-ups — not done here, and why

**The park itself is Ken's, and it is already Awaiting Ken on program korg:1549.**
korg:1478 (`active`) and korg:1480 (`holding`) are the two rows this whole
program exists for, and korg:1479 is flagged in the same register. Slice 1's
deploy report raised the ordering as a decision rather than making it on a
deploy's momentum, and recommended shipping this slice first so they park into a
board that already knows how to draw them. That is the path taken — so the park
lands **after this deploys**, not before, and it is one `update_proposal` /
`update_program` call each.

**`kai:~/5090/PARKED.md`** gets its "Sprint proposals flagged, not reverted"
section rewritten — the comment-as-status workaround it records is exactly what
this program retires — and the un-park step added to its §3 restore checklist.
Un-parking is not korg's to guess: the status a row was parked out of is not
recoverable from it, so the checklist has to name the target (1478 → `active`,
1480 → `holding`). Pending the park, for the same reason.

## Deployed

**2026-08-22** — `0.5.0-00ca4e0` (merge commit `00ca4e05`), live on kubsdb at
`https://kubsdb.encke-wahoo.ts.net:8100`. Rollback target: `0.5.0-6da12b4`
(sprint 018) — `just deploy 0.5.0-6da12b4` is the whole rollback.

sha256 `67d8ae2cb500eef6a3d1f518a611799209009b9e665991731bc524569971c775`,
573267 bytes, 143 entries. **1.86s end to end**, every knarr step `ok`:
stage 381ms · backup 202ms · install 205ms · restart 220ms · ready 262ms ·
confirm 208ms · cleanup 0ms (pruned `0.5.0-eadc974`). `confirm`'s detail is
the version string itself, so the running process was proven by its cwd rather
than by a health check. `restart` at 220ms is sprint 013's post-fix baseline
unchanged — the shutdown fix still holds.

Three-way agreement: store `latest:` = `here:` top = `running:` = `0.5.0-00ca4e0`.

**Verified live**, over the tailnet from kai rather than loopback, so
`tailscale_serve` is exercised:

- `GET /` → 200, and SSR rendered the board (`fire missions` present, not an
  error shell).
- The served CSS carries `--slate`, `.op-parked`, `.status.parked` and
  `.parked-hid` — this sprint's treatment is in the bundle the host is running,
  not merely in the repo.
- The gear renders on `/` and **not** on `/wall`: sprint 017's rule still held
  by the deployed artifact, which is the guard the wall's parked answer hangs off.

**Not verifiable live, and this is the honest limit.** Production korg holds
**no parked rows** — checked directly against `/api/board`: zero parked
proposals in `queue`, zero parked programs, on a 5-row queue and 4 programs. So
the filter has nothing to act on and the board today renders exactly as it did
before, which is correct behaviour for a feature whose whole job is conditional
on a status nothing carries yet. The filter, the receipt and the wall
suppression are proven by the test suite and by the five-width probe against a
stub that *does* carry parked rows — not by production.

That last step closes when korg:1478 and korg:1480 are parked, which is Ken's
call and is the standing Awaiting Ken on program korg:1549. The board is now on
the far side of the sequencing that decision was waiting for: it knows how to
draw parked, so parking them no longer costs an undecorated row.
