# 022 — The board tells the truth and you can reach it

Slice **4** of program **korg:2816** (*Clear the korg backlog*), proposal
**korg:2824**, covering work items **korg:1551**, **korg:1841**, **korg:2184**,
**korg:2190** and **korg:2823**. Run as an overseen karc leg (`kfdc-aa2e12`) on
kai; the ship is gated on the overseer's clearance and the wrap-up returns as a
handoff on the proposal.

The first slice of this program outside korg, and the reason the program's span
is now `korg, kfdc` rather than an anticipated one.

## The goal

korg slice 2 shipped a fifth report-source freshness literal, `on-demand`, and
kfdc is its consumer — so the program that caused it owns finishing it. Four
smaller items ride along, three of them unrelated to the program and chosen
deliberately by Ken over the strict-coupling bundle: opening kfdc for one
rendering tweak and leaving three small items sitting is the waste the
one-repo-at-a-time rule exists to stop.

**Four of the five shipped. The fifth turned out not to be the work it said it
was**, and is with the overseer.

## Premise check

The proposal's notes said this was a known-answer pass rather than a discovery
pass. Four items held exactly, and the fifth was the discovery.

| Item | Verdict |
|---|---|
| **2190** build id / reload | **Holds.** No `build` field in `BoardPayload`; nothing in `feed.svelte.ts` compares one. |
| **1551** pane repeat click | **Holds, with the cause now exact** — see below. |
| **1841** Rate of Fire | **Holds.** Column 3 was Commander's Call → Sensor Net → Rate of Fire. |
| **2184** curator flag | **Holds.** `bin/update-fdc` passed `--allowed-tools`/`--disallowed-tools` and no `--permission-mode`. |
| **2823** on-demand | **Drifted, and the drift changes the conclusion.** |

### 2823 — the board renders no source freshness at all

The item asked for a check against korg's two known defect shapes: an exclusion
list that misses the new literal, and an `{:else}` arm printing "every undefined
days". **kfdc has neither, because it has nothing for them to be in.**

Sensor Net renders `board.reports` — report *records*: status light, summary,
`ESCALATED`, `✓ reviewed`, age. It does not render report *sources*.
`freshness`, `cadence_days`, `overdue_days`, `due_by` and `on_demand` appear
nowhere in kfdc — not in a type, not in a panel, not in a test. Confirmed at the
type level too: the `Board` interface has no `sources` field, and the
`Board.svelte.test.ts` fixture that enumerates korg's rollup does not carry one.

So the board is not misrepresenting `on-demand`. It is **silent** about source
freshness, and has been since Sensor Net shipped.

What the check did find: **`/api/board` carries a `sources[]` array that kfdc
consumes none of.** Ten rows live, with the whole contract — `freshness`,
`on_demand` as a real boolean (GP-13), `cadence_declared`, `due_by`,
`overdue_days`, `note`. Both declared sources are correct upstream
(`kyac`, `kfo-soak`: `on-demand`, `on_demand: true`, null cadence, zero
overdue). korg's side is doing exactly what it says.

That makes the work *add a rendering kfdc has never had*, not *correct a wrong
one* — a scope decision rather than a repair, on three counts:

1. **It is a new surface in the board's densest column.** Sensor Net's own
   stated question is *"is the net reporting"* (`docs/design.md`), which is
   precisely what `sources[].freshness` answers, so there is a real argument the
   gap should be filled. But which rows it draws, whether retired sources appear
   at all, and what it costs in height are density calls.
2. **It pulls directly against 1841, in this same sprint.** 1841 exists because
   column 3 already does not fit — *"even maximized I have to scroll to see Rate
   of Fire."* Source rows make that column taller. Two covered items pulling
   opposite ways on one column is the clearest available signal that this is a
   decision.
3. **The item's acceptance criteria do not apply as written.** "Do not show a
   due date, an overdue count, or a cadence" and "sort it where korg sorts it"
   describe korg's own sources panel. kfdc shows none of those and sorts no
   sources, so building to that text would mean inventing the surface those
   criteria constrain.

