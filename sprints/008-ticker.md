# Sprint 008 — the Ticker, and what the Net Log keeps

Proposal korg:1190 (kfdc, #1186 S decide-first + #1187 M + #1183 S ride-along)
— slice 1 of program korg:1192 "kfdc Phase 3 — switch over, and manage kfdc in
kfdc". Slice 2 (korg:1191) is the kubsdb move.

The board's last unrendered data. `/api/board` has carried `events` since korg
#977 — the newest 20 status transitions, real timestamps, real from/to — and
kfdc dropped them on the floor. No korg work was needed: everything the panel
wanted was already in the response.

The sprint was filed with a **decide-first** WI in front of the render, and
that ordering paid for itself. #1186 asked whether korg's transition log is
just the Net Log's data arriving a second time, more precisely — and if it
were, the answer was "enrich the Net Log, build no panel", which would have
made #1187 a different sprint.

## The measurement that settled #1186

Argued against live production rather than from the WI body, which had assumed
the two feeds "overlap heavily". They do not.

The live window (20 events, 2026-08-10T17:06Z → 2026-08-11T03:21Z) held **16
work-item transitions and 4 proposal transitions**. The Net Log's digest covers
`active`, `queue`, `awaiting` and `programs` — proposal and program granularity
only — so it is blind to all 16, and structurally always will be: korg's rollup
lists carry per-proposal *counts*, never per-work-item status. No amount of
enrichment reaches them.

And the traffic runs the other way too. From the live transcript:

- `03:18` — the Net Log logged `OD: on deck` for proposals 1190 and 1191. korg's
  event feed has **no event for either**: they were *created* into the queue,
  and creation is not a transition.
- `03:21` — korg recorded one event, `1190 proposed→active` at `03:21:30.025Z`.
  The Net Log emitted **two** lines (`FM: firing` + `OP: slice proposed→active`)
  at `03:21:46.528Z` — 16s late and panel-decomposed.

`FM splash`, `CC call made`/`cleared` and `FM out` are likewise invisible to
korg's log by construction. **Overlap: 4 of 20 on korg's side; on the Net Log's
side its unique traffic is the majority of what it emits.**

So the roadmap's Phase-1.5 promise — *"Net Log lines get enriched (real
actor/exact time)"* — is **deliberately not kept**. It was written in sprint 002
before anyone had measured the two feeds; the join it needs is `node_id` + a
fuzzy ±60s window + status match, bought for ~16 seconds of precision on a
minority of lines, at the cost of every line becoming part-observation,
part-record. The full argument is a comment on korg:1186; reopen it only with a
new measurement.

## What shipped

- **#1186 — the decision, recorded in korg.** Ticker as its own feed, Net Log
  untouched. The two now differ in **form** as well as content, which is how
  the division of labour reads without being explained: the Net Log is a
  vertical transcript of what this board *observed*, the Ticker a horizontal run
  of what korg *recorded*. They speak different languages on purpose — the Net
  Log speaks FDC (`firing`, `splash`, `on deck`), the Ticker speaks korg
  (`proposed→active`, verbatim). A panel whose whole claim is "this is the
  record" cannot restate the record in its own words.
- **#1187 — `events` typed end-to-end and rendered.** `EventRow` on `Board` in
  `board.ts`; `tickerLines()` in a new `src/lib/ticker.ts` beside its siblings
  `netlog.ts` and `curator.ts`; `Ticker.svelte` in the footer. Ages against the
  board's `generated` like every other panel, with korg's exact instant kept on
  the stamp's `title` — the one thing the Net Log's observation time cannot
  offer. korg's order and 20-event window are preserved exactly: no re-sort, no
  re-cap, no per-project filter (all three would be korg work items).
- **#1183 — the Brave Rifles on the board.** The 3d Cavalry DUI ("the Bug") in
  the masthead. A unit crest belongs on the letterhead, and the masthead is this
  board's letterhead.

### Placement the concept had already decided

The vertical-space objection to a second strip turned out to be already
answered: `docs/design/kfdc-concept.html` has a `footer.ticker` — a wrapping
flex run of `<date> <text>`, mono 11px, right-aligned `.src-note`. **The Net Log
took that slot in sprint 002**, having been invented in #992 *after* the concept
was approved. So the Ticker was restored to the footer rather than designed.

