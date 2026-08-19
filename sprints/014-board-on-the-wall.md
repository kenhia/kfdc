# 014 — The board on the wall: fix what leaks, then drop the chrome

Proposal korg:1454. Work items: **#1284** (On Deck renders past its box),
**#1197** (`EventRow` mistypes korg's event feed), **#1204** (wall mode), and
**#1460** — a second leak found while measuring the first.

## Goal

Wall mode is the forcing function. A dense board that leaks text out of a box
is survivable at a desk, where you can widen a window or scroll; on an
unattended widescreen with nobody at the keyboard, a clipped row is just wrong
information. So the leaks get fixed in the same pass that removes the ability
to work around them.

## Cross-project plan

kfdc is in the `korg+` cluster. Nothing in the proposal contradicted a
decision; two came out of the sprint, both committed to
`cross-project-planning` in the same ship (`5950b6b`), per the amend rule:

- **GP-14 — a sampled enum is not an enum**, new. #1197's lesson, generalised.
- **GP-11** gains what kfo's future summary bar inherits from wall mode.

## Measure before choosing the fix

The proposal asked for this and it changed both fixes. kfdc has no browser
dependency and is not getting one, so the instrument was playwright resolved
out of the npx cache from `.scratch/` — verification, not a gate, and nothing
landed in `package.json`.

### #1284 — two leaks in one row, either one enough

img-503's row is the **program roll-up**, not a long proposal title. Rebuilt
against the real `app.css`:

```
894px table inside a 716px panel — 192px past the box
```

`table.queue` is declared `width: calc(100% - 24px)`. An auto-layout table
cannot honour its own width against a cell that will not shrink, so it grew —
and dragged **every row in the column** out with it, which is why unrelated
titles leak in the screenshot too.

Two cells could not shrink:

1. `td.qproj` — four `.proj` chips are adjacent inline elements with no
   whitespace between them, so the line breaker has nowhere to break: **349px
   of unbreakable run** in a column declared `width: 1%`.
2. `.roll-t` — a flex item, so `min-width: auto` applies, so the
   `overflow: hidden; text-overflow: ellipsis` already sitting on it **could
   never fire**.

The fix is not "make everything wrap" — the density is spent on purpose. It is
to make the existing ellipsis work, and to give the chips somewhere to break:

- `td.qproj .chips` — one `inline-flex; flex-wrap: wrap` group, the shape
  Operations' `.span-chips` already uses. 349px → 140px over two lines.
- `tr.prog-roll .roll-t { min-width: 0 }` — *lets* the item shrink.
- `tr.prog-roll td.qtitle { max-width: 0 }` — *makes* it, by capping what this
  one row contributes to the column's max-content so the table hands the width
  back. Only the roll-up row is capped; a proposal title wraps and was never
  the row pushing.

`.aim` and `.slice-t` bound their ellipsis with an em `max-width`. That works
where the box is content-sized and not here, where it is a table column —
worth knowing before copying that pattern a third time.

**Both halves are load-bearing.** Negative-tested by reverting each against
the real stylesheet; px past the panel's inner edge:

| | 1920 | 1600 | 1366 | 1200 |
|---|---|---|---|---|
| as shipped | 0 | 0 | 0 | 0 |
| revert chips wrap | 0 | 0 | 79 | 8 |
| revert `max-width` | 0 | 107 | 197 | 124 |
| revert both | 192 | 316 | 406 | 333 |

### #1460 — the same instrument found a second one

The document scrolled horizontally at any viewport under ~1475px. The culprit
was `RateOfFire.svelte`'s screen-reader table: **a table ignores `width` below
its min-content**, so `.visually-hidden`'s `width: 1px` was inert and the table
sat there 1475px wide behind the clip.

Clipping paint does not shrink a box. `clip-path: inset(50%)`,
`overflow: clip`, both together, `contain: strict` and `max-width: 1px` were
all measured and all left `scrollWidth` at 1475. `table-layout: fixed` makes
the declared width binding, and costs the table nothing it exists for — it
stays a real table, caption and rows intact, for the assistive tech it serves.
Verified `scrollWidth === clientWidth` at 1920/1600/1475/1366/1280/1200.

