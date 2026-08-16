# 010 — Rate of Fire: the backlog trend, on the board

korg proposal **1321** (slice 2 of program korg:1322), covering **#1319** —
one S item. The board says what's firing and what's blocked but cannot say
whether we're gaining or losing ground; this sprint adds the ninth panel
that answers it: daily added / closed / backlog over korg's flow window,
with same-day churn and durable flow rendered distinctly.

## The dependency, and its state at sprint start

At sprint start korg #1318 (`GET /api/work-items/flow?days=N`) was
**resolved on korg branch `059-backlog-flow` but not yet merged/deployed**,
and #1318's closing comment is explicit that #1319 unblocks *on deploy, not
on merge*. The sprint therefore built against the contract as documented in
that comment (the authoritative shape, quoted below), tested against
fixtures, and gave the panel an honest no-feed state. **Mid-sprint the
dependency cleared**: production korg on kubsdb:5674 answered
`/api/work-items/flow` with 200 during the render-and-look pass, so the
panel was verified against live production data before this sprint ever
shipped. The no-feed state stays — it is the board's resilience to a korg
rollback, not scaffolding.

```
{ days: [{ day, added, closed, backlog, added_durable, closed_durable }],  // oldest first, ends today
  horizon: "2026-08-08", timezone: "America/Los_Angeles",
  durable_after_days: 7, generated: <rfc3339> }
```

## Decisions

- **Series length comes from the response, never a constant.** korg defaults
  to 6 days now and widens to 10 after 2026-08-18; bar layout, axis and the
  window figure all derive from `days.length`. The regression guard is a
  10-day test fixture.
- **Mirror (bidirectional) bar chart**: added grows up from a shared
  baseline, closed grows down. Direction carries series identity
  structurally, so color is reinforcement rather than the only channel.
  Backlog is a separate thin strip with its own scale — two measures of
  different scale get two plots, never a dual axis.
- **Durable solid, churn faded — and the added split rendered knowingly.**
  #1318's structural property: `added_durable` is zero for the newest
  `durable_after_days` days (an arrival's durability is only knowable in
  retrospect). The derivation marks each day `addedKnown` by age against
  `durable_after_days` from the response; young days render the whole added
  bar in the faded treatment (honestly "not yet durable") instead of
  claiming "all churn" as measured fact. At the 6-day launch window that is
  every day; after the widening the oldest days start splitting for real.
  `closed_durable` has no lag and is the drawdown signal from day one.
- **Colors validated, not eyeballed** (dataviz six-checks, dark surface
  `#1c1f15`): amber/green — the intuitive board pair — **fails** CVD
  separation at ΔE 4.7 (protan; floor is 6, target 8) and the normal-vision
  floor (11.1 < 15). Red/green passes everything perceptual (CVD 9.3
  deutan, tritan 25.8, normal 22.9, contrast ≥3:1). Board semantics
  agree: added is incoming load (red = against us), closed is work retired
  (green = done/clear) — a series that *means* good/bad wears status
  tokens. The lightness-band deviation (~0.74 L vs the 0.48–0.67 dark
  band) is shared by every token on this board — the bright-manila-on-dark
  identity is docs/design.md's deliberate commitment and outranks.
  Faded (churn) fills are `color-mix` steps of the same hue toward the
  panel — an ordinal 2-step, identity within a bar carried by
  lightness + the 2px surface gap.
- **The panel must not take the board down.** `fetchFlow` returns `null` on
  any failure (the production state until korg deploys); the panel names
  the absence — *no flow feed* — per the design rule that an empty panel
  never results from quiet omission. The board render itself never throws
  on a missing flow feed.
- **Placement: third column, under Sensor Net.** The item left masthead-
  adjacent as an option, but the durable/churn split is the substance of
  the panel and needs panel-scale room to read; a masthead mini-chart also
  survives the 10-day widening worse. Panel name "Rate of Fire" kept from
  the proposal — Ken's to rename.

## Shipped

- `src/lib/flow.ts` — flow-series types (contract: korg #1318's closing
  comment / korg docs/api.md) and the pure `rateOfFire` derivation: per-day
  bars with the age-gated added-durability split, one shared mirror scale,
  padded backlog strip scale, window totals (`addedDurableKnown` is `null`
  while the whole window sits inside the lag). 8 derivation tests in the
  `server` vitest project, including the 10-day widening fixture and a
  non-7 `durable_after_days` fixture.
- `src/lib/panels/RateOfFire.svelte` — the ninth panel: inline-SVG mirror
  chart (added up / closed down, durable solid on the baseline, churn faded
  on the outer end, 2px surface gaps), backlog sparkline with surface-ringed
  end dot and endpoint label, one shared max tick, full-slot hover tooltips,
  stats row (in / out / durable out / durable in when knowable / backlog ±Δ),
  legend, and a visually-hidden table twin. Drawn at native pixel scale so
  the 10-day widening renders wider, not zoomier. 4 component tests
  (`.svelte.test.ts` → client project) pin the no-feed state and the
  launch-window "no durable claim on added".
- `fetchFlow` in `src/lib/server/korg.ts` (null on any failure — one panel
  must never take down the board) fetched in parallel with the board in
  `+page.server.ts`; panel seated in column 3 under Sensor Net.
- Verified rendered: fixture route screenshots (launch, widened, no-feed)
  plus the live board against production korg — real series, backlog 167,
  +18 over the 6-day window.

## Follow-ups

- After 2026-08-18 the widening to 10 days is korg's constant change
  (#1318); this panel picks it up with no edit — the 10-day fixture is the
  guard.
- Panel name "Rate of Fire" and the column-3 placement are Ken's to
  revisit; the masthead-adjacent option was declined because the
  durable/churn split is the panel's substance and needs panel-scale room.
