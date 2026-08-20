# 016 — Expanded mode: korg in an iframe pane right of the board

Proposal korg:1470 · work item #1203 (M) · slice 2 of program korg:1471.

## Goal

Click a ref on the board, get the whole korg node in a pane beside it —
notes, comments, edit, clear-awaiting — without kfdc rendering any of that
itself. The point is not convenience. It is that kfdc can now *never* need
an edit surface, because the edit surface is real korg on the same screen.
korg+ GP-1 at its sharpest: the board renders the rollup and **delegates**
the node.

Decided 2026-08-05, carried through sprint 009's roadmap retirement, and
unqueued on its own instruction until picked up. Picked up 2026-08-19 as a
program rather than a proposal, because korg owned the prerequisites.

## Slice 1 was real, and it was checked before anything was built

korg:1469 shipped `/n/:node_id` and `KORG_FRAME_ANCESTORS` in korg sprint
070. The proposal's notes say in as many words: *do not start this expecting
to stub either half*. So the first thing this sprint did was ask production,
not korg's status field:

```
$ curl -sD- https://kubsdb.encke-wahoo.ts.net:5674/n/1203 -o /dev/null
HTTP/2 307
location: /work-items/1203
content-security-policy: frame-ancestors https://kubsdb.encke-wahoo.ts.net:8100
```

Route resolver live, allowlist live, kfdc's exact origin admitted.

## What shipped

**One rule builds every korg URL.** `$lib/korglink.nodeHref(base, nodeId)`
→ `${base}/n/${nodeId}`. No `kind` parameter, and there is deliberately
nowhere to put one.

**The map that stood there was deleted, and it was wrong.** `lineHref` in
`netlog.ts` — shared with the Ticker — was a consumer-side kind → path map,
which is exactly the forbidden third answer GP-16 names. It was also broken
in production in a way nothing on the board could reveal:

| kind | it emitted | reality |
|---|---|---|
| `workitem` | `/work-items?wi=N` | a URL korg never served — the Work Items page reads no URL parameters, so every Net Log and Ticker work-item link landed on the *unfiltered list* |
| `sprint_proposal` | `/planning` | the list page, not the node |
| six other kinds | `null` | rendered unlinked — correctly, under kfdc #993's don't-fake-URLs rule, but smaller than it needed to be |

korg sprint 070's audit found the first row; kfdc could not have. The fix
and the feature are the same change, which is why the cleanup is in scope
rather than a detour.

**Every ref on the board is now a link.** `$lib/NodeRef.svelte` is the one
component that draws one, and it is an `<a href>` first: modified clicks and
middle-click are left to the browser, so ⌘-click into a tab and "copy link
address" keep working. It hijacks the plain left-click only. Applied to
Fire Missions' id chip, Commander's Call's id chip (the highest-value one —
that lane exists to be acted on, in korg), both Deconfliction node chips,
Operations' program title and slice chips, Sensor Net's report source, the
On Deck queue titles, and the two feeds that were already linking. On Deck's
program roll-up row is deliberately **not** linked: its one click already
belongs to the expand control, and two things wanting the same click is how
an affordance stops meaning one thing.

**The pane opens on click and collapses.** `$lib/KorgPane.svelte` +
`PaneState` in `$lib/pane.svelte.ts`, published to every ref through Svelte
context rather than drilled through eight panels — `korgBase` was already
being threaded to two of them, which is the shape that says it belongs in
context. Sticky, so it does not scroll away from a long board. Escape
closes. `open in korg ↗` hands the same URL to a full window, because a
700px column is the wrong place for some of korg's pages.

**The iframe is keyed on the node.** Reassigning `iframe.src` on a live
element pushes an entry onto the *top-level* session history, which hands the
board a Back button that silently rewinds the pane instead of leaving the
board. `{#key}` builds a fresh element instead. `location.replace` is the
other fix and is unavailable: korg is cross-origin, which is the entire
reason the CSP allowlist exists.

