# 027 — bootstrap.sh grows an update-the-unit mode

Proposal korg:5110, slice 6 of program korg:5112 ("Low-hanging fruit,
2026-11-27"), run as karc leg `kfdc-c18453` on kai. No work item on purpose:
this is item 9 of Ken's catch-up list korg:4767.

## The goal

knarr never writes unit files (its D12) and `bootstrap.sh` refuses a second
run, so a changed `kfdc.service` had no sanctioned route onto a host that was
already set up. Sprint 026 hit it as comment-only drift and installed the unit
by hand. Ken ruled (korg:4767 comment 5219, "Setup script update mode"): the
setup script owns it, knarr keeps D12.

## Decisions

- **An explicit `--update-unit`, not a relaxed guard.** A plain re-run still
  refuses exactly as before (the refusal now also names the flag). The flag
  refuses a host with no installed unit, because updating a unit on a host
  that was never bootstrapped would be a bootstrap that skipped seeding and
  validating the config.
- **The unit and nothing else.** In this mode only `kfdc.service` is fetched —
  not the env template, so the mode cannot be what touches config — and
  `enable` is not re-run. Verified against the version's `SHA256SUMS` before
  anything is written; a unified diff is printed; then install and
  `daemon-reload`. A match is a no-op that says so and calls no `systemctl`.
- **No restart by default**, said in the output; `--restart` for when it must
  apply now, followed by an `is-active` check. `--dry-run` shows the diff and
  changes nothing.
- **`just update-unit [version]`** runs it on the serving host from kai, and
  `deploy-board` runs it on every deploy (and every rollback) before
  `just deploy` — no-op-safe, so nobody has to decide whether the unit changed.
  Unit for V before deploy of V, so knarr's restart is the one that applies it.
- **The script comes from `latest`; only the unit comes from the named
  version.** The first cut of the recipe fetched the *target* version's
  `bootstrap.sh`. Running it against `0.5.0-10f9a24` showed the flaw: a
  pre-027 version's script has no update mode, so every rollback across 027
  would have been unable to install its own unit. Found by running it.
- **The pattern is written once**, in `docs/deploying.md` § Updating the unit,
  as seven properties another knarr-deployed repo (kyac) can copy. Not ported
  anywhere in this slice; kyac's WI 3089 is not this sprint's.
- **Tests without a dependency.** `deploy/test-bootstrap.sh` (in `just check`,
  and `test -x` in the harness) runs the script against a `file://` store, a
  fake `HOME` and a fake `systemctl` that logs its arguments: 13 assertions
  covering install, diff, no-restart, env untouched, second-run no-op,
  `--restart`, dry run, checksum mismatch, unbootstrapped host, the plain
  re-run refusal, and `--restart` alone. Negative-tested: planting "always
  restart" failed 2 assertions, planting "ignore checksum mismatch" failed 1.
- **The unit's own header now says how it is updated**, which is also a real
  (comment-only) unit change for this sprint's deploy to carry through the new
  route.

## Proven before ship (kubsdb, probed from kai)

- The branch's script piped over ssh stdin (nothing written on kubsdb),
  `--update-unit` against `latest` = `0.5.0-a56e7c0`: `already matches …
  nothing to do`, twice. That is the tool confirming 026's hand copy (md5
  `42da9e92…`). Env md5 `ed202cff…` and kfdc `MainPID=2216` unchanged.
- `--update-unit --dry-run --version 0.5.0-10f9a24`: printed the diff back to
  the pre-026 "Loopback, always" unit and `would:` lines, wrote nothing.
- `just update-unit` transport and checksum path: reached kubsdb, verified
  `latest`'s `bootstrap.sh`, which (pre-027) rejects the flag — expected until
  this ships.

## Repaired in passing

None. (`--help` used a hard-coded `sed -n '2,45p'`; it now prints up to
`set -eu`, but that was forced by this sprint growing the header, not a
pre-existing defect.)

## Deployed

2026-11-27 ~12:10 PST, by `deploy-board` from merged `main` (PR #36,
`58f331c`), as karc leg `kfdc-c18453` on its ship turn, from kai.

- Published `0.5.0-58f331c` (`latest` moved). Rollback target
  `0.5.0-a56e7c0`, still unpacked on kubsdb.
- **`just update-unit 0.5.0-58f331c`, first run:** fetched and verified
  latest's `bootstrap.sh` on kubsdb, `kfdc.service checksum OK`, printed the
  one-hunk diff (this sprint's header comment), installed, `daemon-reload`ed,
  and said `NOT restarted`. `MainPID` stayed 2216; installed unit md5 became
  `b9307cda…` = `systemd/kfdc.service`; env md5 `ed202cff…` unchanged.
- **`just deploy 0.5.0-58f331c` (knarr), status document asserted clean:**
  sha256 `317700d2…abb99`, **1865ms** total: stage 386, backup 192,
  install 209, restart 224, ready 264, confirm 194 (`0.5.0-58f331c`),
  cleanup pruned `0.5.0-392da3a`. That restart is the one that applied the
  new unit; nothing else restarted.
- **`just update-unit 0.5.0-58f331c`, second run:** `already matches … nothing
  to do`. `NeedDaemonReload=no`, PID 431089 active.
- Live, probed from kubsdb for the binds and from kai for the tailnet:
  `127.0.0.1:8100` 200, `192.168.1.60:8100` 200 (`ss -ltn` shows both plus
  tailscaled's own), `https://kubsdb.encke-wahoo.ts.net:8100/` 200 and
  renders "Fire Missions". `just versions`: store latest, top of `here:`,
  and `running:` all `0.5.0-58f331c`.
- Follow-on PR #37 (`a8561c3`) fixed one stale line in `deploy-board`'s
  not-do list. It is skill-only and not in the bundle, so there was nothing to
  redeploy.
