# Sprint 007 — On Deck roll-up, and what a program's order entitles it to

Proposal korg:1077 (kfdc, #1064 S + #1070 S + #1102 XS) — slice 2 of program korg:1078
"Sequencing on the board". Slice 1 (korg:1076) shipped as korg sprint 053 and
is live on kubsdb, so its contract was available before a line was written
here — which was the whole point of filing these as a program rather than two
queue rows.

Both WIs are one observation arriving at two panels: **a program is already a
declared sequence, so rendering that sequence a second time adds rows without
adding information.** #1064 saw it as nine On Deck rows; #1070 saw it as
Deconfliction cards duplicating Operations. Render only — no korg changes, and
none needed.

## What shipped

- **#1064 — On Deck program roll-up.** `onDeckRows(queue, programs)` in
  `board.ts` collapses a program's queue rows into one row naming the program:
  span chips, title, and `n of m slices` remaining. Expanding (`▸`/`▾`)
  restores the individual slices, indented and muted. The roll-up lands
  exactly where korg put its first collapsed slice and wears that slice's
  rank — no rank string is parsed and no order is invented, so the panel
  cannot disagree with korg's `pinned`-then-`rank` ordering.
- **#1070 — Deconfliction sets program-sequenced dependencies aside.**
  `deconfliction()` now returns `{cards, sequenced}`; a `depends_on` card whose
  pair korg reports with a non-null `blocked[].sequenced_by` moves to
  `sequenced` and the panel prints one faint line — `1 sequenced by <program>
  — drawn in Operations` — instead of the card. `ConflictCard` carries
  `sequencedBy`.
- **`BlockedRow` typed on `Board`** — korg #978's `blocked[]`, verified field
  by field against the live `/api/board` before typing (the sprint 004 rule
  after `ProgramRow.summary` turned out never to have existed).
- **#1102 — kfdc has a client test project.** Filed and taken mid-sprint, once
  the roll-up's disclosure turned out to be the board's first client state.
  `vite.config.ts` gains a second vitest project (`client`, jsdom,
  `@testing-library/svelte`) beside `server`, and the throwaway verification
  harness became `src/lib/panels/OnDeck.svelte.test.ts` — four tests: default
  collapsed, expand-then-collapse, two roll-ups expanding independently, and
  no disclosure at all when nothing collapses.

## Decisions

- **Roll up at two queue rows, not one.** A program contributing a single
  queue row is not row inflation, and collapsing it trades a slice title that
  says what happens next for a program title that does not. `ROLLUP_MIN` is
  named and commented so the threshold is arguable rather than buried.
- **`remaining` counts the whole program, not the collapsed rows.** A slice
  that is `active` is showing in Fire Missions rather than On Deck, and a
  counter that said "1 of 9" while eight remained would be the kind of figure
  D-3 exists to prevent. Finished means `done` or `declined` — korg's terminal
  set for a proposal; `closed` is a work-item status with no proposal spelling.
- **Sequenced cards are set aside, not suppressed.** Dropping them silently
  would let "no collisions on the board — fires deconflicted" do the hiding,
  and this is the one panel whose promise is that nothing quietly disappears
  from it. The aside names the program when exactly one is responsible.
- **Suppression is keyed `dependent:blocker` and only from `via: "proposal"`
  entries.** That is a `depends_on` edge's own `left:right`, so a reversed
  match cannot hide the wrong card; a `covered` entry hangs off a work item
  inside the row and has no proposal edge to match. A collision is never set
  aside — it is unordered, so no program order can express it.
- **Deconfliction keeps `proposal_edges` as its substrate.** korg's api.md is
  explicit that `blocked` is not a superset and does not replace it: that list
  is every edge between two live rows, this one is the "cannot start yet"
  subset widened to non-proposal blockers. #1070 asked for a filter, and
  `sequenced_by` is exactly that. Rendering `blocked` in its own right is a
  follow-up, not this sprint.
- **The two vitest projects partition on one pattern.** `server` already
  excluded `*.svelte.{test,spec}.{js,ts}`; `client` includes exactly that, so
  no file runs twice and none falls between them. Verified by name in
  `--reporter=verbose` output rather than assumed — a project matching zero
  files reports green, which is the failure #1102 was written to avoid.

## Verification

`just check` green (harness, prettier/eslint, svelte-check, build, vitest —
56 tests across two projects, 16 new: 52 `server`, 4 `client`).

Neither new path has a live instance today: program korg:1078's two slices are
`done` and `active`, so it contributes no queue rows, and the board's one
`blocked` entry has `sequenced_by: null`. Both were therefore smoke-tested by
serving a **doctored copy of the production board** to the dev server — a
synthetic five-slice program (three real queue rows plus a `done` and a
`declined` slice) and the live `749 → 912` dependency relabelled as
program-sequenced:

- roll-up rendered at rank 5 with `korg kfdc` span chips and `3 of 5 slices`,
  and the three collapsed rows left the flat list (12 rows → 10);
- Deconfliction printed `1 sequenced by SMOKE: … — drawn in Operations` and
  drew no card.

Re-rendered against the **undoctored** production board: byte-identical
behaviour to before the sprint — no roll-up, and `kprojects 912 → claude-cleo
749` still draws with its curator prose and provenance.

The expand/collapse interaction — kfdc's first stateful component — is covered
by the new `client` project, and the coverage was checked for vacuity rather
than trusted: breaking `toggle()` so it only ever adds (never collapses) turns
the expand-then-collapse test red, and reverting it green again.

## Follow-ups

- **Deconfliction could render `blocked` in its own right.** Today it draws
  only curated edges between two live rows, so it cannot show a `via:
  "covered"` blocker (one task inside a sprint waiting on something outside)
  or a blocker that is not a proposal at all. korg #978 already computes both,
  deterministically. That is a real panel expansion, not a filter.
- **The ticker is now unblocked.** `board.events` (korg #977) is live and
  typed nowhere in kfdc — the roadmap's one remaining Phase 3 render bullet.
