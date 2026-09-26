# 024 — Operations: a program's finished/total work-item count

Proposal korg:3325, one leg of program korg:3314 ("Low-hanging fruit, run 4"),
run as a karc leg (`kfdc-edefae`) on kai under an Opus overseer.

Covers kfdc **#3322**: *Operations - Programs should show total count of WI's
in program* (XS, task).

## The goal

Every slice chip in Operations already prints its own `complete/total`, but the
program row had no total of its own. Ken asked for the slice counts added up and
shown as `3/8` in the spot he marked on the WI's screenshot (img-cfc): directly
right of the program's status chip.

## Premise check

**Holds.** `progress()` in `board.ts` already derives each slice's #980 parts
from korg's per-status counts: complete = resolved+done+closed, verified =
closed, total = covered_count. That is exactly the definition the overseer's
notes fixed. Parked items are in `covered_count` and in no numerator term, so
they count in the total only, with no extra code.

**GP-13 does not apply, and I checked rather than assumed.** A sum is only
exact if the slice list is complete. korg's board query
(`korg-core/src/repo/board.rs`) fetches every slice id a live program
`includes`, whatever the slice's status or archived flag. Nothing caps it, so
the sum is a figure the consumer *can* compute rather than one korg must return.

## What shipped

- `programProgress(slices)` in `src/lib/board.ts` sums `progress()` over the
  slices. It does not define "finished" a second time.
- `Operations.svelte` prints `{complete}/{total}` as `span.op-cnt` right after
  the status chip. Ken-verified shows the way the slice counts show it (`1✓`).
  The `title` spells out the parts: `4 finished of 9 work items`, plus
  `, n verified by Ken` when there are any.
- `app.css`: `.op .op-cnt` shares the `.slice .s-cnt` rule, so the panel has one
  count style.
- Tests: three for `programProgress` (the sum, parked in the total only, and
  0/0) and two component tests (position after the chip, text, tooltip, and the
  verified part). Negative-tested: dropping `by Ken` from the tooltip fails the
  component test, and summing `complete` into `total` fails two unit tests.

Looked at, not just tested: a dev server against production korg rendered this
very program (korg:3314) as `4/9`, 9px right of `ACTIVE` on the same line. That
agrees with `get_program`'s slices: 3+1+1+1+1+1+1 covered, 4 finished
(`.scratch/024-shot.mjs`, `.scratch/024-op.png`).

## Repaired in passing

- **Slice counts ran their verified part into the total.** Svelte drops the
  whitespace that opens an `{#if}`, so a slice with a closed item rendered
  `1/11✓`, which reads as "one of eleven". I confirmed it from the rendered
  HTML (`1/1<span class="ver">1✓</span>`) and fixed it with a `margin-left` on
  `.ver`, which the new program count shares. The gate proves the markup
  structure. The gap itself is CSS, which jsdom cannot see; no program on the
  live board had a closed item to look at.

## Deployed

2026-09-26 03:07 UTC (2026-09-25 20:07 PDT), through `deploy-board` from merged
`main` (`392da3a`, PR #31):

- `just publish` published **`0.5.0-392da3a`** (store `latest` moved).
- `just deploy 0.5.0-392da3a` (knarr) to **kubsdb**: rc 0, sha256
  `1197644d…a7513f69`, **1918ms** total. stage 399, backup 197, install 217,
  restart 236, ready 270 (1 attempt), `confirm` 202ms with detail
  `0.5.0-392da3a`, cleanup pruned `0.5.0-f2b1b19`. The status-document
  assertion (every host, every step ok, `confirm` == version) passed.
- Tailnet from kai: `https://kubsdb.encke-wahoo.ts.net:8100/` returned 200, and
  `Fire Missions` rendered.
- **The sprint's own behaviour, live:** program korg:3314 renders
  `<span class="op-cnt" title="5 finished of 9 work items">5/9`, right after
  its status chip on the same line (`.scratch/024-shot.mjs` against the
  deployed board). It read `4/9` before this slice resolved.
- `just versions`: store `latest`, `here:` top and `running:` are all
  `0.5.0-392da3a`.
- Rollback target: `0.5.0-6de4d6d` (still unpacked on kubsdb).
