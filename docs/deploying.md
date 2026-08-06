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
just deploy             # on the serving host — installs `latest`
just deploy <version>   # ...or exactly that version. This is the rollback.
just versions           # what the store holds, what this host has, what it runs
```

`KFDC_STORE_URL` (fetching) and `KFDC_STORE_HOST` (publishing) come from
`.env`; see `.env.example`. Neither has a default, deliberately — a guessed
hostname fails later as a confusing curl error instead of here as a
sentence.

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

Then fill in the config it seeds and re-run. This is the whole of the
Phase-3 move to kubsdb on the kfdc side: same artifact, fetched there, a new
`tailscale_serve` entry declared for that host, and kai's unit and `:8100`
retired. The Net Log store (`~/.local/state/kfdc`) has to be copied across
with it — viewer history must survive the move.

## What still runs from the clone on kai

The curator. `bin/update-fdc`, `kfdc-curator.timer` and `just curator` need
the repo (`curator/prompt.md`) and a `claude` binary, and read the clone's
own `.env`. That is deliberate and stays on kai when the board moves —
kubsdb needs no agent tooling.

There is no "install from this checkout" mode. Building in place and
restarting is exactly the habit the store exists to end.
