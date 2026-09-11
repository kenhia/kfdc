# 021 — Delayed Ops, compact: one line per soaking program

Slice **2.5** of program **korg:2167** (*extended testing as a first-class
state*), proposal **korg:2194**, work item **korg:2193**. Inserted after the
program had finished, on Ken's first day of actually living with the panel
sprint 020 built. Run as an overseen karc leg (`kfdc-147d24`) on kai; the ship
is gated on the overseer's clearance and the wrap-up returns as a handoff on the
proposal.

## The goal, and it is a measurement rather than a preference

Sprint 020 answered "a program nobody can advance should not sit in Operations
demanding attention" by building Delayed Ops. It was right, it shipped, and Ken
looked at it for a day. WI 2193 is the result — **two screenshots, one of them
marked up in three colours**, which is the entire spec and a better one than
prose would have been.

The finding: a panel built to stop a program generating demand was still
drawing a program's worth of card. 020's defining property was *what it does not
draw* (no slice chips, because every slice of a soaking program is terminal).
**021 is that same rule applied a second time, and to the panel itself.**

Ken's three marks:

1. **red line through the aim** — the widest line on the card, and one click
   away on the title.
2. **blue box round the soak rows** — collapse to one line of refs, grouped by
   project: `kmon #2180, #2181; kfo #2185`.
3. **green box round "blocks nothing"** — draw the blocks line only when
   something is blocked.

## Premise check

All three marks name things the component really did, checked in
`DelayedOps.svelte` before touching it:

- **`<p class="aim">` renders `r.program.aim`** — present, with a `nowrap` +
  ellipsis rule, i.e. genuinely the widest line. **Holds.**
- **A `<li class="soak">` per soak** carrying project chip, ref, title, a
  conditional status chip, a clock, and a `voids if` line. **Holds.**
- **`blocks nothing — nothing is waiting on this`** rendered in the `{:else}`,
  with the #2155 comment arguing for it. **Holds** — and the comment was
  updated rather than deleted, as the proposal required.
- `board.ts`'s `withoutSoaking` / `delayedOps` / `soakClock` / `withoutReviewed`
  are untouched, as scoped. This is a render change.

## The cross-project plan

kfdc is listed in `cross-project-planning/index.md` → `korg+/`. Nothing in it
contradicts the scope; three decisions point the same way this sprint does and
are cited in the code:

- **GP-1 / GP-18** — the board renders the rollup and **delegates** the node.
  That is precisely the trade the compact line makes: the `wi_number` is the
  link, and korg holds the title, the status and the invalidation clause one
  click away. The compaction costs a click, not information.
- **GP-16** — the per-node URL is korg's to emit. Refs still go through
  `NodeRef` → `korglink`, and the test asserts a real `href`.
- **GP-13** (numeric register) — render nothing where korg says it cannot say.
  It decides what the one clock does when no soak has a date: no chip.

## What shipped

**`DelayedOps.svelte`** — the card is now three lines at most.

