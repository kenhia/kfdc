# Deploying kfdc

kfdc deploys from the homelab package store. `just publish` puts a versioned
bundle in it; a host installs *that artifact*, checksum-verified. No host
needs a checkout, npm, or a build.

This is the homelab-wide doctrine — k-homelab `docs/deploying.md` is the
authority, and kfdc was one of the last services still building in place.
The general shape (store on kubsdb `:4880`, `kpkg` to publish, `latest`
pointer, immutable versions, nightly mirror to the NAS) is documented there
and not repeated here. What follows is what is specific to kfdc.

## The two commands

```sh
just publish            # on the dev clone, from a clean tree
just deploy             # installs `latest` on the serving host
just deploy <version>   # ...or exactly that version. This is the rollback.
just versions           # what the store holds, what the serving host has and runs
```

All four run **from the clone**, on kai. Since sprint 009 that is not the
machine the board runs on: `KFDC_DEPLOY_HOST` names the serving host
(kubsdb), and when it is not this machine `just deploy` and `just versions`
reach it over ssh.

`KFDC_STORE_URL` (fetching), `KFDC_STORE_HOST` (publishing) and
`KFDC_DEPLOY_HOST` (serving) come from `.env`; see `.env.example`. None has
a default, deliberately — a guessed store hostname fails later as a
confusing curl error instead of here as a sentence, and a guessed *deploy*
host is worse than that: it installs the board somewhere nobody is looking
and reports success.

What crosses the ssh connection is a command, never a build. The serving
host fetches its own `install.sh` from the store and checksum-verifies it
before running it — the same bootstrap written out below, which is why
adding a host and redeploying one are the same procedure. Nothing is copied
out of this clone, because a clone-less serving host is the entire point.

## Shipping a sprint deploys it

You do not normally type those commands. `.sprint-deploy` at the repo root
names the `deploy-board` skill (`.claude/skills/deploy-board/SKILL.md`), and
`/sprint-ship` Phase 7 invokes it after the merge and local cleanup — so
what ships is published from merged `main`, and every store version's commit
is an ancestor of `origin/main`.

