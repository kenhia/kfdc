# 012 — the program-state palette: `queued` gets a colour, `holding` stops being red

Proposal korg:1446 (slice 2 of program korg:1447). Two items: **#1444**
(the new pre-active state needs a treatment) and **#1196** (`holding` is
painted red on a wrong reading of korg's vocabulary).

One sitting rather than two, and not just because they share two files:
these are the two colours that sit next to each other most often on the
board, and picking a blue for `queued` without knowing what neutral
`holding` lands on is how a palette ends up fighting itself.

Slice 1 (korg #1424, korg sprint 069) shipped and **is deployed on
kubsdb** — production serves `queued`, so this was written against the
real envelope, not a fixture.

## What was actually wrong: a default that meant something

Both bugs are one bug wearing two faces. The panel attached meaning with
predicates —

    class="op"
    class:holding={prog.status === 'holding'}
    class:op-done={prog.status === 'done'}

— which makes the *base* the treatment for every literal nobody wrote a
predicate for. The base was amber. So `queued` arrived from korg 069 and
read as in flight: a program nobody had started drew the eye to the
ACTIVE callout, which is exactly what Ken filed #1424 about.

`holding` had the opposite failure — a predicate, but one asserting a
semantic korg does not have. The CSS said so out loud:

    /* Holding is a decision waiting on Ken — red, like Commander's Call. */

korg means the reverse. `holding` is the resting state between slices,
the state a program spends most of its life in, and the reason the
lifecycle is not just `active`/`done`. Awaiting-Ken is a **column** set
by `set_awaiting` and rendered by Commander's Call — never a status
value. So the alarm was near-permanent and led nowhere: Ken went looking
for the decision in Commander's Call and on korg's Today page and found
nothing, because there was nothing.

## The shape of the fix

One class per korg literal, and a base that is layout only:

    <div class="op op-{prog.status}">

`.op` is now neutral ground. The four states each state their own
treatment, so the palette reads as a table — and a literal kfdc has never
met renders **quiet** instead of borrowing whichever state happened to be
the default. korg owns the vocabulary and can grow it between deploys;
that is the runtime half of the guarantee.

| state | treatment | why |
| --- | --- | --- |
| `queued` | cyan, filled chip | Ken's call on #1424 — the tone already carrying On Deck's depth bars. Queued, not running, not alarm. |
| `active` | amber | the board's one attention colour, unchanged |
| `holding` | neutral, **outline** chip | resting is unremarkable; the only unfilled chip on the board, because a filled one reads as something happening |
| `done` | dim | finished, and dimmest of the four |

`holding` restates the neutral base rather than omitting its rule. The
redundancy is deliberate: the palette stays a table you can read top to
bottom, and the base can move later without silently moving `holding`
with it.

### The design question #1196 carried

**Should Operations surface awaiting-Ken at all?** Answered *no*, which
was #1196's own recommendation. Commander's Call is the awaiting lane and
one of the four named FDC concepts; a second place to look for the same
thing is guaranteed to drift. Operations renders program shape and slice
progress. There was no concrete case of a Commander's Call row being
missed — the case that started this was the red flag, which pointed at
nothing.

## The grep #1196 asked for, and what it found

#1196's notes asked for a sweep of other places kfdc infers meaning from
a korg status value rather than reading the field that carries it. One
real sibling, in the same file:

    s.status === 'done' ? 'done' : s.status === 'active' ? 'now' : 'next'

A `declined` slice fell into "still ahead" and sat pending forever — and
**disagreed with `board.ts`**, whose `PROPOSAL_FINISHED` counts `declined`
as finished for the On Deck remaining count. The same korg fact defined
twice in one repo, the two definitions already drifted. Now `declined`
renders as dropped (`✕`, dashed, struck through).

Cleared as *not* siblings:

- `board.ts:200` `PROPOSAL_FINISHED = {done, declined}` — mirrors korg's
  terminal set and says so.
- `SensorNet` mapping report status to a light — `problem`/`attention`/
  else-green over korg's closed 3-value `REPORT_STATUSES`, which korg
  fences with a vocab test. Same *shape*, no exposure today; noted, not
  changed.
- `splashing()` — a kfdc rendering concept derived from work-item counts.
  korg emits no `splash` literal, so there is nothing to switch on.
- `d.status === 'active'` on project depth rows — a positive test for one
  literal, which is the correct form.

## Gates

Two new, both negative-tested (the planted error was watched to exit 1):

- `Operations.svelte.test.ts` — every korg literal gets a card class of
  its own, the chip prints korg's literal verbatim, an unknown status
  lands on the neutral base, a declined slice reads dropped.
- `palette.test.ts` — every literal in `PROGRAM_STATUSES` has both a
  `.op-<s>` and a `.status.<s>` rule in `app.css`, and neither holding
  rule mentions `--red`.

`palette.test.ts` is honest about its reach: it cannot notice korg
growing a fifth status, because its list is kfdc's record of what the
board has *chosen a treatment for*, not a second copy of korg's
vocabulary. The neutral base covers that case at runtime. What the gate
catches is the likelier order of events — the list gets mirrored from
korg and the CSS is forgotten, which is precisely how `queued` shipped
without one.

`PROGRAM_STATUSES` lives in `board.ts` beside `ProgramRow`, whose
`status` stays `string`: korg is the authority, and kfdc must render an
unknown literal rather than fail on it.

## Verified

- Against **live production korg** through the dev server: program 1447
  renders `op op-holding` with the outline chip. That program is this
  program — the board was painting its own sprint red while the sprint
  ran.
- `queued` has **no live example to verify against**. Every historical
  program is `done` and 1447 has started; korg #1424's own note says the
  next program *created* will be `queued` and warns against hand-editing
  a fixture. Left unverified-in-production on purpose rather than writing
  to korg to manufacture one — board-renders/agents-curate, and #1446
  says display only. The colour was eyeballed instead from a preview
  rendered out of the real panel markup against the real `app.css`, all
  four states side by side.

## Plan amendment

`korg+/PLAN.md` GP-13's state half gains the consumer-side rule this
sprint proved out: where korg emits a literal the consumer has no
treatment for, render neutral — never another state's. Same argument as
GP-13's numeric consumer half (render nothing rather than a substitute
you derived), one register over.