Filed as a premise-check comment on korg:2824 at the *start* of the sprint
rather than saved for the wrap-up, so the ruling could be forming while the
other four were built. Recommendation given: **its own kfdc slice**, with the
height decision made deliberately alongside 1841's outcome — not "nothing to
do", because a source korg was actively lying about for days is invisible on the
board either way, and that is a worse silence than a wrong colour.

One thing worth recording whichever way it is ruled: **GP-14's specimen hazard
is not set here.** Sprint 019's lesson is in force — `Operations.svelte.test.ts`
asserts its unknown-literal specimen's own fictionality against the mirrored
vocabulary — and no kfdc test uses `on-demand` as a hypothetical. The amendment's
warning was checked rather than assumed.

## What shipped

### 2184 — the curator's fence is the fence it documents

One flag, `--permission-mode dontAsk`, ahead of the allowlist it makes real. The
header comment claimed korg was "the only reachable tool surface" and on kai
that was not what ran: a headless `claude -p` child inherits
`permissions.defaultMode` from `~/.claude/settings.json`, which on kai is
`bypassPermissions`, so every tool not on the *deny* list ran regardless of
`--allowed-tools`. kfo's `bin/soak-scan` is the reference and has both halves.

- The flag, and the header corrected to say what enforces the fence.
- A `just check` harness gate greps for the exact argv line, the same shape as
  sprint 006's `Environment=PATH=` guard.
- **Verified against the installed binary, not the reference**: `dontAsk` is a
  valid `--permission-mode` choice on Claude Code 2.1.274 (kfo's evidence was
  2.1.263).

### 1841 — a constant-height panel goes first in its column

Rate of Fire now leads column 3. The rule this produced is in `docs/design.md`,
and it is about **height constancy rather than importance**: Rate of Fire is the
only panel on the board whose height is fixed — a native-pixel svg of korg's
flow window, drawn 1:1 and never stretched — so everything else in that column
grows and it does not. Placed last it was the panel paying for everyone else's
growth. Placed first it cannot be pushed off, and the panels that *can* absorb
overflow are the ones that do.

### 1551 — asking for the node already on show is a real request

The cause, which the item marked with a `(?)`: `KorgPane.svelte` keyed the
iframe on `{#key pane.node}`, and `show()` assigned the same value, so
re-clicking the node already framed re-keyed nothing, created no new element,
and therefore did not navigate. Ken's workaround — click a different ref and
back — was the fix performed by hand.

Fixed with a monotonic **`frame` counter** on `PaneState`, bumped by every
`show()`, with the iframe keyed on that. Three properties worth keeping:

- **It stays inside GP-17.** Still `iframe.src` only, no channel back from
  korg. The pane being one-way is exactly *why* the repeat click is a real
  request: kfdc cannot see where the reader navigated to inside the frame, so
  `node` is the node kfdc last **set**, never the page on screen.
- **A new element rather than a re-pointed `src`**, which is the pre-existing
  reason the key is there at all: reassigning `iframe.src` pushes onto
  **top-level** session history, handing the board a Back button that rewinds
  the pane instead of leaving the board.
- **The tempting optimisation IS the bug.** `if (nodeId === this.node) return`
  looks like a saving precisely because the state it compares is the only state
  kfdc can see. Written into the code comment, not just here.

Not persisted: `frame` identifies an iframe in this document, and there are no
iframes across a reload. The stored shape stays `{ node }`.

### 2190 — an open board takes a deploy by itself

The bug Ken hit minutes after sprint 020 deployed: refreshing in place (#1496,
deliberate, so the korg pane survives) means a tab keeps executing the client
bundle it was **served** with, so after a deploy it draws the old board over new
data indefinitely. The wall is the worst case — the one display nobody ever
reloads.

