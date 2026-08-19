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

`just deploy` is a **knarr** call (sprint 013). knarr is the homelab fleet
deploy runner: it does the resolve → fetch → verify → install → restart →
confirm sequence once, for every store-native tool, instead of each repo
re-deriving it in its own shell. kfdc used to be one of those shells;
`deploy/install.sh` was 250 lines of it.

Note where the store read happens now, because it moved: **knarr fetches and
verifies the bundle locally, on kai, before it touches the serving host at
all.** Only then does it upload the verified bytes. Previously the serving
host fetched its own copy. Two consequences worth knowing:

- The serving host **no longer needs to reach the store** for a deploy. It
  needs it only for the once-ever bootstrap below, which pulls the unit file
  and the config template.
- knarr's exit-code split gets sharper. A store failure is exit `2` and
  means the host was never touched — now literally true, not merely
  intended.

Nothing is copied out of this clone. What crosses the connection is a
verified store artifact, never a build, because a clone-less serving host is
the entire point.

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
artifacts/kfdc/<version>/bootstrap.sh
artifacts/kfdc/<version>/SHA256SUMS              # written by kpkg
```

The tarball is adapter-node's `build/` and nothing else. adapter-node
bundles its own dependencies, so `build/` is genuinely self-contained — only
`node:` builtins survive the bundle — which is why there is no
`node_modules` to ship and no `npm ci` on the target. It is about 460 KB
compressed.

The other three files are in the bundle so that a host with **no checkout**
can go from nothing to a running board: the unit file it needs, the config
template it must fill in, and the bootstrap script that places both. The
unit that shipped with a build is recoverable *with* that build — the old
build-in-place deploy never guaranteed that, because the unit file lived
only in `~/.config/systemd/user` on kai and in no repo at all.

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

`~/.config/kfdc/kfdc.env` is host state and survives every deploy — knarr
never writes config, by rule. `deploy/bootstrap.sh` seeds it from the
bundled template and **stops**: `PORT` and `ORIGIN` are placement and must
be looked at, not inherited from whatever host the template was written on.
`PORT` must match the `tailscale_serve` entry declared for that host in
k-homelab `manifests/<host>.yml`.

The unit pins `HOST=127.0.0.1` where the env file cannot override it.
adapter-node's default is `0.0.0.0`, and a wildcard bind fights tailscaled
for the port and crash-loops with `EADDRINUSE` — the homelab's oldest serve
gotcha, not a hypothetical.

## What a deploy proves before it is finished

knarr stops at the first failure and reports each step in its status
document — `steps[{name, status, detail, ms}]`, one JSON object on stdout,
human progress on stderr. `deploy-board` reads that document rather than
re-probing over ssh.

| step | what it proves |
|---|---|
| *(local)* | the artifact matches `SHA256SUMS`. The host is not touched until this passes — a store failure is exit `2`. |
| *(local)* | the tarball's `VERSION` stamp equals the version it was published under. The checksum proves the **transfer**; this proves the **label**, which a checksum cannot see. Also local, so a mislabelled publish never becomes a half-finished deploy. |
| `stage` | the verified bytes reached the target. |
| `backup` | which version the rollback would return to. |
| `install` | unpacked into `versions/<v>`, `current` repointed by `rename(2)`. |
| `restart` | the user unit restarted. |
| `ready` | `http://127.0.0.1:$PORT/api/board` answers (default 20s). |
| `confirm` | the **running process** is that version. |
| `cleanup` | old versions pruned past `--keep 3`, best-effort, never fails a deploy. |

`ready` and `confirm` are separate steps on purpose, and the distinction is
the important one: a healthy HTTP answer proves *a* kfdc is running, and the
old process serves those just as happily. `confirm` reads `MainPID` and
resolves `/proc/<pid>/cwd` — and because the unit's `WorkingDirectory` **is**
the `current` symlink, that resolves to the versioned directory the process
is actually executing out of, which is the one thing that cannot be stale.

That assertion got stricter in the swap. `install.sh` printed *"could not
read the service's cwd — health check passed, version unproven"* and still
exited **0**, which is why `deploy-board` used to re-run it by hand. knarr
fails the step instead.

`PORT` and `ORIGIN` are no longer checked at deploy time. knarr does not
read a service's configuration — `deploy/bootstrap.sh` validates them once,
when it seeds the file.

## Bootstrapping a host with no checkout

**A bootstrap is now a different thing from a deploy, and that is the point.**
Until sprint 013 they were the same script, so a bootstrap was "the ordinary
deploy, typed by hand". Since knarr owns deploys and will never write a unit
file or seed config (knarr D12), what is left is once-ever host state:
`~/.config/kfdc/kfdc.env` and `~/.config/systemd/user/kfdc.service`.

`bootstrap.sh` is checksum-verified before it runs, which `curl | sh` cannot
offer:

```sh
base="$KFDC_STORE_URL/artifacts/kfdc"
v=$(curl -fsS "$base/latest")
curl -fsS -O "$base/$v/bootstrap.sh"
curl -fsS "$base/$v/SHA256SUMS" | grep ' bootstrap.sh$' | sha256sum -c -
sh bootstrap.sh --version "$v"
```

It seeds the config and stops; fill in `PORT` and `ORIGIN` and re-run. Then
install a version — which is an ordinary deploy, from anywhere knarr and the
store are reachable:

```sh
just deploy                     # from the clone on kai, once .env names the host
knarr deploy kfdc --host <h> --shape directory --user --unit kfdc.service \
    --expect-file build/index.js \
    --ready-cmd '. ~/.config/kfdc/kfdc.env; curl -fs -o /dev/null "http://127.0.0.1:$PORT/api/board"'
```

`bootstrap.sh` **refuses to run** once the unit and config are both in place,
printing the knarr call instead. A once-ever script that still works on the
hundredth run quietly becomes the install route, and then the fleet has one
service that does not deploy through the fleet tool. knarr's own
`deploy/seed.sh` holds the same line for the same reason.

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
