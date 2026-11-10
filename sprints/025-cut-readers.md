# 025 — korg's readers learn `cut`

Proposal korg:4415, a slice of program korg:4368 ("Backlog drawdown,
November 2026"), run as a karc leg (`kfdc-85f13d`) on kai. No work item on
purpose: the proposal's `notes` named four small changes, one per repo.

## The goal

korg sprint 098 (#4366) added `cut`, a second terminal work-item status:
closed's twin, meaning Ken decided not to do it. Nothing broke, but four
readers miscounted it. kfdc's progress bars, koverwatch's "N/M items
resolved" line, kfo's soak-skip rule and kmuster's refile rule all treated a
cut item as unfinished or as fair game to re-judge or re-file. This sprint
aligns all four.

## Premise check

**Holds, all four.** The live `/api/board` already carries `cut` on every
proposal row and every program slice, and `progress()` read neither. korg's
own `docs/usage.md` states the split the brief asked for: work-complete is
`resolved + done + closed + cut` and verified is `closed + cut`, because both
are Ken-only statuses. koverwatch's `KorgSlice` had no `cut` field. kfo's
`soak.md:31` named only `done`/`closed`. kmuster's `suppresses_refile()`
named `open`/`resolved`/`parked`.

kmuster needed one extra check: its dedup can only suppress a cut item if the
list it reads returns cut rows. korg's MCP `list_work_items` hides `closed`
and `cut` by default. kmuster reads REST `/api/work-items` with no status
filter instead, and that returned the korg project's one cut item live. So
widening the predicate is enough.

## What shipped

- **kfdc** (this branch): `cut` on `ProposalRow` and `ProgramSlice`, and in
  `progress()` on both sides. Every count on the board goes through
  `progress()`, so Fire Missions' track, On Deck and the Operations slice and
  program counts (#3322) all move together. The field is required rather
  than `?? 0`, because the type states korg's contract and korg emits it. Two
  new tests: a cut row counts toward complete and verified, and a cut slice
  item is finished in the program sum. Twelve fixture factories got `cut: 0`.
  Negative-tested: dropping `cut` from `verified` fails both new tests.
- **koverwatch** `7f39ce7` on main: `KorgSlice.cut`, counted on the finished
  side of "N/M items resolved". The new test failed before the fix.
- **kfo** `322f72c` on main: `soak.md` and `docs/soak-scan.md` both skip a
  `cut` soak WI as terminal.
- **kmuster** `b4d0c0c` on main: `cut` suppresses re-filing. This is an
  overseer ruling and Ken can reverse it. `closed` and `done` keep today's
  behaviour. The new test failed before the fix.

## Findings, and the overseer's ruling

The pre-ship handoff (korg:4420) raised two findings as decisions. The
overseer ruled that both are defects and should be repaired here, on each
repo's own main.

- **koverwatch's 17:52 stop.** The user journal records only `Consumed 2.761s
  CPU` at 17:52:46. There is no `Stopping` job and no failure result, so the
  node process exited cleanly on its own. adapter-node exits 0 on
  SIGTERM/SIGINT, and `Restart=on-failure` does not restart a clean exit. The
  journal does not say who sent the signal. **Repaired** in koverwatch
  `3fa6194`: the unit source in `deploy/` is now `Restart=always` with the
  existing `RestartSec=5`, installed by `just deploy` (verify 5/5). Proof: a
  direct `kill -TERM` of the main PID (3152017) brought it back as 3152181 on
  a scheduled restart 5 s later, and `/` answered 200. The exit itself again
  left no journal line of its own, which matches the 17:52 signature.
- **`kmuster-projectcheck` ignored its arguments.** It ran the real weekly
  pass (`--fix --file`) when asked for `--help`, and that run executed live
  (clean: 0 findings, no korg writes). **Repaired** in kmuster `0c89a45`.
  With no arguments it still runs the pass, which is what the unit's
  `ExecStart` passes. `--version` still answers for knarr's confirm step.
  `--help`/`-h` print usage and exit 0, and anything else prints usage and
  exits 2 before the binary is invoked. `tests/projectcheck_runner.rs` pins
  all four with a fake `KMUSTER_BIN` that records every call; the two new
  guards failed before the fix. Published as `0.3.0-0c89a45` and deployed to
  kai and kubs0. The live `--help` and `--bogus` calls left the state file's
  mtime untouched.

## Deployed

2026-11-09, by `deploy-board` from merged main (`10f9a24`, PR #32) through
sprint-ship Phase 7, on the karc ship turn.

- Published `0.5.0-10f9a24`, and the store's `latest` moved to it. The
  rollback target is `0.5.0-392da3a`, which is still unpacked on kubsdb.
- knarr to kubsdb, total 1942 ms. Every step was ok: stage 390, backup 203,
  install 212, restart 242, ready 280 (first attempt), confirm 205 with detail
  `0.5.0-10f9a24`, and cleanup pruned `0.5.0-d6d5268`. The bundle sha256 is
  `3da6f5d4…bf99f`. The status document passed the skill's `all(.hosts[])`
  assertion.
- From kai over the tailnet, `https://kubsdb.encke-wahoo.ts.net:8100/` answered
  200 and rendered Fire Missions. Operations printed program korg:4368 as
  `19/20` and korg:3689 as `37/40`. I recomputed both from korg's live
  `/api/board` with `cut` included, and they match. No live row carried a
  `cut` item at deploy time, so the new term contributed zero on live data.
  Its behaviour is proven by the unit tests, not by a live specimen.
- `just versions`: the store's latest, the top unpacked version and the
  running version are all `0.5.0-10f9a24`.