Measured at 1920×: 6 rows, 222px, ~13% of the page against the Net Log's 475px.
4 rows at 2560, degrading to one-per-row at 760. (The pitch estimated "~2
wrapped lines" before it was built; that was optimistic by three rows.)

`.ev { flex: none }` is load-bearing — an event is one indivisible quotation, so
it wraps whole rather than being shrunk and clipped mid-title, which is what
flex does to a shrinkable item at narrow widths.

### Two things the real data corrected

Both found by looking at the rendered board rather than at the code:

- **The ship accent.** The first rule accented anything reaching a terminal
  status, and painted **12 of 20 rows green** — `resolved→closed` is Ken's
  routine verification sweep and it dominates the feed. An accent that fires on
  half the rows is the background. Narrowed to `shipped()`: a *proposal*
  reaching `done`, the event the board's vocabulary already celebrates. 1 of 20
  in the same window.
- **The crest size.** Placed at 38px first, which is below the asset pack's own
  48px silhouette floor — it read as a green blob. Sized to **56px** against the
  pack's measurements: above the floor so the scrolls, bugle and 3 read, well
  below the ~96px where `BRAVE RIFLES` becomes legible, so the mark never
  pretends to be readable text.

### The honesty rule, as it landed

korg's event log starts at migration 0026 and was never backfilled, so an empty
window means *"nothing has moved since the migration"* — never *"nothing ever
moved"*. There is no empty state that says that without overstating, so **the
footer does not render at all** when the window is empty: no heading, no rule,
no "the net is quiet". An absent `events` key (a korg predating #977) is treated
identically — strictly less information, so strictly less to claim.

Both cases have their own test, with the reason in the test body. The
`.src-note` states scope and only scope: `feed: korg transitions · newest 20`.

## Tests

`src/lib/ticker.test.ts` (server, 7) — the korg-verbatim rule, ages + exact
instant, ref by `wi_number` vs `node_id`, korg's order preserved, the two
empty cases, and the production `events` body of 2026-08-11T03:25:23Z pinned
byte-for-byte the way #997 pinned the first real curator body. Its head is this
sprint's own proposal going active.

`src/lib/panels/Ticker.svelte.test.ts` (client, 6) — the footer's existence is
the one thing a pure derivation test cannot reach.

Typing `events` as **required** on `Board` was deliberate: it broke all four
Board fixtures at `svelte-check` time, which is the compile-time proof that
every fixture accounts for the new contract rather than inheriting `undefined`.

69 tests, `just check` green.

## Notes and follow-ups

- `lineHref` was widened to take its three fields structurally rather than a
  whole `NetLogLine`, so both feeds link into korg by exactly one rule and
  cannot drift on what a korg URL looks like. If a third consumer appears,
  promote it to `board.ts`.
- **The crest and the public repo.** Public domain settles copyright only; AR
  670-1 and 10 U.S.C. § 771 limit *use* of Army insignia independently. This is
  a personal tailnet board displaying the wearer's own regimental affiliation,
  which those rules do not reach, but `kenhia/kfdc` is a public repository, so
  the caveat is recorded in `docs/design.md` rather than assumed away.
- Still open from the asset pack's own "Known gaps": no SVG, and no
  purpose-drawn 16px glyph. kfdc has no favicon today, and it should not get one
  by downscaling this mark — the pack measures why.
- `/api/board` also carries a top-level `sources` array that `Board` does not
  type. Out of scope here and not needed by any panel; noted so it is not
  mistaken for an oversight later.

## Deployed 2026-08-12

Published from merged `main` (`8705758`) and installed on kai — **the last kai
deploy before slice 2 (korg:1191) moves hosting to kubsdb.**

| | |
|---|---|
| Version | `0.5.0-8705758` |
| Rollback target | `0.5.0-3772965` (sprint 007) — `just deploy 0.5.0-3772965` |
| Store | `latest -> 0.5.0-8705758`; six versions held |

Verified live, with actual values rather than "OK":

- Running version proven from the process, not the health check: `MainPID
  2478400`, `/proc/2478400/cwd` resolves to `0.5.0-8705758`.
- Tailnet (not loopback, so `tailscale_serve` is exercised): `200` from
  `https://kai.encke-wahoo.ts.net:8100/`, and `Fire Missions` present in the
  body — SSR rendered the board, not an error shell.
- `just versions`: store `latest`, `here` top entry and `running` all
  `0.5.0-8705758`.

Sprint-specific smoke test — the deploy skill's health check proves *a* kfdc is
up, not that this sprint's work is live:

- Ticker footer present, **20 events**, 20 korg deep links, source note
  `feed: korg transitions · newest 20`, 3 ship accents.
- Masthead crest present with its alt text.
- Net Log strip still present — the two feeds coexist, which was #1186's whole
  point.

The board's own head at deploy time was this ship: `1m 1192 active→holding` and
`2m kfdc 1190 active→done`. kfdc rendering its own sprint closing is the dogfood
program korg:1192 was filed to get.

### One defect found by this verification — korg:1197

The `1192 active→holding` line is a **program** transition, and `EventRow` types
`kind` as `'sprint_proposal' | 'workitem'` with `project: string`. Production
emits three kinds, and `project` is `null` for a program (correct on korg's
side — a program's span is derived, so it has no project).

The 20-event window this was typed against contained no program transition, so
the third kind was invisible to the measurement. Sprint 004's rule — verify
field by field against the live response — was followed for field *presence* and
missed on *value domain*. **A sampled enum is not an enum.**

Runtime is unaffected (types do not execute); the line renders and deep-links
correctly because `lineHref` already handles `program`. Filed XS as korg:1197
rather than hot-patched, since the deployed board is correct.
