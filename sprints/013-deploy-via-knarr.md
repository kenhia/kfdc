# 013 — Deploy via knarr, and stop ignoring SIGTERM

Proposal korg:1452, slice 3 of program korg:1453 (*kfdc deploys through
knarr*). Two work items: **#1200** (kfdc ignores SIGTERM) and **#1450**
(deploy through knarr, retire `install.sh` + the ssh bootstrap).

The ordering was decided before the branch existed and it mattered: #1200
first, because it is independently verifiable against the deploy path that
exists *today*. Debugging a shutdown bug through a brand-new deploy path is
the wrong order.

## #1200 — the service never exited, and `SHUTDOWN_TIMEOUT` is a red herring

The pre-sprint guess (recorded on the item) was that the Net Log observer's
3-minute poll in `src/hooks.server.ts` — a bare `setInterval` — kept the
event loop alive. That was right, and it is the only timer in the entire
app. But the mechanism is worth stating properly, because the obvious
next question ("doesn't adapter-node's `SHUTDOWN_TIMEOUT` bound this?")
has a counter-intuitive answer.

adapter-node 5.5.7's `graceful_shutdown` closes the HTTP server, emits
`sveltekit:shutdown`, and **never calls `process.exit`**. It relies
entirely on the event loop draining. `SHUTDOWN_TIMEOUT` (default 30s) only
arms a `closeAllConnections()` timer; it does not force an exit. So one
referenced `setInterval` means the loop never empties and the process never
leaves — regardless of what that value is set to. systemd then waits out
`TimeoutStopSec` (90s) and SIGKILLs, and the unit lands `failed` after a
clean, deliberate stop.

The fix is two lines:

```ts
poller.unref();
process.once('sveltekit:shutdown', () => { clearInterval(poller); … });
```

`unref()` is what lets the process exit. The *listening socket* is what
holds it up while it is actually serving, so the poll still ticks on
schedule — unref'ing a timer does not stop it, it only stops it counting as
a reason to stay alive. The `sveltekit:shutdown` clear covers the other
end: a tick landing inside the drain window would open a fresh korg fetch,
and that socket **is** referenced.

### Measured, not asserted