Filed as #1460 rather than folded in silently. It was fixed here because
sprint 014's whole argument is that nobody is standing at the wall to scroll a
leak away — shipping wall mode over a board that scrolls sideways would have
shipped the defect the sprint exists to remove.

## #1197 — the pin is the fix

Types widened (`kind` gains `'program'`, `project` becomes nullable on
`EventRow` and `TickerLine`), and `Ticker.svelte` guards the project chip the
way `NetLog.svelte` already did.

The durable part is the **pinned specimen**: the 2026-08-12T04:24Z program
event, quoted verbatim from the WI, is now a fixture. Narrowing `EventRow`
back to two kinds fails `svelte-check` with two errors — that is what makes it
a gate rather than a note. Only the event is verbatim; its `generated` is
chosen, and the test says so, because presenting an invented stamp as measured
would be the same sin in miniature.

The component test asserts the chip span does not **exist**, not that it is
empty — an empty span passes a `textContent` check and still spends its 6px
flex gap, which is precisely how this shipped.

## #1204 — wall mode

`/wall`, one route over the same board. `src/routes/+page.svelte`'s body moved
to `src/lib/Board.svelte`, which both routes render; the desk board's output
is unchanged.

**Chrome.** kfdc had almost none to drop, and saying so is better than
inventing some. Two things go: the mission tagline (prose for someone meeting
the board, and the wall has no first meeting) and the roll-up's affordance.
The crest and wordmark stay — identity matters more to a screen recognised
from across a room. Every scope claim stays (`omitted: n done`, `feed: korg
transitions · newest 20`); removing one would make a panel claim more than it
knows.

