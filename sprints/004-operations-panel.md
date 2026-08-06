# Sprint 004 — Operations panel + board QOL

Proposal korg:1030 (kfdc, #1029 M + #990 S + #1027 XS). Goal: the last
missing concept panel — OPERATIONS renders `board.programs` — plus two small
render fixes, landed *before* program korg:1026 runs so Ken watches its five
slices tick on the board instead of reading the history afterward. Render
only; no korg changes.

## What shipped

- **#1027 — Deconfliction reads with time.** `X ⟵ AFTER Y` is gone. Chips
  render in execution order joined by a plain `→` (a `depends_on` card puts
  the prerequisite — the edge's *right* endpoint — first); collisions keep a
  symmetric `⟂ SAME CONTRACT ⟂`. `ConflictCard` now carries `chips` in
  render order instead of `left`/`right`, so the invariant is testable in
  `curator.ts` rather than buried in markup. Provenance line unchanged.
- **#990 — SPLASH.** An active mission at work-complete == total > 0 badges
  `splash` instead of `firing`, its amber accents shift to the new
  `--splash` token, and it sorts to the top of Fire Missions
  (`splashing()` / `fireMissionOrder()` in board.ts; sort is stable, korg's
  order stands otherwise).
- **#1029 — Operations panel.** `Operations.svelte` renders each live
  program: title, status pill, span chips, one-line truncated aim, then
  slice chips in korg's rank order joined by `→` per the #1027 decision.
  Each chip: state glyph (✓ ▶ ·), project, truncated title, and #980's
  three-part progress (`complete/total` + `n✓` when Ken-verified) —
  `progress()` generalized to take the four counts, not a fourth variant.
  `programs_omitted` footer matches On Deck's. Placed at the top of the
  middle column — the concept's Operations position — with On Deck below.
- **Net Log slice vocabulary.** The digest's `op` entries now carry slice
  statuses; a slice status change emits
  `OP: slice proposed→active korg 1021 - <title>` (kind
  `sprint_proposal`, so it deep-links like one).

## Decisions

- **Solid borders on program cards.** The concept's dashed `.op` meant
  "proposed node type" (grease-pencil = unbuilt). Programs are live data
  now; design.md's dashed-vs-solid rule outranks the mockup.
- **`--splash: #b6f26b`** — Ken's "bright green or blue" call landed on
  bright green: semantically adjacent to done-green but deliberately
  brighter (the done token stays muted). Contrast on `--ground` ≈ 13.7:1.
  Recorded in design.md's token table.
- **Digest extended additively, still v1.** `slices` is optional on `op`
  entries; the diff treats absence as "no information", so the first
  observation after this deploy emits nothing spurious instead of misreading
  the upgrade as every slice appearing. Slice *appearance* stays silent,
  matching the program rule (appearance alone is not traffic).
- **Types corrected against the live response.** `ProgramRow.summary` never
  existed — the field is `aim`; slices carry `rank` (string), not
  `position`, plus the four status counts (korg sprint 045's D-5). Verified
  against production `/api/board` before typing.

## Verification

`just check` green (harness, prettier/eslint, svelte-check, build, vitest —
40 tests, 8 new). Smoke-tested against production korg: both live programs
render (2 done + 5 proposed slice chips, arrows between), Deconfliction's
one live edge reads `kprojects 912 → claude-cleo 749` — prerequisite first.
SPLASH has no live instance today; unit tests pin the transition, the empty
guard, and the sort.

## Deployed 2026-08-06

`just deploy` on kai from merged main (`a24c51a`, PR #4 squash); rollback
target is the previous main (`c4257e9`, rebuild + restart). Verified live at
https://kai.encke-wahoo.ts.net:8100: both program cards render (2 done + 5
proposed slice chips, arrows between), Deconfliction reads
`kprojects 912 → claude-cleo 749`, and the Net Log's first post-deploy
observation logged `FM: complete kfdc 1030` — the board watched this
sprint's own proposal complete, with no spurious slice traffic from the
digest upgrade. No data migration in this sprint.

## Follow-ups

- korg #977 (transition log) remains the Net Log's principled enrichment;
  the slice vocabulary here is still viewer-state observation.
- If Operations pushes On Deck too far down at wall distance, the middle
  column's order (or a fourth column) is a one-line change in +page.svelte.