- **Row 1 unchanged in content**, plus one clock: title ref, korg's status
  literal worn as a class (#1444), the clock, the span chips.
- **The aim line is gone.**
- **One `.soak-line`** replacing the `<ul>`: refs grouped by project, `,` within
  a project and `;` between. `byProject` is a stable group-by — groups in
  **first-appearance order**, soaks in korg's rank order within a group. korg
  ranks that array; grouping may gather refs without re-ordering the projects.
- **The blocks line is drawn only when `blocks.length > 0`**, and the #2155
  comment was rewritten to say why both renderings were right for their own
  card rather than deleted as if it had been wrong.

**`app.css`** — the panel's block shrank 174 → 121 lines. `.soaks`, `.soak`,
`.soak-head`, `.soak-t`, `.soak-st`, `.voids`, `.voids b`, `.soak-card .aim` and
`.clock.c-none` are gone; `.soak-line` and `.sep` are new.

**`docs/design.md` § Soaking work** — the row description amended to the compact
form; the reasoning paragraphs stand, with the two reversals recorded as
reversals.

## Decisions this sprint made

**The clock chip stays, and it is the soonest.** The proposal left this to the
leg with the overseer's default at *yes*. Kept: the panel's subtitle is "waiting
on the clock", and the soonest `check_after` is the date the program next
becomes judgeable — the one per-soak fact that was worth a glance, now stated
once per card instead of once per soak. It is chosen on the computed `days`
rather than by string-comparing the dates, so a soak korg carries with an
unparseable `check_after` drops out of the comparison the same way a null one
does, instead of winning it and rendering nothing.

**`no check date` is not replaced, it is dropped.** 020 said it in words because
a countdown from nothing is worse than silence. On this card the honest move is
no chip at all — GP-13's rule — and it is the *same* trade mark 3 makes for the
blocks line: at a three-line footprint an absent line reads as "nothing", not as
"not computed". Making those two consistent was worth more than preserving
either wording.

**The ref carries a tooltip.** A bare `#2185` is not legible on its own, so the
`title` attribute carries the soak's title, plus its `wi_status` when it is not
`open`. This is deliberately *not* the status chip mark 2 removed — no chip, no
line, no footprint — and it recovers the one signal 020's comment argued hardest
for: a soak that has been judged is the whole news, where a column of `open`
chips is none. **Flagged to the overseer for a ruling** rather than assumed.

**The separators are real characters in the DOM.** They were literal text nodes
first and Svelte trimmed the trailing space, rendering `#2180,#2181`; the test
caught it. Making them expressions (`{', '}`) puts the space back, which also
means the line copies out of the board as the spec writes it. CSS `::after`
would have rendered identically and been invisible to both the test and the
clipboard.

**`overflow-wrap: anywhere` moved rather than left.** 020's measured fix (#1284:
a 190-character path pushed a row 508px past the panel) lived on `.voids`, which
this sprint deletes. The proposal said to leave it because a row-1 title can
still be a path — so the protection is now on `.soak-card h3`, and `.blocks`
keeps its own.

## Tests

`DelayedOps.svelte.test.ts` — 20 tests, rewritten around the compact contract.
The negative assertions are now the larger half, which is right: the footprint
*is* the feature, so a regression that quietly puts a line back is a regression.
New coverage: grouping and its separators, first-appearance order under
interleaved projects, `—` for a null project, the ref's real `href`, the absence
of title / `voids if` / status chip / aim, the tooltip, the soonest clock across
several soaks, a dateless soak ignored beside dated ones, and no chip when
nothing has a date.

**Negative-tested**, per the repo's rule that a gate never seen to fail is not a
gate:

| planted error | result |
|---|---|
| `soonest` picks the latest (`>` for `<`) | 1 failed |
| `byProject` sorts groups by project name | 2 failed |
| the aim line restored | 1 failed |

Restored: 20 passed.

## The footprint, measured

Layout is the deliverable here, and jsdom cannot see it — #1284/#1460's lesson,
and the repo's rule that a headless run is how kfdc checks a layout claim.
A stub (`.scratch/2194/stub.mjs`) proxies production korg and puts program 2167
back to `soaking`, where this sprint's own start had just lifted it from, giving
**exactly the board Ken marked up**: 2070 with two kmon soaks, 2167 with one kfo
soak, two projects, everything else real. Then the same probe was run against
the 020 component and this one, same board, same widths — a controlled A/B
rather than a remembered before.

Delayed Ops panel height:

| width | before | after | saved |
|---|---|---|---|
| 3440 | 525px | 255px | **−51%** |
| 2560 | 600px | 254px | **−58%** |
| 1920 | 726px | 300px | **−59%** |
| 1600 | 788px | 299px | **−62%** |
| 1366 | 870px | 317px | **−64%** |

`overflowX` is 0 at every width in both, so nothing rendered past its box before
and nothing does now.

**The saving grows as the board narrows**, which was not predicted and is the
more interesting half: 020's card was mostly korg's free text — the aim, the
titles, `invalidated_if` — and free text wraps, so the panel was worst exactly
where space was tightest. A card of refs and chips barely moves. The compact
card is 73px for a program with a one-line title, against 230px.

