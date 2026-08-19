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
