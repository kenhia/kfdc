# 020 — Delayed Ops: soaking programs leave Operations, Sensor Net learns `reviewed`

Slice 2 of program **korg:2167** (*extended testing as a first-class state*),
proposal **korg:2163**, work items **korg:2155** and **korg:2156**. Run as an
overseen karc leg (`kfdc-4816ef`) on kai; the ship is gated on the overseer's
clearance and the wrap-up returns as a handoff on the proposal.

## The goal, in Ken's words

> With the current state of 2070, I will essentially be looking at an
> "almost done" program for a couple of days with not much that I can do
> immediately to drive it forward.

A program whose engineering is done but whose acceptance needs *days* sat
`active`, and Operations — which means **wants your attention** — drew it. The
design handoff (korg:2150) framed it in the sentence that made this a kfdc
sprint rather than a korg one: **korg is not wrong; kfdc's rendering is.**

## Premise check

Both premises rest on korg slice 1 being *deployed*, not merely merged, so that
is what was checked — against `kubsdb:5674`, not against the handoff that said
so:

- `board.programs[].soaks` — **present**, `[]` on both live programs. Holds.
- `board.reports[].reviewed` — **present**, `false` on all. Holds.
- No program is `soaking` yet (both live ones are `active`), exactly as
  predicted: slice 4 makes the first. Built against a fixture, as instructed.
- `PROGRAM_STATUSES` lacked `soaking`; Operations drew every program; nothing
  rendered `reviewed`. All hold.
