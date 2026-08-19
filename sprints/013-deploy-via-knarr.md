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

## #1450 — paused: there was no `knarr` to call

Work stopped at the first line of the new `just deploy` recipe. knarr
existed only as a scratch build at `kai:~/src/tools/knarr/.scratch/knarr`
— not on PATH, not in `~/go/bin`, not in the package store, and knarr's own
roadmap had no item for distributing itself. kfdc was the first consumer to
walk into it.

The cheap fix — a `just install` in kfdc dropping a `go build` output on
PATH — was rejected: it is throwaway work inside the one tool whose purpose
is making hand-rolled installers unnecessary, and it would have made knarr
the single deploy on the fleet that does not go through knarr. So it was
lifted into its own knarr sprint (**korg:1458**, inserted as slice 2), and
this slice waits. Slice 3 resumes unchanged the moment `knarr` resolves on
PATH on kai.

<!-- Resume checklist lives on korg:1452's pause comment; steps 1-5 there. -->
