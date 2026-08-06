# Sprint 005 — deploy from the store

Proposal korg:1024 (kfdc, #1014 M), slice 4 of the fleet-wide "Deploy from
the store" program korg:1026. Goal: kfdc stops building in place. `just
publish` puts a versioned bundle in the homelab package store; `just deploy`
installs *that artifact*, checksum-verified. No app code changed — this
sprint is entirely about how the board gets onto a host.

The premise, stated in #1014: `just deploy` was `npm run build && systemctl
restart`. No artifact existed, so **there was nothing to roll back to**, and
the unit file that ran the board lived only in `~/.config/systemd/user` on
kai and in no repo at all. Rolling back meant checking out an older commit
and hoping the build reproduced.

## What shipped

- **`just publish`** — builds, then publishes
  `artifacts/kfdc/<version>/` to the store on kubsdb via `kpkg`: the
  tarball (`VERSION` + `build/`), `kfdc.service`, `kfdc.env.example`,
  `install.sh`. Refuses a dirty tree; publishes from a branch *without*
  moving `latest`.
- **`deploy/install.sh`** — the only install mode is `--from-store`. Fetches,
  verifies every file against `SHA256SUMS` before installing anything,
  unpacks to `~/.local/share/kfdc/versions/<version>/`, repoints the
  `current` symlink by `rename(2)`, installs the unit if it changed,
  restarts, and then proves the result (below). `--keep N` prunes to the
  last 3.
- **`just deploy [version]`** — install `latest`, or exactly that version.
  Naming an older version *is* the rollback; there is no second verb.
  **`just versions`** shows store / unpacked / running side by side.
- **`systemd/kfdc.service` exists in the repo now**, rewritten to run out of
  `~/.local/share/kfdc/current` with config at `~/.config/kfdc/kfdc.env`.
- **`docs/deploying.md`** — the kfdc-specific half; k-homelab
  `docs/deploying.md` stays the doctrine.
- **k-homelab: `tailscale_serve :8100` declared for kai**
  ([PR #35](https://github.com/kenhia/k-homelab/pull/35)) — the ride-along
  in #1014. `bin/audit kai` goes `tailscale-serve: ADVISORY` → `ok` with no
  `bin/apply`: the entry was already live, it just existed nowhere but
  tailscaled's state, so a rebuild of kai would have lost the board's URL.

## Decisions

- **The bundle is `build/` and nothing else — plus the things a bare host
  needs to exist.** adapter-node bundles its own dependencies; the built
  output has only `node:` builtins left, so there is no `node_modules` to
  ship and no `npm ci` on the target (460 KB compressed). The unit file,
  config template and installer ride along so a host with no checkout can
  bootstrap, and so the unit that shipped with build X is recoverable *with*
  build X. That is kaed sprint 005's D2, and it applies here for the same
  reason.
- **Version is `<package.json version>-<short commit>`** (`0.5.0-ed6c764`).
  The minor tracks the sprint. Deriving it partly from the commit means a
  published version always names a checkout-able commit *and* that
  republishing needs no version-bump ceremony — the store refuses to
  overwrite, and a new commit is a new version by construction. package.json
  went `0.0.1` → `0.5.0` in the same move; `0.0.1` was scaffold residue.
- **The service is clone-independent, but the placement is not in the repo.**
  The unit names no host and no checkout: `WorkingDirectory` is the
  `current` symlink, and `PORT`/`ORIGIN` come from `~/.config/kfdc/kfdc.env`.
  That file is host state and survives every deploy. This is what makes the
  Phase-3 move to kubsdb a placement change touching no file here — which is
  exactly the line korg:1024's comment drew ("deploy shape here, placement
  later").
- **`HOST=127.0.0.1` is pinned in the unit where the env file cannot
  override it.** adapter-node defaults to `0.0.0.0`; a wildcard bind fights
  tailscaled for the port and crash-loops with `EADDRINUSE`. Leaving it out
  is not neutral. `EnvironmentFile=` is ordered *before* the `Environment=`
  lines so the unit's pins win.
- **First install seeds the config and stops.** The template carries kai's
  values, which are wrong for any other host. A deploy that silently came up
  on `:3000` with a kai `ORIGIN` would look like it worked.
- **No "install from this checkout" mode**, not even as a fallback.
  Build-in-place is the habit the store exists to end, and a fallback is how
  it comes back.
- **A health check is not proof of a deploy.** The old process answers
  `/api/board` just as well as the new one. Because the unit's working
  directory is the `current` symlink, `/proc/<mainpid>/cwd` resolves to the
  versioned directory the process is *executing out of* — so the installer
  can assert the running version, not just a 200, without any change to the
  app. It also checks the tarball's `VERSION` stamp against the version it
  fetched: the checksum proves the transfer, that proves the label.

## Proof

Both directions, live on kai, on this branch (both published `--no-latest`,
which is what publishing from a branch is for):

```
just deploy 0.5.0-aa8f4fa   ->  pid 692293 running 0.5.0-aa8f4fa
just deploy 0.5.0-ed6c764   ->  pid 694142 running 0.5.0-ed6c764   # rollback
just deploy 0.5.0-aa8f4fa   ->  pid 695737 running 0.5.0-aa8f4fa   # forward
```

`https://kai.encke-wahoo.ts.net:8100` answered 200 throughout, the Net Log
store at `~/.local/state/kfdc` was untouched across all of it (it lives
outside the install tree by #992's design, and that decision paid here), and
the first install correctly refused to start until `~/.config/kfdc/kfdc.env`
existed. On kubs0, `bin/audit kai` reported `tailscale-serve: ok`.

The gate here is that sequence, not a unit test: none of this is reachable
from vitest, and a mocked store would prove nothing about kpkg, tailscaled
or systemd. `just check` gained two harness invariants (`deploy/install.sh`
executable, `systemd/kfdc.service` present) so the pieces cannot silently
go missing.

## Follow-ups

- **No `deploy-remote`.** Installing on another host means ssh-ing there and
  running the store bootstrap from `docs/deploying.md`. Deliberate: the
  Phase-3 kubsdb move is the first real need for it, and it should be
  written against that host rather than guessed at now.
- **The bundle shape is the template kwebi copies** (korg #1017), once its
  own #837 single-copy-source rescue clears. kwebi is the other node app on
  the fleet and it deploys by rsync-and-build-there today.
- **kfdc's own placement move to kubsdb** stays a Phase-3 roadmap item and is
  now unblocked: same artifact, fetched there, new `tailscale_serve` entry,
  retire kai's unit and `:8100` (k-homelab #988's comment carries the
  fold-then-retire plan). The Net Log store has to be copied across with it.
- The curator still runs from the clone on kai and always will — it needs
  `curator/prompt.md` and a `claude` binary. It stays on kai when the board
  moves.

## Deployed 2026-08-06

PR [#5](https://github.com/kenhia/kfdc/pull/5) squash-merged as `31d2033`,
then the first real use of the thing this sprint built:

```
just publish   # from main, clean tree  ->  0.5.0-31d2033, latest -> 0.5.0-31d2033
just deploy    # no argument, resolves latest
```

- **Artifact:** `artifacts/kfdc/0.5.0-31d2033/` (464 KB tarball). This is the
  first version published from `main`, so it is the first one `latest` has
  ever pointed at — the two branch versions were `--no-latest` by design, and
  their commits no longer exist after the squash.
- **Rollback target:** `just deploy 0.5.0-aa8f4fa` (the pre-merge branch
  build, still in the store and still unpacked on kai). The real rollback
  target from here on is the previous `main` version; there isn't one yet
  because this is the first.
- **Verified live**, beyond the installer's own health check: kai is running
  `0.5.0-31d2033` (pid 743309, asserted against `/proc/<pid>/cwd`, not just a
  200); `31d2033` is an ancestor of `origin/main`; the board renders over
  `https://kai.encke-wahoo.ts.net:8100` with all seven panels present; and
  `just versions` agrees across store, disk and process.

The satisfying part: the board is now rendering *its own* slice as complete.
`kfdc deploys from published bundles ✓ 1/1` sits in the Operations panel as
program korg:1026's fourth chip — the panel sprint 004 landed early
specifically so this program could be watched ticking rather than read about
afterwards.
