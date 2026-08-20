# kfdc visual identity

Decided 2026-08-04 with the approved concept
([`design/kfdc-concept.html`](design/kfdc-concept.html) — self-contained,
open in a browser). The board is a **night-ops FDC plotting board**: dark
olive-charcoal ground, manila ink, grease-pencil accents. Single-theme dark
is a deliberate commitment, not an omission.

## Rules that outrank taste

- **Dense on purpose.** Widescreen, information-first, breaks
  whitespace-worship deliberately. Never "clean it up" into a marketing page.
- **The FDC vocabulary is load-bearing** (Ken is ex-11C): Fire Missions
  (active sprints) · On Deck / priorities of fire (ranked queue) ·
  Deconfliction (sequencing collisions) · Commander's Call (blocked on Ken) ·
  Operations (multi-project programs) · Sensor Net (health/risk) ·
  Net Log (radio traffic on the fires net — what changed since you last
  looked, observed times, panel codes FM/CC/OD/OP) · Ticker (korg's own
  transition log, footer strip) · Rate of Fire (work-item flow — are we
  gaining or losing ground).
- **Two transition feeds, and they must not converge** (kfdc #1186,
  sprint 008). The Net Log is *observer-relative* — what this board saw
  change, at observation time, in FDC verbs. The Ticker is
  *korg-authoritative* — what korg recorded, at korg's exact instant, in
  korg's own words (`proposed→active`, never translated to `firing`). They
  differ in **form** as well as content, which is how the division of labour
  reads without being explained: the Net Log is a vertical transcript, the
  Ticker a horizontal run. Measured, not assumed: on the live window only 4
  of 20 korg events had any Net Log counterpart, and the Net Log's own
  majority traffic (queue movement, splash, awaiting) is invisible to korg's
  log by construction.