- `src/lib/server/build.ts` reads the **`VERSION` file the bundle already
  ships**, cwd-relative. Deliberately not a new identifier: it is the same
  stamp knarr verifies on its local copy before touching the host and confirms
  afterwards, and a build id that could disagree with the deployed version would
  be worse than none. Cached, because a deploy *is* a restart.
- `BoardPayload.build: string | null`, produced in `page-data.ts` so all three
  payload producers carry it.
- `BoardFeed` gains a `BuildWatch` — `of`, `reload`, `delayMs` — compares every
  successful load against the build the **seed** carried, and latches. The
  reload is **injected**, for two reasons: jsdom has no `location.reload` to
  call, and the desk and wall want different policies, so detection lives in the
  feed and policy lives in the routes that differ.
- The wall reloads at once. The desk shows `BOARD UPDATED reloading` for
  `RELOAD_NOTICE_MS` first, because a board that blanked under Ken's cursor with
  no explanation is indistinguishable from a crash.
- **Amber, not red** (palette gate extended). `NO REFRESH` earns red — the board
  could not ask and the reader may have to go and look. This is the board
  working correctly and saying so.

**Two nulls are not a change**, and that is the load-bearing half. `null` means
the server cannot say which build it is, which is the *ordinary* answer under
`npm run dev`. A change requires both sides real and different, or a dev board
reloads on every poll forever. That is GP-13's consumer half applied to a field
of kfdc's own rather than one of korg's — the same instinct, a different
register.

This does not reintroduce what #1496 fixed: a build change is once per deploy,
so the pane is lost once per deploy rather than once per refresh, and it returns
from `sessionStorage` — exactly the floor that store was built to be.

## Verification

`just check` green: prettier, eslint, `svelte-check` 401 files 0 errors, build,
**379 tests across 27 files** (up from 353).

**Every gate added this sprint was negative-tested**, and one of them measured
the artifact rather than a fixture.

| Gate | Planted failure | Result |
|---|---|---|
| harness grep for the curator flag | removed the argv line | exit 1 with the reason |
| column order (2 tests) | restored the pre-1841 order | both fail, rest green |
| repeat-click re-frame | keyed on `pane.node` again | **exactly one** test fails — the repeat-click one; the different-node test stays green, so the test isolates the bug rather than the mechanism |
| build change → reload | 25 polls at an unchanged build | reload never called |
| build change → reload | null on either side, and both | reload never called |

**Measured against the built artifact, not a unit test** — because a
cwd-relative file read is the one thing `vitest` cannot see. The adapter-node
output was run from a replica of the deployed layout (`VERSION` beside `build/`,
the shape verified on kubsdb: `/proc/<pid>/cwd` is the version directory and
`VERSION` is in it):

- with a stamp → `/api/page` returns `build: "0.5.0-testsha"`
- **without** one → `build: null`

The one check this turn could not fire is the end-to-end deploy: a board open
across a real deploy reloading. That is a **test with a trigger, not a soak** —
the trigger is `just deploy`, which sprint-ship's Phase 7 runs minutes after the
merge. It is named in the wrap-up for the ship turn to fire and judge, and it
creates no work item.

`jsdom` prints 6 "Not implemented: navigation" lines from pre-existing anchor
tests. Measured identical on `main` (6) and this branch (6) — not introduced
here, and not a failure.

## Repaired in passing

- **`bin/update-fdc`'s header claim.** It described a fence that was not in
  force. Corrected in the same edit as the flag, with the measurement and the
  reason the deny list masked how much was exposed.
- **`docs/deploying.md`'s deploy advice.** WI 2190 carried a stopgap — *hard-reload
  the board after any kfdc deploy* — which this sprint makes obsolete. The
  deploy doc now says open boards take a deploy themselves, and that a board
  which was open across a deploy and did **not** reload is a live acceptance
  check with `just versions` as the diagnostic.

## Follow-ups

None filed. The only open question is 2823's ruling, which belongs to the
overseer and is recorded as a comment on the proposal rather than as a work
item — filing one would be filing the question back at the person being asked.