That declaration is the entire mechanism. Sprint 005 shipped and the deploy
was run by hand, because an **absent `.sprint-deploy` makes Phase 7 skip
silently** (korg #1035) — the phase existed and kfdc simply never declared
itself. A `just harness` invariant now asserts the file exists and that every
skill it names is present, so the declaration cannot rot into a silent skip
again.

The skill owns preflight, procedure, verification and rollback; Phase 7
delegates to it wholly. Deploy by hand — a rollback, or a host bootstrap — by
following the same skill.

## What gets published

```
artifacts/kfdc/<version>/kfdc-<version>.tar.gz   # VERSION + build/
artifacts/kfdc/<version>/kfdc.service
artifacts/kfdc/<version>/kfdc.env.example
artifacts/kfdc/<version>/install.sh
artifacts/kfdc/<version>/SHA256SUMS              # written by kpkg
```

The tarball is adapter-node's `build/` and nothing else. adapter-node
bundles its own dependencies, so `build/` is genuinely self-contained — only
`node:` builtins survive the bundle — which is why there is no
`node_modules` to ship and no `npm ci` on the target. It is about 460 KB
compressed.

The other three files are in the bundle so that a host with **no checkout**
can go from nothing to a running board: the unit file it needs, the config
template it must fill in, and the installer itself. The unit that shipped
with a build is recoverable *with* that build — the old build-in-place
deploy never guaranteed that, because the unit file lived only in
`~/.config/systemd/user` on kai and in no repo at all.

**Version** is `<package.json version>-<short commit>` (e.g.
`0.5.0-ed6c764`). The minor tracks the sprint. The commit half means a
published version always names a commit that can be checked out, and that
republishing needs no version-bump ceremony — the store refuses to overwrite
a version, and a new commit is a new version by construction.

Publishing **from a branch** works and does *not* move the `latest` pointer.
That is how a deploy path gets proven before it becomes what the fleet
resolves.

## What a host looks like after a deploy

```
~/.local/share/kfdc/versions/<version>/   # unpacked bundle: VERSION + build/
~/.local/share/kfdc/current -> versions/<version>
~/.config/kfdc/kfdc.env                   # host config, never shipped
~/.local/state/kfdc/                      # Net Log store, never touched
~/.config/systemd/user/kfdc.service
```

The unit's `WorkingDirectory` is the `current` symlink, so a deploy is a
symlink repoint plus a restart, and a rollback is the same move backwards.
The last 3 versions stay unpacked (`--keep N`); older ones are pruned,
because the store is the real history.

`~/.config/kfdc/kfdc.env` is host state and survives every deploy. On first
install the installer seeds it from the bundled template and **stops** —
`PORT` and `ORIGIN` are placement and must be looked at, not inherited from
whatever host the template was written on. `PORT` must match the
`tailscale_serve` entry declared for that host in k-homelab
`manifests/<host>.yml`.

The unit pins `HOST=127.0.0.1` where the env file cannot override it.
adapter-node's default is `0.0.0.0`, and a wildcard bind fights tailscaled
for the port and crash-loops with `EADDRINUSE` — the homelab's oldest serve
gotcha, not a hypothetical.

## What the installer proves before it is finished

In order, and it stops at the first failure:

1. Every file matches `SHA256SUMS` — fetched and verified *before* anything
   is installed, so a bad unit file cannot leave a new build already in
   place.
2. The tarball's `VERSION` stamp equals the version it was published under.
   The checksum proves the transfer; this proves the *label*. A bundle
   published under the wrong version would install cleanly and then lie
   about what the host is running.
3. `PORT` and `ORIGIN` are set in the config.
4. `http://127.0.0.1:$PORT/api/board` answers within 20s.
5. The **running process** is that version. A healthy answer is not proof
   the restart took — the old process serves just as well. Because the unit's
   working directory is the symlink, `/proc/<mainpid>/cwd` resolves to the
   versioned directory the process is actually executing out of, which is
   the one thing that cannot be stale.

## Bootstrapping a host with no checkout

install.sh is checksum-verified before it runs, which `curl | sh` cannot
offer:

```sh
base="$KFDC_STORE_URL/artifacts/kfdc"
v=$(curl -fsS "$base/latest")
curl -fsS -O "$base/$v/install.sh"
curl -fsS "$base/$v/SHA256SUMS" | grep ' install.sh$' | sha256sum -c -
sh install.sh --from-store --version "$v"
```

Then fill in the config it seeds and re-run. `just deploy` runs exactly this
on a remote serving host, so a bootstrap is not a special mode — it is the
ordinary deploy, typed by hand because there is no `.env` naming the host
yet.

This was the whole of the Phase-3 move to kubsdb on the kfdc side, done in
sprint 009: same artifact fetched there, a new `tailscale_serve` entry
declared for that host, and kai's unit and `:8100` retired. The Net Log
store (`~/.local/state/kfdc`) was copied across first — viewer history had
to survive the move, and the proof is pre-move lines still rendering in the
strip afterward. Copy it **before first start**: the observer diffs against
`last-digest.json`, so a host that starts without one records its first
poll as a wall of spurious transitions.

## Where things run, after sprint 009

| | |
|---|---|
| clone, build, `just publish` | kai — needs the toolchain and a commit |
| the board | **kubsdb**, `https://kubsdb.encke-wahoo.ts.net:8100` |
| the package store | kubsdb `:4880` |
| the curator | kai, from the clone |

kai serves nothing. It holds the checkout and runs the curator, and that is
the whole of its role.

## What still runs from the clone on kai

The curator. `bin/update-fdc`, `kfdc-curator.timer` and `just curator` need
the repo (`curator/prompt.md`) and a `claude` binary, and read the clone's
own `.env`. That is deliberate and stayed on kai when the board moved —
kubsdb has no agent tooling and is not getting any. The curator talks to
korg over the network and does not care where the board runs.

Its unit carries an explicit `Environment=PATH=%h/.local/bin:...` and must
keep it. A systemd **user** unit does not inherit a login shell's PATH, and
the manager's default omits `~/.local/bin`, where `claude` lives — so
without it the timer dies at `exec claude` with status 127 while
`bin/update-fdc` and `just curator` both keep working, because those inherit
an interactive PATH (korg #1040). That asymmetry is why it went unseen for a
sprint: only kmon noticed. The unit is installed by `just curator-install`,
by hand, on kai — a board deploy does not touch it.

There is no "install from this checkout" mode. Building in place and
restarting is exactly the habit the store exists to end.
