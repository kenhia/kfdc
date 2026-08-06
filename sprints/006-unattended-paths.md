# Sprint 006 — unattended paths

Proposal korg:1041 (kfdc, #1040 XS + #1035 S). Both are follow-ons from
sprint 005's slice of the fleet-wide "Deploy from the store" program
(korg:1026), and they are the same bug wearing different clothes: **kfdc's
interactive paths work and its unattended paths don't** — and in both cases
nothing noticed, because a human was always driving.

- The curator runs fine as `bin/update-fdc` or `just curator`. Only the timer
  failed. kmon caught it, not a person.
- The deploy runs fine when a session types `just publish && just deploy`.
  Only the ship path skipped it — **silently**, which is worse than failing.

No app code changed. The acceptance test for the sprint is that kfdc's two
automated paths now run with nobody watching.

## What shipped

- **`systemd/kfdc-curator.service` gains `Environment=PATH=`** (#1040). One
  line, plus a comment explaining the asymmetry so it is not "cleaned up"
  later.
- **`.claude/skills/deploy-board/SKILL.md`** (#1035) — the repo-local deploy
  skill: preflight, publish, install, verify, rollback. Mostly a transcription
  of what the sprint-005 session did by hand, now written down.
- **`.sprint-deploy`** naming it, so `/sprint-ship` Phase 7 fires.
- **A `just harness` invariant** asserting `.sprint-deploy` exists and that
  every skill it names has a `SKILL.md`.
- **`docs/deploying.md`** gains the two things it never said: who invokes the
  deploy, and why the curator unit carries an explicit PATH.

## #1040 — the curator timer

`claude` is at `/home/ken/.local/bin/claude`; `bin/update-fdc` line 16 is a
bare `exec claude -p`; the unit set no PATH. A systemd **user** unit does not
inherit a login shell's PATH, and the manager's default omits
`~/.local/bin` — so the timer died at status 127 while both hand-run paths
kept working, because those inherit an interactive PATH. That asymmetry is
the whole reason it survived a sprint unseen.

Fixed on the unit rather than the script: `exec claude` is correct for the two
callers that already work, and the unit is the impoverished environment. The
fleet precedent for the alternative — absolute `ExecStart` — is `kmon.service`
on kai; either shape is consistent with the host, and a third would not be.

**This was never a host-placement question.** The curator is on kai exactly as
k-homelab #988 specified. Nothing about #1038 argues for installing `claude`
on kubsdb, and doing so would add a recurring manual reauthorization on a host
that is rarely connected to interactively, to solve a problem that does not
live there.

## #1035 — the deploy declaration

`sprint-ship` Phase 7 already existed and already did this. kfdc simply
declared nothing, and an absent `.sprint-deploy` makes the phase skip in
silence — which is how sprint 005 came to be deployed by hand. Every other
store-deploying repo on the fleet (korg, klams, kaed, kwebi, and kdeskdash as
of 2026-08-06) already had one. This was kfdc being the odd one out, not a
design gap.

The global `sprint-ship` skill was not touched — it is owned by the private
`agent-skills` repo and installed by its `install.sh`.

## Decisions

- **The skill is `deploy-board`, not `deploy-kai`.** The host-named
  convention (korg → `deploy-kubsdb`, klams → `deploy-kubs0`) fits services
  pinned to a host. kfdc's host is explicitly interim: Phase 3 moves the board
  to kubsdb, and the point of sprint 005's shape is that the move touches no
  file here. A host name in the skill name would have made that false for no
  benefit. `deploy-board` names what is deployed, which does not change.
- **`Environment=PATH=` is ordered *before* `EnvironmentFile=` — the opposite
  of `kfdc.service`, deliberately.** systemd applies both in file order, last
  writer winning. In `kfdc.service`, `EnvironmentFile=` comes first *so the
  unit's `HOST=127.0.0.1` pin cannot be overridden* (sprint 005). Here the
  intent is inverted: PATH is a sane default a host should be able to
  override in `.env`, not a pin. Same mechanism, opposite orderings, because
  the two lines want opposite things. Do not "fix" one to match the other.
- **The skill's version probe hard-fails where the installer's soft-passes.**
  `install.sh` ends with *"could not read the service's cwd — health check
  passed, version unproven"* and **exits 0**. That is a reasonable installer
  default and a bad deploy report. The skill asserts the same fact and treats
  an unexpected non-answer as a failure. This is kdeskdash's hard-won lesson —
  *a version probe is only diagnostic if the thing that cannot answer fails* —
  and kfdc's case is easier (one target, reachable, and it answers), which is
  exactly when a soft edge goes unnoticed.
- **Verify over the tailnet, and grep for a panel heading.** Loopback does not
  exercise `tailscale_serve`, and a 200 proves the adapter answered, not that
  SSR rendered a board rather than an error shell. Both curls are bounded with
  `--max-time` so an unreachable serve fails in 15s instead of hanging a
  report.
- **The invariant guards the declaration, not just the file.** `test -f
  .sprint-deploy` alone would pass on a file naming a skill that does not
  exist — which is the same silent-skip failure with an extra step. The check
  walks the file and requires each named skill's `SKILL.md`.

## Proof

**#1040**, on kai, with the corrected unit installed via `just
curator-install`:

```
systemctl --user start kfdc-curator.service
  ->  Main PID 2088678 (code=exited, status=0/SUCCESS)
```

Previously `status=127/n/a` with `exec: claude: not found`. The pass ran a
real curation and reported `no changes` — the idempotence contract in
`curator/prompt.md` holding, which is what makes a verification run safe.

**#1035**, the invariant tested in both directions:

```
just harness                          ->  harness invariants OK
mv .claude/skills/deploy-board ...    ->  harness: .sprint-deploy names
                                          'deploy-board' but ... is missing
                                          (exit 1)
```

The probes the skill prescribes were run against the live board before being
written into it: `https://kai.encke-wahoo.ts.net:8100/` answers 200 and
contains `Fire Missions`, and `/proc/743309/cwd` resolves to
`0.5.0-31d2033`, matching `just versions`.

**The real proof of #1035 is this sprint's own ship.** `.sprint-deploy` is on
the branch by Context Discovery and on `main` by Phase 7, so the phase fires
on the sprint that adds it. The sprint self-tests.

One noted hazard did not materialize: a project skill created mid-session is
generally not registered until the session restarts, which would make Phase 7
report the skill as not found. This session registered `deploy-board`
immediately. If a future session does hit it, the cause is registration, not a
malformed `.sprint-deploy` — read `.claude/skills/<name>/SKILL.md` and follow
it directly, which is functionally identical. Do not "fix" a correct
declaration in response to that symptom.

## Follow-ups

- **k-homelab #1010** (`Fold in: kfdc-curator systemd user timer on kai`)
  must carry the **corrected** unit. `~/.config/systemd/user` now holds it
  (verified identical to `main` post-deploy), so the fold-in can read it from
  either. Outside this repo; not widened into this sprint.
- **homelab-health #1038** (the kmon finding) can close once the unit has run
  green on its own timer — the next scheduled fire, not this manual start.
- **Phase 3 stays out of scope.** Both fixes are built for where kfdc lives
  now. When the board moves to kubsdb, the only line in `deploy-board` that
  changes is the verify URL; the curator does not move at all.

## Deployed 2026-08-06

PR [#6](https://github.com/kenhia/kfdc/pull/6) squash-merged as `5b93648`,
then — for the first time — **sprint-ship Phase 7 fired on its own**, invoking
the `deploy-board` skill this sprint added. Sprint 005 reached this point and
the phase skipped in silence; that is the whole delta.

```
just publish              ->  0.5.0-5b93648 (456K), latest -> 0.5.0-5b93648
just deploy 0.5.0-5b93648 ->  pid 2340520 running 0.5.0-5b93648
```

- **Artifact:** `artifacts/kfdc/0.5.0-5b93648/`. `5b93648` is an ancestor of
  `origin/main` — the Phase-7-after-merge ordering holding.
- **Rollback target:** `just deploy 0.5.0-31d2033` (sprint 005's version, the
  previous `main` build, still in the store and still unpacked on kai). This is
  the first sprint with a real previous-`main` rollback target; 005 had none.
  `0.5.0-ed6c764` was pruned from disk by `--keep 3` and remains in the store.
- **Verified live**, by the skill's own assertions rather than the installer's:
  `/proc/2340520/cwd` → `0.5.0-5b93648`; the board answers 200 over
  `https://kai.encke-wahoo.ts.net:8100` and its server-rendered HTML contains
  `Fire Missions`; `just versions` agrees across store `latest:`, disk and
  process.

Because the sprint changed no app code, the smoke test is the sprint's own
subject matter rather than the board's behaviour:

- The installed `~/.config/systemd/user/kfdc-curator.service` is byte-identical
  to merged `main` and carries `Environment=PATH=` at line 17. Last run
  `success 0`.
- `.sprint-deploy` on `main` resolves to `deploy-board`, the skill is present,
  and `just harness` passes — the invariant guarding exactly that.

One caveat, deliberately not papered over: the timer's `LAST` still shows the
failed 10:33 fire from before the fix. The unit is green, but it has not yet
run green **on its own schedule** — next fire Fri 2026-08-07 10:33 UTC. That,
not this deploy, is what closes homelab-health #1038.
