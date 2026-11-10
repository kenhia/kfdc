# 026 — also bind the LAN address

Proposal korg:4436, a slice of program korg:4368 ("Backlog drawdown,
November 2026"), run as a karc leg (`kfdc-f026db`) on kai. No work item on
purpose: Ken's decision and what done looks like are in the proposal's
`notes`.

## The goal

kfdc bound `127.0.0.1:8100` only. `tailscale serve` fronts that for the
ts.net URL, so the board worked, but kwebi's container on kubsdb (network
`kubsdb-net`, not host networking) cannot reach the host's loopback. Its
kFDC tile read **Down** while the board served. Ken chose (2026-11-09, in
the drawdown session) to have kfdc **also** bind `192.168.1.60:8100`,
rather than giving kwebi host networking or showing the tile as "not
checked". That is the loopback-plus-LAN pattern kubsdb's docker services
already use (mongodb: `127.0.0.1:27017 and 192.168.1.60:27017 only`).

**This reverses the unit's recorded "Loopback, always."** That comment was
right about what it guarded against: a wildcard bind takes
`<ts-ip>:8100` from tailscaled and crash-loops on `EADDRINUSE`. It was
wrong only in making loopback the *whole* rule. The comment in
`systemd/kfdc.service` now says loopback is the primary bind and never a
wildcard, names this sprint and korg:4436, and asks the next reader not to
"restore" loopback-only without reading this record.

## Decisions

- **Two named addresses, never `0.0.0.0`.** The tailnet address stays
  served only by `tailscale serve`, so its backend (`http://127.0.0.1:8100`
  in k-homelab's manifest) is unchanged.
- **The LAN address is placement, so it lives in `kfdc.env` as
  `LAN_HOST`**, not in the unit. The unit names no host, by rule since
  sprint 005; HOST stays pinned to loopback in the unit where the env file
  cannot override it.
- **How to get a second bind out of adapter-node.** It takes one `HOST`,
  and its systemd socket activation explicitly refuses `LISTEN_FDS > 1`, so
  socket units with two `ListenStream=` lines are out. The two remaining
  shapes were a wrapper entry (`node serve.js` importing `build/index.js`
  and feeding a second listener into its `http.Server`), or a forwarder
  started from inside the app. The wrapper changes `ExecStart`, which knarr
  never installs (D12) and `bootstrap.sh` refuses to re-run to install, and
  which breaks every rollback to a version without `serve.js`. So it is the
  forwarder: `src/lib/server/lanbind.ts` opens a `net.Server` on
  `LAN_HOST:PORT` and pipes each connection to `HOST:PORT`, started from the
  `init` hook beside the Net Log poller. `ExecStart` is untouched, knarr's
  `--expect-file build/index.js` still holds, and a version from before 026
  simply ignores `LAN_HOST`. The cost is a loopback hop per LAN connection,
  and that the app sees LAN clients as `127.0.0.1` — nothing in kfdc reads
  client addresses.
- **A bad value stops the service; a missing address does not.** A
  wildcard, a hostname or a list in `LAN_HOST` throws at `init`, which
  fails the deploy's `ready` step where it is seen. An address that is not
  up yet (`EADDRNOTAVAIL` at boot, kubsdb's bond0 lease is DHCP) logs and
  retries every 10s while the board serves on loopback and ts.net.
- **It closes with the server.** The listening socket is referenced, so it
  closes on `sveltekit:shutdown` — otherwise SIGTERM would leave the process
  up until systemd's 90s SIGKILL, the kfdc #1200 shape. The retry timer is
  `unref()`'d for the same reason.

## What shipped

- `src/lib/server/lanbind.ts` + tests: address validation (wildcards,
  hostnames, lists, the already-bound address all refused) and the
  forwarder (answers on the extra address, stops when closed, retries a
  failed bind instead of throwing).
- `src/hooks.server.ts`: `init` starts it when `LAN_HOST` and `PORT` are
  set, and closes it on shutdown; two tests in `hooks.server.test.ts`.
  Negative-tested: replacing the pipe with `client.end()`, dropping the
  shutdown `close()`, and disabling the wildcard check each turned the
  suite red.
- `systemd/kfdc.service` comment, `deploy/kfdc.env.example` (`#LAN_HOST=`),
  `docs/deploying.md`, `CLAUDE.md`.

## k-homelab

kubsdb's manifest declares port 8100 already (its `tailscale_serve`
entry), so kmon's `ports_from_manifest` — keyed on the port — does not see
an undeclared listener. But its `services:` block records *which addresses*
a LAN-published port listens on (mongodb's entry is the model), and the
change belongs there. kubs0:~/k-homelab was held by another leg
(korg:4426, lock `k-homelab-8d730c`) when this sprint reached it, so per
the proposal the exact entry goes in the wrap-up handoff for the overseer to
relay rather than being landed here.

## Repaired in passing

- `systemd/kfdc.service`'s header and `deploy/kfdc.env.example` still said
  the unit/config were installed or checked by `deploy/install.sh`, gone
  since sprint 013; they now name `deploy/bootstrap.sh`. Gate: `just check`
  (prettier) plus a grep showing the remaining `install.sh` mentions are
  historical.

## Deployed

2026-11-09 19:03 PST (03:03Z), by `deploy-board` from merged `main` (PR #33,
`a56e7c0`), as karc leg `kfdc-f026db` on its ship turn.

- Published `0.5.0-a56e7c0`; `just deploy` (knarr) to kubsdb, status
  document asserted clean: sha256 `b643219d…2bcc86`, **1918ms** total —
  stage 405, backup 196, install 217, restart 229, ready 280, confirm 200
  (`0.5.0-a56e7c0`), cleanup pruned `0.5.0-6de4d6d`. Rollback target
  `0.5.0-10f9a24`. Only `kfdc.service` restarted.
- `LAN_HOST=192.168.1.60` was appended to kubsdb's `~/.config/kfdc/kfdc.env`
  on the working turn (inert until this version).
- **The unit by hand, this once:** knarr never writes units and
  `bootstrap.sh` refuses to re-run, so `kfdc.service` was fetched from the
  store's `0.5.0-a56e7c0` on kubsdb, checked against its `SHA256SUMS`,
  copied to `~/.config/systemd/user/` and `daemon-reload`ed (no restart).
  md5 `42da9e92…` equals `systemd/kfdc.service`. That there is no
  supported route for this went to Ken as a design question via the
  overseer (korg:4436 comment).
- Live: `ss -ltn` on kubsdb shows `127.0.0.1:8100` and `192.168.1.60:8100`
  owned by the one kfdc PID, beside tailscaled's own tailnet binds; the
  journal says `kfdc: also listening on 192.168.1.60:8100`.
- From inside the kwebi container: `fetch('http://192.168.1.60:8100/')` →
  200, board rendered ("Fire Missions").
- From kai, kwebi `scripts/post-deploy-check.sh` (fresh baseline, then
  compare): **PASS, zero failures**, the `:8100` tile "up, and kubsdb
  agrees (200)".
- From kai, `https://kubsdb.encke-wahoo.ts.net:8100/` → 200 and renders
  the board. `just versions`: store latest = running = `0.5.0-a56e7c0`.