Reproduced before fixing, on the built server with a real `/api/board`
fetch first (so undici's connection pool was in play, not just the timer):

| | before | after |
|---|---|---|
| plain process, SIGTERM → exit | still alive at 20s (never exits) | **0.10s** |
| transient user unit, `systemctl --user stop` | 90s → SIGKILL | **0.01s** |
| unit state after a clean stop | `failed` | `inactive`, `Result=success` |

The systemd half was proven with a throwaway `systemd-run --user` unit on
kai rather than by poking production on kubsdb — same `TimeoutStopUSec`
(1min 30s), no blast radius.

`src/hooks.server.test.ts` holds the three invariants (poller does not hold
the loop open, poller is cleared on `sveltekit:shutdown`, `POLL_INTERVAL_MS`
is exported). All three were watched failing before the fix went in.

### The 1454 contract, discharged

Sprint 013 and korg:1454 (#1204, wall mode) were flagged as colliding on
this file. That was resolved before the branch as a contract rather than a
merge: the poll cadence stays one knowable constant in
`src/hooks.server.ts`, and if the fix turned out not to move it, say so and
move on. It didn't move. `POLL_INTERVAL_MS` is now **exported** rather than
a module-local literal, which is more than the contract asked — #1204's
dependency becomes an import instead of "go read the file and copy the
number". Closing note left on korg:1454.

## The pause — there was no `knarr` to call

Work on #1450 stopped at the first line of the new `just deploy` recipe.
knarr existed only as a scratch build at
`kai:~/src/tools/knarr/.scratch/knarr` — not on PATH, not in `~/go/bin`, not
in the package store, and knarr's own roadmap had no item for distributing
itself. kfdc was the first consumer to walk into it.

The cheap fix — a `just install` in kfdc dropping a `go build` output on
PATH — was rejected: it is throwaway work inside the one tool whose purpose
is making hand-rolled installers unnecessary, and it would have made knarr
the single deploy on the fleet that does not go through knarr. So it was
lifted into its own knarr sprint (**korg:1458**, inserted as slice 2). That
shipped — knarr publishes itself to the store and installs by `knarr deploy
knarr` — and this slice resumed unchanged.

## #1450 — the deploy is one knarr call

`just deploy` went from a 25-line ssh heredoc plus a 250-line `install.sh`
to one `exec knarr`. knarr's directory-shape defaults already match kfdc's
layout, so the recipe names only what is genuinely kfdc's: the unit, the
user scope, `--expect-file build/index.js`, and a readiness probe.

**The store read moved, and it is the change most worth knowing.** knarr
fetches and verifies the bundle _here_, on kai, before touching the serving
host, then uploads the verified bytes. Previously the serving host fetched
its own copy. So the serving host no longer needs to reach the store for a
deploy at all — only for the once-ever bootstrap — and knarr's D4 exit-code
split becomes literally true rather than merely intended: exit 2 means the
host was never touched.

### `install.sh` shrank; it did not disappear

knarr D12 (decided on korg #1449) says knarr never seeds config, never
installs a unit, never runs `daemon-reload` or `enable` — but it _does_
prune its own `versions/` tree. What is left is `deploy/bootstrap.sh`: seed
`~/.config/kfdc/kfdc.env`, validate `PORT`/`ORIGIN`, install the unit,
reload, enable. 250 lines to ~110, and the ~110 are all once-ever host
state.

It **refuses to run** once the unit and config are both in place, printing
the knarr call instead. A once-ever script that still works on the hundredth
run quietly becomes the install route, and then the fleet has one service
that does not deploy through the fleet tool. knarr's own `deploy/seed.sh`
holds the same line for the same reason.

### Where the port lives

knarr never reads a service's configuration to work out how to probe it, so
the `--ready-cmd` has to carry the port. The clone does not know it and
should not: `PORT` is host state in `~/.config/kfdc/kfdc.env`, which is the
whole reason sprint 009's host move touched no application code. So the
probe sources that file **on the target**:

```sh
--ready-cmd '. ~/.config/kfdc/kfdc.env; curl -fs -o /dev/null "http://127.0.0.1:$PORT/api/board"'
```

knarr stays ignorant — it runs an opaque string — and a clone that had
hard-coded `8100` would have gone on probing the old port after a host move
and called it healthy.

### `deploy-board` stopped re-probing

The skill hand-rolled four ssh assertions because `install.sh`'s exit code
did not carry enough — notably its version check printed _"could not read
the service's cwd — health check passed, version unproven"_ and still exited
**0**. knarr fails that step instead, so the skill now reads the status
document: `.ok`, `.resolved_version`, no step that is not `ok`, and
specifically that the **`confirm` step** is `ok`. `ok: true` alone is not
version proof and the skill says so.

The `jq` was negative-tested before it was trusted: it refuses a dry run
(`confirm` is `skipped`) and refuses a version mismatch.

The 90-second "do not read the pause as a hang" warning is gone — inverted,
in fact. 90 seconds is now news.

## Deployed

**Proving deploy, from the branch, 2026-08-19.** Published `0.5.0-294cdf5`
from `013-deploy-via-knarr` — a branch publish does not move the `latest`
pointer, which is exactly how a deploy path gets proven before the fleet
resolves it. `latest` stayed at `0.5.0-acb917d` throughout.

|                | first deploy | second deploy |
| -------------- | ------------ | ------------- |
| wall clock     | **91.96s**   | **1.91s**     |
| `restart` step | 90,286ms     | **220ms**     |
| everything else| ~1.2s        | ~1.2s         |

**Both numbers are correct, and the first one is not a failure.**
`systemctl restart` stops the old process before starting the new one, so
the deploy that _carries_ a shutdown fix still pays the previous version's
stall — the process being stopped was `0.5.0-acb917d`, which predates the
fix. The second deploy stopped a fixed process and took 1.91s. The restart
time belongs to the version being stopped, not the one being installed; that
trap is now written into `deploy-board`, because 92 seconds on the deploy
that ships the fix reads exactly like a regression.

Verified live, all from kai:

- status document asserts clean — `ok: true`, `resolved_version
0.5.0-294cdf5`, no step not `ok`, `confirm` **`ok`** with detail
  `0.5.0-294cdf5`
- sha256 `b885a545…cac79de`, 512,741 bytes
- `https://kubsdb.encke-wahoo.ts.net:8100/` → HTTP 200 over the tailnet, and
  the SSR marker (`fire missions`) present — a 200 proves the adapter
  answered, the marker proves it rendered the board
- three views agree: store has it, host has it unpacked, `running:
0.5.0-294cdf5`
- unit `ActiveState=active`, `Result=success`, `NRestarts=0`
- `cleanup` pruned `0.5.0-7351ecf`, keeping 3 unpacked — the rollback slot
  still holds `0.5.0-acb917d`

Rollback target throughout: `0.5.0-acb917d`, still unpacked on the host, so a
rollback is a symlink repoint.

`/sprint-ship` Phase 7 will republish and redeploy from merged `main`, which
is what keeps every store version's commit an ancestor of `origin/main`.