**No sandbox attribute, on purpose.** korg needs its own scripts, forms and
same-origin storage to be the real editor this pane exists to provide. The
perimeter is the tailnet (GP-17).

**The wall has no pane.** `Board.svelte` hands `/wall` a *disabled*
`PaneState` rather than hiding an enabled one, so no panel needs a `wall`
prop just to decide whether a ref is clickable. Refs there stay the plain
links they always were — the wall withdraws the pane, not the address.

## Layout: the board sheds a column instead of overflowing one

The real risk of this sprint. Panels were tuned for a full widescreen and
#1284 / #1460 were both overflow bugs jsdom cannot see. Taking ~38% of the
width away is that risk on purpose.

The fix is that `.deck-main` is a CSS **container** and `.board`'s column
count keys off *its* width rather than the viewport's. Thresholds are the old
1200/760 viewport breakpoints less the body's 36px of side padding, so a
board with no pane open sheds its columns at exactly the widths it always
did — byte-for-byte parity, confirmed below at 1200.

Measured with playwright from `.scratch/pane-layout.mjs` (deliberately not a
dependency and not a `just check` gate — same call as #1284):

```
3840  closed cols=3 board=3804 hscroll=0 | open cols=3 board=2888 pane=902 hscroll=0
2560  closed cols=3 board=2524 hscroll=0 | open cols=3 board=1608 pane=902 hscroll=0
1920  closed cols=3 board=1884 hscroll=0 | open cols=2 board=1152 pane=718 hscroll=0
1600  closed cols=3 board=1564 hscroll=0 | open cols=2 board=954  pane=596 hscroll=0
1366  closed cols=3 board=1330 hscroll=0 | open cols=2 board=809  pane=507 hscroll=0
1200  closed cols=2 board=1164 hscroll=0 | open cols=1 board=706  pane=444 hscroll=0
```

Zero page overflow and zero panel spill at every width, pane closed and open.

**Negative-tested** (`.scratch/neg-container-query.mjs`) — revert the
container query to the viewport media query it replaced and the pane-open
board keeps three columns and leaks:

```
1920  as shipped          cols=2 hscroll=0 worstSpill=0px
1920  reverted to @media  cols=3 hscroll=0 worstSpill=12px
1600  as shipped          cols=2 hscroll=0 worstSpill=0px
1600  reverted to @media  cols=3 hscroll=0 worstSpill=12px
1366  as shipped          cols=2 hscroll=0 worstSpill=0px
1366  reverted to @media  cols=3 hscroll=0 worstSpill=12px
```

## The frame actually loads — verified in both directions

`.scratch/csp-real.mjs`, against production korg:

```
top https://kubsdb.encke-wahoo.ts.net:8100/     (kfdc's origin — on the allowlist)
   frame url : https://kubsdb.encke-wahoo.ts.net:5674/work-items/1203
   frame text: "korg Today Cards Work Items Planning Programs Reports Schedules Reading Plan Search korg ←"
   csp block : none

top http://127.0.0.1:5199/                      (not on the allowlist)
   frame url : chrome-error://chromewebdata/
   net fails : ["net::ERR_BLOCKED_BY_RESPONSE"]
   csp block : ["Framing 'https://kubsdb.encke-wahoo.ts.net:5674/' violates … frame-ancestors"]
```

The 307 is followed inside the frame and korg's real UI renders. The
default-closed half holds too, which is GP-17 doing its job rather than a
problem.

**A dead end worth recording so nobody re-walks it.** The first version of
this probe used playwright `route.fulfill` to synthesise a page *at* kfdc's
origin. Both origins then failed with
`net::ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS` — Chromium's Local Network
Access check, not CSP. A fulfilled page makes no network request, so
Chromium cannot classify its address space and treats the subframe request to
a tailnet (100.64/10) address as public→local. Loading the **real**
production page first gives the frame the real address-space relationship and
the block disappears. The lesson generalises: a synthetic origin is not an
origin for anything the network stack decides.

**Consequence, documented rather than worked around:** the pane cannot
render under `npm run dev` or `vite preview`, both of which serve
127.0.0.1. kfdc does not try to detect the refusal — a cross-origin frame
cannot be inspected, and guessing would mean claiming something the board
does not know. The pane's `open in korg ↗` works regardless.

## Gates

`just check` green: prettier, eslint, svelte-check, build, 17 test files /
156 tests. Three new suites, each negative-tested by planting the error it
exists to catch:

| gate | planted error | result |
|---|---|---|
| `korglink.test.ts` — no kind → path map | added a `kindHref(base, kind, id)` export | ✗ `expected [ 'nodeHref', 'kindHref' ] to deeply equal [ 'nodeHref' ]` |
| `NodeRef.svelte.test.ts` — modified clicks are the browser's | deleted the modifier guard | ✗ 5 failed (meta, ctrl, shift, alt, middle) |
| `pane.svelte.test.ts` — the wall's pane cannot open | made `show()` ignore `enabled` | ✗ `never opens, however hard it is asked` |

Wall behaviour checked in the browser too (`.scratch/wall-pane.mjs`):
`/wall` grows no pane and its ref navigates away like an ordinary link;
`/` opens the pane and does not navigate.

## Found on the deploy: Escape was dead

The Phase 7 smoke test against production caught what no local check could.
Everything else passed — 53 refs all on `/n/<id>`, zero legacy URLs, the
done-criterion satisfied, three columns and no overflow at 2560, the wall
growing no pane — and then:

```
Escape closes the pane      : false
```

Chromium focuses a freshly loaded iframe. `document.activeElement` became
`IFRAME.pane-frame` about a second after the pane opened, and from that moment
the window saw **zero** keydowns — korg's frame is cross-origin, so its
keystrokes are korg's. The header said `close (Esc)`; the board could not
honour it. That is the one thing `docs/design.md` forbids outright, and it was
live for the length of one deploy.

The pane now takes focus back once, on the frame's `load`, and the gate that
would have caught it is `KorgPane.svelte.test.ts` — negative-tested by
deleting `onload={holdFocus}` and watching *takes keyboard focus back from the
frame when it loads* fail.

**The lesson is about the first attempt at that gate, not the bug.** Removing
`onload` with a `sed` pattern written against the pre-prettier indentation
matched nothing, the suite passed, and for one minute a no-op read as a
negative test confirming the fix. A gate is not proven by a passing suite
after a planted error — it is proven by *seeing the specific assertion fail*.
Check the failure, not the exit code.

## Decisions

- **Opens on click, collapses** rather than an always-on split or a separate
  `/desk` route. The board was designed full-width and is measured that way;
  an always-on pane would mean it never again renders at the density it was
  built for, for a pane that is empty most of the time.
- **Every ref with a node id is clickable, not a hand-picked set of kinds.**
  `/n/:id` resolves all nine, so choosing kinds would mean rebuilding exactly
  the map GP-16 forbids.
- **Context, not props.** Eight panels do not each take a `korgBase` they
  only pass along. `usePane()` throws when there is no pane in context rather
  than degrading — the lenient version renders `undefined/n/1203` into a live
  href.
- **Global `a { color: inherit }`.** Refs were `<span>`s until this sprint;
  a link that repainted itself would have recoloured six panels to advertise
  a feature. Amber on hover is the whole announcement.

## Follow-ups

- **Local development cannot see the pane** (above). The fix, if it is ever
  worth one, is a second entry in korg's `KORG_FRAME_ANCESTORS` — a korg
  config change, not kfdc code, and GP-17 already says it is a list. Not
  filed: nothing is blocked, and the pane is the one part of the board that
  is trivial to verify in production.
- `AwaitingRow` and `RelatedRef` still do not carry korg's `url` field
  (noted in korg sprint 070). kfdc does not need it — `/n/:id` covers every
  case — but GP-16 points that way if a second consumer lands.