- **"The statline's `live` count follows whatever rule it follows for parked
  (check, don't assume)"** — checked. `statline()` counts *proposals*
  (`active` + `queue`) and active projects from `depth`. Programs have never
  entered it, so routing them changes no figure. Nothing to do, and the reason
  is recorded rather than the conclusion.

## What shipped

**`board.ts`** — `ProgramSoak`, `ProgramRow.soaks`, `ReportRow.reviewed`,
`soaking` in `PROGRAM_STATUSES` (in korg's own order), and four derivations:
`withoutSoaking`, `delayedOps`, `soakClock`, `withoutReviewed`.

**`panels/DelayedOps.svelte`** — the panel, below On Deck. **Its defining
property is what it does not draw: no slice chips.**

**Operations / Sensor Net / SettingsPopover / Board.svelte / app.css** — the
routing, the mark, the third setting, the palette.

### Decisions worth the ink

**Routed, not hidden — so `withoutSoaking` returns no count.** `withoutParked`
suppresses and must therefore confess a number. Delayed Ops *moves* rows one
panel down and draws them in full, so nothing was withheld and a "hidden" count
would be the board apologising for a move it did not make. Operations still says
`· n soaking, in Delayed Ops` — a program that was there yesterday is a question
either way — in green rather than the `--slate` reserved for a count a checkbox
in this browser can undo.

**GP-19's parked corollary does not bite, and korg is why.** The corollary says
filtering a parked *program* must not take its live slices with it. A soaking
program cannot have one: korg refuses entry unless every slice is terminal, and
promotes the program back to `active` the moment a slice starts under it. There
is no live slice to orphan — by korg's invariant, not by kfdc's care. That is
written on `withoutSoaking` as the thing that should stop being true first if
korg ever relaxes the entry rule.

**`delayedOps` takes the *unfiltered* board.** "What does this block?" is korg's
fact, not a function of what the reader asked to see. A parked dependent is still
blocked (GP-19: parked is unfinished), so deriving blocks from the filtered board
would let a display setting turn a real blocked row into **"blocks nothing"** — a
false all-clear, which is the one failure the question exists to prevent. Same
reasoning that already keeps `blocked` out of `withoutParked`'s filter list, and
there is a test pinning it. The two filters are disjoint anyway (`parked` and
`soaking` are one `status` field), so the soaking rows are unaffected by the
choice; only the title lookup and the blocks list are.

**The partition is tested, not assumed.** `withoutSoaking` routes rows out and
`delayedOps` routes them in, reading one shared `SOAKING` constant. A test
asserts the split is *total* over every status — a program dropped by one and not
picked up by the other would vanish from the board entirely.

**`include reviewed` defaults ON, where `include parked` defaults off.** Not
drift. Parked defaults to hidden because dormant work is noise; a reviewed report
is the latest word from that sensor, and Sensor Net asks *is the net reporting*,
not *is there unread news*. Defaulting to hide would let a diligent morning empty
the panel to `net silent — no reports` — the panel's phrase for a fault. Phrased
as *include* either way, per sprint 017's rule that a ticked box means more on
screen. **The wall's fixed answer is therefore `show`** — the opposite of its
parked answer, and both are written as literals at the point of use.

**Soak fields are typed nullable** even though korg refuses to create a `soaks`
edge without them: the refusal fires on entry and is deliberately never
re-checked, so clearing `check_after` afterwards is a normal operator act. GP-14
— the type states korg's domain, not the domain of rows that exist today. The
panel renders `no check date` in words rather than counting down from nothing.

**The clock is UTC against the board's `generated`**, never `Date.now()`, so the
wall and the desk cannot disagree about one soak. Cost: an evening in PDT reads
as the next UTC day — at most one boundary, always toward "ready", and kfdc only
*draws* this clock; the judging is the soak scan's.

**Red is right in the clock and wrong on the card.** #1196's test is whether the
reader can clear the alarm. An overdue soak they can, by judging it; a soaking
*program* they cannot, by definition — so `soaking` joins `holding` and `parked`
in the palette gate's no-`--red` list, while `.clock.c-overdue` is red.

## Gates

`just check` green: **26 files, 342 tests** (up from 24/241 at sprint 018).

**Every new gate negative-tested** — 17 planted failures, each restored:

- palette: `.op-soaking` rule deleted; `.op-soaking` and `.status.soaking`
  painted `--red` — all caught.
- `withoutSoaking` filtering nothing; `delayedOps` losing its dedupe; dropping a
  row it cannot name instead of falling back to the id; `soakClock` reading
  `Date.now()`; `withoutReviewed` inverting its predicate — all caught.
- DelayedOps drawing the completed slices; dropping the `blocks nothing` line;
  collapsing three clock treatments into one — all caught.
- SensorNet not marking reviewed; hiding reviewed without saying so — caught.
- Board handing Operations the unfiltered programs; feeding `delayedOps` the
  filtered board — caught.

**One planted failure was NOT caught, and the finding is recorded rather than
patched over.** Removing the wall's `showReviewed` literal leaves the test green,
because two mechanisms enforce that rule — the wall is handed no `localStorage`,
*and* the literal is written at the point of use — and they agree. Deleting
either alone is invisible. Deleting the literal *once the storage guard is gone*
does fail, which is exactly the scenario it was written for, so it is not
redundant. Measured, and the pre-existing `parked` literal measures identically.
The test now says what it can and cannot pin, so a later reader does not mistake
a passing test for proof that one line is doing the work.

## The headless run — and the defect it found

Layout is what jsdom cannot see (#1284, #1460). A real Chromium ran from
`.scratch/` — `playwright-core` driving the browser already in
`~/.cache/ms-playwright`, and **deliberately not a repo dependency**. It briefly
became one by accident: the `.scratch/package.json` init was suppressed, so
`npm install` walked up and wrote `playwright-core` into the repo's manifest.
Caught on `git status` before the commit, reverted from both `package.json` and
`package-lock.json`, removed from `node_modules`, gate re-run green. Worth the
line because "add no dependency to make a gate" is a repo rule and the failure
mode is silent — the install succeeds and the manifest change reads as
intentional. Re-running the harness needs `npm init -y && npm i playwright-core`
**inside** `.scratch/`, verified by `git status` afterwards. It ran against the
dev server pointed at a stub korg serving the **real production rollup** with a
soaking program injected — two soaks, one program blocking nothing and one
blocking something, so both branches render on one screen.

Clean at 3440 / 2560 / 1920 / 1600 / 1366 on **both** `/` and `/wall`: zero page
overflow, zero panel overflow, zero box overflow. All three clock states and both
block branches verified rendering.

**Two harness faults first, both the sprint-018 lesson repeating.** *Always run
the negative control.*

1. The first pass reported every element on the page as overflowing. Artifact:
   SvelteKit wraps the app in a `display: contents` element, whose bounding rect
   is **zero-sized**, so every child's edge "exceeded" its parent's. Fixed by
   walking up to the first ancestor with a real box.
2. The first attempt to *prove* the harness could see an overflow was a no-op —
   removing the ellipsis from `.soak-t` changes nothing, because flex-wrap
   absorbs it. A box-edge check also cannot see **text ink** overflowing a box
   whose width is constrained by its flex parent; that needs
   `scrollWidth > clientWidth`.

**With an honest harness, a real defect appeared.** `invalidated_if` is *free
text from korg*, and the likeliest thing in an invalidation condition is a path —
`~/src/ai/kmon/state/baseline.json` — which has no break opportunity in it at
all. A 190-character unbreakable token pushed `.voids` **508px past the panel** at
1366 and took the whole page **79px past its box** with it. Fixed with
`overflow-wrap: anywhere` on `.voids` and `.blocks` (`anywhere` rather than
`break-word` because it also lets the flex parent shrink below the token's width,
which is the half that fixes the page). Re-measured with the hostile token still
in the fixture: clean at every width on both routes.

That is the whole argument for the headless pass. Nothing in `just check` could
have found it, the trigger is korg data kfdc does not control, and the panel
looked perfect until something plausible was put in it.

## Notes

- **`mothballed` survived.** Sprint 019's lesson — a specimen must assert its own
  fictionality — held: `Operations.svelte.test.ts` uses `mothballed` as its
  hypothetical unknown status and checks it against `PROGRAM_STATUSES`, so korg
  shipping `soaking` did not quietly invert that test the way shipping `parked`
  once did.
- **The curator is untouched**, confirmed rather than assumed — and the check
  was worth running, because `curator/hints.ts` *does* read `board.programs`.
  It reads only `node_id` and `slices[].node_id`, through its own structural
  type, to group slices; it never reads `status` and has no `soaks`. So adding a
  field and a status literal cannot reach it, and `src/lib/curator.ts` touches
  programs not at all.
- **First component test for Sensor Net.** Every report fixture in the repo was
  `reports: []`, so no test had ever rendered a report row — which is why adding
  a required `reviewed` field broke no test and the compiler flagged nothing
  there. Worth knowing: that panel had no runtime coverage at all.
- **Carried outside this slice's scope**, per the overseer's ruling in comment
  1610 on korg:2163: one uncommitted line in `CLAUDE.md` correcting a stale path
  (`kai:~/5090/PARKED.md` → `kai:~/src/5090-RMA/PARKED.md`). A one-line doc fix
  with no decision in it; flagged here so the reviewer is not surprised by the
  extra hunk.
- **First live render is slice 4's acceptance, not this slice's.** Nothing is
  `soaking` in production until the retrofit of program 2070 runs. Everything
  above was verified against a fixture shaped from `get_program`.
