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

## Findings for the overseer

- **koverwatch's 17:52 stop.** The user journal records only `Consumed 2.761s
  CPU` at 17:52:46. There is no `Stopping` job and no failure result, so the
  node process exited cleanly on its own. adapter-node exits 0 on
  SIGTERM/SIGINT, and the unit is `Restart=on-failure`, which does not restart
  a clean exit. That is consistent with an external signal sent straight to
  the PID, not a crash. The journal does not say who sent it. Whether to make
  the unit `Restart=always` is a policy call, so it is not changed here.
- **`kmuster-projectcheck` takes no arguments.** It ignores `--help` and runs
  the real weekly pass (`--fix --file`). Running it to read usage after the
  deploy executed it live. It was clean: 0 findings and no korg writes.