## A selector that matched the wrong thing

Worth recording because the program's own watch-outs list "the seventh *matches
nothing*" and this is its sibling. The screenshot step used
`locator('.panel', { hasText: 'Delayed Ops' })` and captured **Fire Missions** —
because this sprint's proposal is *titled* "Delayed Ops, compact: ..." and was
sitting in Fire Missions at the time, put there by this very sprint. A text
locator over a board that renders korg's text will sooner or later match korg's
text. The fix is structural: anchor on `.panel-head h2` with an anchored regex,
and assert the match count is 1.

## korg transitions observed

This slice existed partly to *run* two korg paths that had been textually
verified in slice 3 and never executed.

- **`soaking → active` on start.** Program 2167 read `soaking` immediately
  before `update_proposal(2194, status: "active")` and `active` immediately
  after. korg's own lift (sprint 079's `promote_programs_over`) fired
  unprompted — **first live run**, no refusal. `start-sprint` Step 4a correctly
  did nothing: it lifts `holding` only, and `soaking` is korg's to maintain.
- **`active → soaking` at ship** is sprint-ship Step 6.5's, and belongs in the
  ship's own record below.

## Deployed

**`0.5.0-f2b1b19`** to **kubsdb**, 2026-09-11 01:16 UTC, from merged `main`
(`f2b1b19`). Published from a clean `main` and installed as that artifact —
`just publish` then `just deploy 0.5.0-f2b1b19`, one knarr call.

knarr status document, asserted rather than re-probed (`ok`, `resolved_version`,
every step, and `confirm`'s **detail** equal to the version — a `confirm` that is
merely `ok` says only that a cwd was readable):

| step | status | ms | detail |
|---|---|---|---|
| stage | ok | 400 | uploaded to `/tmp/knarr-kfdc-0.5.0-f2b1b19.tar.gz` |
| backup | ok | 195 | `current -> 0.5.0-eb7bc5a` |
| install | ok | 209 | unpacked `versions/0.5.0-f2b1b19`; `current ->` it |
| restart | ok | 218 | restarted `kfdc.service` (user scope) |
| ready | ok | 285 | ready after 1 attempt |
| confirm | ok | 206 | **`0.5.0-f2b1b19`** |
| cleanup | ok | 0 | pruned `0.5.0-6da12b4` |

`sha256 dc647031a723be12144b98329a8d9ed7bafb94ad3222427097756d3ccf099b43`,
**1916ms end to end** — in line with sprint 013's measured 1.91s, so the
shutdown fix is still bought.

**Verified live over the tailnet from kai** (not loopback — `tailscale_serve` is
the half loopback does not exercise): HTTP 200, SSR rendered (`fire missions`
present). The sprint's own work confirmed on the deployed board, which was a
real test rather than a formality: Step 6.5 had just put program **2167** back to
`soaking`, so Delayed Ops drew **two** compact cards — `kmon #2180, #2181` and
`kfo #2185` — the multi-project grouping rendering from live korg for the first
time. `soak-line` present; `soak-head`, `soak-t`, `voids` and `c-none` all
absent; **`blocks-none` element count 0**.

Three-way agreement: store `latest`, the host's top entry and `running` are all
`0.5.0-f2b1b19`. Rollback target if needed: `just deploy 0.5.0-eb7bc5a`, which
stays unpacked on the host.

**Reload before judging it** (kfdc WI 2190): an already-open board keeps the old
bundle until the tab is reloaded, so a viewer who was looking at the board during
the deploy is still looking at `0.5.0-eb7bc5a`.

### The locator trap, twice

A first pass grepped the live HTML for the string `blocks nothing` and found it,
which reads as a failed deploy. It is in program 2167's korg **`notes`**,
serialized into the SSR payload, quoting the very design decision this sprint
reversed. The panel renders no such element — `blocks-none` count is 0, which is
the assertion that actually means something. This is the same failure as the
screenshot step earlier in the sprint, in a different tool: **a text match over a
board that renders korg's text will eventually match korg's text.** Assert on
structure.