**The roll-up**, which the WI flagged as the open question: renders collapsed,
as a `<span class="roll">`, no caret. Collapsed is the informative form
anyway (#1064 — a declared sequence does not gain by being re-listed), and
`n of m slices` stays because it says there is more behind the row without
offering to open it. Written into `docs/design.md` as a rule, so GP-11's
future kfo summary bar inherits it instead of re-deciding.

**Cadence.** `POLL_INTERVAL_MS` imported, not copied — sprint 013 exported it
for exactly this. It reaches the client as load data, not as an import, because
`hooks.server.ts` pulls in the whole korg path. Period, not phase: the endpoint
reads korg live on every request.

**Staleness, which the WI did not ask for and the wall needs.** A refresh that
fails must not blank the board. `/` renders No Comms when korg is unreachable
and that is right for a *cold* load — there is nothing to render. The wall
already has a board, and the last thing korg actually said beats an error page
nobody is standing there to reload. So:

- refresh is `fetch('/api/wall')`, not `invalidateAll()` — a load throwing
  during invalidation takes the page to the error boundary, and nothing would
  be left running to recover;
- the last good payload stays on screen;
- the statline prints `NO REFRESH <age>` beside `asOf`.

That age is the one client clock on this board, and it measures something no
korg timestamp can: how long *this browser* has been unable to fetch one.

The loop lives in `src/lib/wall.svelte.ts` (`WallFeed`) rather than the route
component, so the failure path is testable. Verified end to end in a headless
browser with a faked clock: +3m current · +6m korg down → `NO REFRESH 3m`,
all 8 panels still up · +9m → `6m` · +12m korg back → marker clears.

## Also shipped

`src/app.html`'s static `<title>` moved into `+layout.svelte`'s
`svelte:head`. The wall needs its own title, and two static `<title>` elements
in one head is invalid HTML that different browsers resolve differently — not
a thing to leave under a kiosk. `svelte:head` keeps one, the innermost.

## Gates

`just check` green: 13 files, 120 tests. New gates, each negative-tested by
planting the defect it exists to catch:

| gate | planted defect | result |
|---|---|---|
| pinned program event (`ticker.test.ts`) | narrow `EventRow` to two kinds | 2 svelte-check errors |
| chip guard (`Ticker.svelte.test.ts`) | unguard `<span class="lp">` | fail |
| `.chips` structure (`OnDeck.svelte.test.ts`) | — | structural, matches what the CSS selects |
| `WallFeed` keeps last good board | blank payload on failure | fail |
| `WallFeed` teardown | drop `clearInterval` | fail (6 polls, expected 3) |

The #1284 and #1460 pixel measurements are **not** `just check` gates: they
need a browser, and kfdc adds no dependency to make a gate. The numbers and
the scripts are recorded here instead.

## Follow-ups

- Nothing blocking. The measurement scripts live in `.scratch/` and are not
  committed; re-deriving them is a few minutes against `docs/design.md`'s
  no-leak rule, which is where the knowledge went.

## Deployed

**2026-08-19** — `0.5.0-fc88d05`, published from merged `main` (`fc88d05`) and
installed on **kubsdb** through knarr.

```
resolved  0.5.0-fc88d05
sha256    7dc8e2abd2d539084d94219a3c3ec661d28b0b19ba8bdc308cdd8a18b247edff
host      kubsdb  (user scope, shape directory)
total     1856ms
  stage    ok  388ms  uploaded to /tmp/knarr-kfdc-0.5.0-fc88d05.tar.gz
  backup   ok  187ms  current -> 0.5.0-e5f2162
  install  ok  207ms  unpacked versions/0.5.0-fc88d05; current -> 0.5.0-fc88d05
  restart  ok  221ms  restarted kfdc.service (user scope)
  ready    ok  255ms  ready after 1 attempt(s)
  confirm  ok  210ms  0.5.0-fc88d05
  cleanup  ok    0ms  pruned 1 old version(s): 0.5.0-acb917d
```

1.90s wall clock, `restart` 220ms — sprint 013's SIGTERM fix still holding at
the same numbers it was measured at.

**Rollback target: `0.5.0-e5f2162`** (sprint 013), still unpacked on the host.
`just deploy 0.5.0-e5f2162` is the whole rollback.

Three views agree: store `latest:`, the host's top `here:` entry, and
`running:` are all `0.5.0-fc88d05`.

### Verified live, against what this sprint changed

Not just "the service is up" — the deploy's own `confirm` step covers that.

| | |
|---|---|
| `/` and `/wall` over the tailnet | 200, SSR renders (`FIRE MISSIONS` present) |
| **#1204** chrome | mission line: 0 on `/wall`, 1 on `/` |
| **#1204** title | exactly one `<title>`, `K·F·D·C — wall` |
| `/api/wall` | 200, `{board, flow, netlog, korgBase}`, 20 Net Log lines |
| **#1204** refresh + staleness | faked clock against **production**: +3m current · +6m korg unreachable → `NO REFRESH 3m`, all 8 panels still up · +9m → `6m` · +12m korg back → clears |
| **#1284** | zero panel overflow at 1920 / 1600 / 1366 / 1200, on both routes |
| **#1460** | `scrollWidth === clientWidth` at all four widths (was 1475 at a 1366 viewport) |
| **#1197** | the live window carries **3 `program` events with `project: null`**, rendering 3 `/programs/1453` deep-links and **zero** empty `<span class="lp">` — before this sprint each would have spent a 6px flex gap on nothing |

**One thing not exercised live**: no program currently contributes two queued
rows, so On Deck has no roll-up on production and wall mode's inert roll-up
could not be observed there. It is gated by component tests
(`OnDeck.svelte.test.ts`) and by the measurement in this record; worth an eye
next time a program is queued.

### Small thing noticed, not acted on

`package.json` is still `0.5.0` and the `justfile` says "the minor tracks the
sprint (0.5.0 = sprint 005)". Sprints 006–014 all published as `0.5.0-<sha>`,
so that sentence is stale rather than violated — the commit half is what
identifies a version, exactly as the same comment goes on to say. Left alone
during a deploy; it is a comment fix, not a version bump.