- **The board renders the rollup; real korg renders the node** (kfdc
  #1203, sprint 016 — korg+ GP-1 at its sharpest). Every ref on the board is
  a link into korg, and on the desk it opens korg *in a pane beside the
  board* rather than navigating away. kfdc therefore never grows notes,
  comments, an edit form or a clear-awaiting button: the thing that owns
  those is on screen next to it. A future "just a small edit here" is a
  change to this contract, not a feature. See § Expanded mode.
- **Proposed/unbuilt things get dashed borders** (grease-pencil); live data
  gets solid. Never blur that line.
- Status is encoded in form + color, never color alone (chips carry text).
- Data and labels in mono (`ui-monospace`), prose in system sans;
  `tabular-nums` wherever digits align.
- **Say one thing once.** Where two panels would draw the same fact, one
  draws it and the other says who did. A program's declared order belongs to
  Operations; On Deck collapses its queued slices into a single roll-up row
  (`PROGRAM` tag in `--cyan`, span chips, `n of m slices`), and Deconfliction
  prints `n sequenced by <program> — drawn in Operations` in place of the
  cards (kfdc #1064/#1070, sprint 007).
- **A status literal with no treatment renders neutral, never the default's.**
  Every korg status the board paints states its own rule, and the base carries
  layout only. A predicate per state (`class:holding={…}`) silently makes the
  base a treatment for every literal nobody matched — which is how korg's
  `queued` arrived and read as in flight (kfdc #1444, sprint 012). korg owns
  the vocabulary and grows it between deploys, so the board *will* meet an
  unrendered literal in production; quiet is the only safe default. Program
  states: `queued` cyan, `active` amber, `holding` neutral, `done` dim.
- **A filled chip means something is happening; the outline chip is rest.**
  `holding` is the board's only unfilled status chip — korg's resting state
  between slices, and the state a program spends most of its life in. It was
  red until kfdc #1196, on a semantic korg does not have (awaiting-Ken is a
  column set by `set_awaiting` and drawn by Commander's Call, never a status),
  so the alarm was near-permanent and led nowhere. **Red is for an ask, never
  for a resting state.**
- **Nothing disappears silently.** A panel that hides rows names what it
  hid and where it went — the roll-up is expandable (`▸`/`▾`, the board's
  only interactive control), and the Deconfliction aside is a faint receipt
  for a card that is not there. An empty panel must never be the result of
  quiet omission.
- **Nothing renders past its box** (kfdc #1284, sprint 014). Density is
  spent on information, never on content the panel then clips or spills. The
  board is a table-heavy layout, and the trap is specific: a cell that cannot
  shrink makes an auto-layout table exceed its own declared `width` and take
  every row in the column with it. Two shapes cause it — adjacent inline
  chips with no whitespace to break on, and a flex item whose
  `text-overflow: ellipsis` can never fire because `min-width: auto` will not
  let it shrink. The remedies are a wrapping `.chips` group and
  `min-width: 0` on the item *plus* `max-width: 0` on the cell; `.aim` and
  `.slice-t` bound theirs with an em `max-width` instead, which works only
  where the box is content-sized rather than a table column. **Measure before
  choosing** — the screenshot shows the symptom, and the row that leaks is
  usually not the row at fault.

## Wall mode

`/wall` — the same board, on an unattended widescreen (kfdc #1204, sprint
014). It is a display **mode**, not a second layout: one `Board.svelte`
renders both, and a panel that behaves differently on the wall takes a
`wall` prop rather than growing a variant. Anything that needs a different
*layout* on the wall is a sign the desk board's density was wrong.

- **The wall draws no affordance it cannot honour.** Nobody is at the
  keyboard, so On Deck's roll-up — the board's only interactive control —
  renders as text: collapsed, no caret, `n of m slices` kept. That last part
  is the honest half; it says there is more behind the row without offering
  to open it, and #1064's argument is that the collapsed form is the
  informative one anyway. **This is a rule, not a one-off**: any future
  disclosure (korg+ GP-11's kfo summary bar above On Deck is the next one)
  needs a text form, not a disabled state.
- **Chrome here means prose, not data.** kfdc had almost none to drop, which
  is the point of having built it dense. What goes is the mission tagline —
  it explains the board to someone meeting it, and the wall has no first
  meeting. What **stays**: the crest and wordmark (identity matters more to a
  screen recognised from across a room than to a tab opened on purpose), and
  every scope claim — `omitted: n done`, `feed: korg transitions · newest 20`
  — because removing one makes a panel claim more than it knows.
- **A wall that cannot refresh says so.** The wall polls on the board's one
  cadence (`POLL_INTERVAL_MS`, imported, never restated — two clocks would
  disagree about how fresh the board is). When a refresh fails it **keeps the
  last good board** and prints `NO REFRESH <age>` in the statline beside
  `asOf`; it does not blank to No Comms. No Comms is right for a cold load —
  there is nothing to render — but once there is a board on screen, the last
  thing korg actually said beats an error page nobody is standing there to
  reload. Silence is the failure mode: a stale queue rendered as if current
  is exactly the wrong information the wall cannot be scrolled away from.
- **One client clock, and only there.** Every age kfdc prints is measured
  against korg's `generated`. The staleness age is not an age of korg's data
  — it is how long *this browser* has been unable to fetch any, which no korg
  timestamp can answer.

## Expanded mode — the korg pane

`/` only (kfdc #1203, sprint 016; slice 2 of program korg:1471). Clicking any
ref on the desk board opens **real korg** in an iframe pane to the right of
the board, deep-linked to that node.

- **The pane is the whole node; the board is only the rollup.** This is what
  keeps kfdc edit-free *by construction* rather than by discipline — there is
  nothing to be tempted by, because the edit surface is real korg sitting
  next to the board.
- **One-way control, v1.** kfdc sets `iframe.src`. No `postMessage`, no
  handshake, no state sync, in either direction (korg+ GP-17). A channel
  between the two would be the first step toward a second korg UI.
- **Every ref is a real `<a href>` first.** The pane is an enhancement *on* a
  link, never a substitute for one: ⌘/ctrl/shift/alt-click and middle-click
  are left to the browser, and "copy link address" works. `$lib/NodeRef` is
  the one component that draws a ref, and it hijacks only the plain
  left-click.
- **One rule builds every korg URL** — `$lib/korglink.nodeHref`, which is
  `${base}/n/${node_id}` and takes no `kind`. korg resolves the kind
  server-side. A consumer-side kind → path map is forbidden (korg+ GP-16),
  and the one kfdc used to keep was wrong in production: `/work-items?wi=N`
  was a URL korg never served, so every Net Log work-item link quietly landed
  on the unfiltered list. Because korg now has a page for every kind, no ref
  degrades to plain text any more — kfdc #993's don't-fake-URLs rule stands,
  it simply has nothing left to catch.
- **The wall has no pane.** It is a display mode, not a workstation. Refs
  there stay the plain links they always were — the wall withdraws the pane,
  not the address — and `Board.svelte` hands the wall a *disabled* pane so no
  panel needs a `wall` prop just to decide whether a ref is clickable. Same
  rule as On Deck's roll-up: no affordance it cannot honour.
- **The board sheds a column rather than overflowing one.** `.deck-main` is a
  CSS container and the board's column count keys off *its* width, not the
  viewport's — the reason a pane taking a third of the screen does not
  reproduce #1284. Measured with a headless browser (jsdom cannot see
  layout): 3840→1200, pane closed and open, zero overflow; reverted to the
  old viewport media queries the pane-open board keeps three columns and
  spills 12px at 1920/1600/1366.
- **The pane promises the ✕, not Escape.** Chromium hands focus to a
  cross-origin frame shortly after it loads, and that frame's keystrokes are
  korg's — the board's window sees none of them. `close (Esc)` shipped on the
  sprint-016 deploy and was measured false in production within the hour:
  `document.activeElement` became `IFRAME.pane-frame` and the window recorded
  **zero** keydowns from that moment. The Escape handler stays, because it works
  deterministically whenever the board holds focus, but it is **not advertised**
  — an affordance the board cannot honour must not be drawn, exactly as On Deck's
  roll-up renders a caret nobody can press as text instead.

  Measured, so a later sprint can argue with it rather than re-derive it:
  reclaiming focus on the frame's `load` is **too early** (focus is back in the
  frame within 1.2s and Escape is dead), while reclaiming at load+50ms holds,
  and so does load+250ms and load+1000ms. So a reliable Escape is available —
  at the price of a timing race whose failure mode is Escape silently dying,
  invisible to every gate `just check` runs. That price was judged too high for
  a control the ✕ already covers. `postMessage`, the only thing that could cross
  the boundary properly, is forbidden by GP-17.

- **korg must admit the origin, and only production is admitted.** korg
  serves `frame-ancestors` from `KORG_FRAME_ANCESTORS`, whose one entry is
  `https://kubsdb.encke-wahoo.ts.net:8100`. Verified live in both directions:
  from that origin the frame loads korg's real UI; from `127.0.0.1` it is
  refused with a CSP violation. **The consequence for local development is
  that the pane cannot render** — `npm run dev` serves 127.0.0.1, which the
  allowlist does not name. That is correct default-closed behaviour (GP-17:
  embedding is not authentication, and the allowlist is not an ACL), and the
  pane offers `open in korg ↗` regardless. kfdc does not try to detect the
  refusal: a cross-origin frame cannot be inspected, and guessing would mean
  claiming something the board does not know.

## Tokens

| Token | Value | Role |
|---|---|---|
| `--ground` | `#15170f` | page ground (olive-charcoal) |
| `--panel` / `--panel-2` | `#1c1f15` / `#22261a` | surfaces |
| `--line` / `--line-soft` | `#383d2a` / `#2a2e1f` | rules, borders |
| `--ink` | `#e9e3cc` | primary text (manila) |
| `--muted` / `--faint` | `#a29d85` / `#757060` | secondary / tertiary |
| `--amber` | `#e2a63d` | active / firing / attention |
| `--red` | `#e0603f` | blocked / risk / awaiting-Ken — an ask, never a resting state |
| `--green` | `#97ba6b` | done / clear / healthy |
| `--splash` | `#b6f26b` | fire mission at work-complete — watch for impact |
| `--cyan` | `#8fb5ba` | project chips / queued info / the `queued` program state |

Semantic colors (red/green/amber lights) are reserved for state; `--cyan`
identifies projects everywhere. Panel headers: mono, uppercase,
letter-spaced, underlined by `--line-soft`.

`--splash` (kfdc #990) is deliberately brighter than `--green`: the
done-token stays muted, but splash is the moment Ken should be watching —
rounds complete, verification is the next event. Contrast on `--ground` is
~13.7:1 (the badge sets ground-colored text on a splash field, same ratio).

The Ticker carries exactly **one** accent, `--green` on a proposal reaching
`done` — a sprint shipping. Measured before it was written that narrowly: the
obvious rule, accent anything terminal, painted 12 of 20 rows green because
`resolved→closed` is Ken's routine verification sweep. An accent that fires on
half the rows is the background, not an accent.

Rate of Fire's series colors are validated, not intuited (sprint 010): the
obvious pair, `--amber` for added vs `--green` for closed, **fails** CVD
separation on the panel surface (ΔE 4.7 protan; the floor is 6) and the
normal-vision floor (11.1 < 15). `--red`/`--green` passes every perceptual
check (deutan 9.3, tritan 25.8, normal 22.9, contrast ≥3:1) and carries the
board's own state semantics — added is incoming load, closed is ground
gained — so the pair is legal under "semantic colors are reserved for state".
Direction (added up, closed down of a shared baseline) is the structural
identity channel; durable is solid, churn/not-yet-durable is a faded
`color-mix` step of the same hue.

Its totals line carries a rule the panel exists to enforce (sprint 011):
**no two figures may imply a comparison they do not support.** Numbers
covering the whole window go bare; one covering less names its span
(`durable in 6 oldest 3d of 10`) in `--faint`, loud enough to stop the
misreading and quiet enough that the figure stays the signal. The
qualifier is derived, not configured, so it appears and disappears with
the data. The same rule kills a figure outright when the input for it is
missing: a wrong delta reads as measurement, an absent one reads as
absence, and only one of those is honest.

## The regimental crest

The masthead carries the **3d Cavalry Regiment Distinctive Unit Insignia** —
"the Bug", adopted 1922, Ken's regimental affiliation (kfdc #1183). A unit
crest belongs on the letterhead, and the masthead is this board's letterhead;
that is the placement where it reads as earned rather than applied.

- Asset: [`static/brave-rifles.png`](../static/brave-rifles.png), the 128px
  entry of the native 1.25:1 ladder in the pack at `/gratch/kIcons/kfdc-icons`
  (whose `README.md` is the authoritative record of provenance, palette and
  per-size guidance).
- Source: `File:3d Cavalry Regimental Insignia.png` on Wikimedia Commons.
  Author United States Army — **public domain** as a work of the U.S. federal
  government, confirmed via the Commons API rather than inferred. Nothing was
  redrawn or recoloured.
- Rendered in its own enamel green and gold rather than retinted to the board
  palette: it is heraldry, and it should look like itself. Seated at `0.88`
  opacity so it sits inside a night-ops palette instead of on top of it.
- Sized at **56px** against the pack's own measurements — above its 48px
  silhouette floor so the scrolls, bugle and 3 read; well below the ~96px
  where `BRAVE RIFLES` becomes legible, so the mark never pretends to be
  readable text. A favicon-sized slot wants a purpose-drawn glyph, not a
  downscale of this; the pack's README measures why.

> ⚠️ Public domain settles **copyright** only. U.S. Army insignia carry
> separate limits on *use* under AR 670-1 and 10 U.S.C. § 771. This is a
> personal, tailnet-only board displaying the wearer's own regimental
> affiliation, which those rules do not reach — but this repository is public,
> so the caveat is recorded rather than assumed away. It would matter for
> merchandise or anything implying Army endorsement.
