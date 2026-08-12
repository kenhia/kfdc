---
name: deploy-board
description: Publish kfdc from committed main to the homelab package store and install that published bundle on the serving host, then prove the board that answers is the version just published. Use when asked to deploy/redeploy/ship kfdc or the FDC board, or when sprint-ship reaches Phase 7. Deploys committed code only.
---

# Deploy the kfdc board

**Publish once, install that.** `just publish` puts a versioned bundle in the
homelab package store; `just deploy [version]` installs _that artifact_ on the
serving host. What you verified is what the host runs, because it is the same
bytes fetched — not the same commit rebuilt. There is deliberately no
"install from this checkout" mode.

Doctrine is k-homelab `docs/deploying.md`; the kfdc-specific half is
`docs/deploying.md` here, which this skill does not restate. Read it if
anything below surprises you.

## Where this runs

Type both commands **from the clone on kai**. They act on different machines,
and since sprint 009 those machines are not the same box:

- `just publish` runs **here** — it needs the build toolchain and a commit.
- `just deploy` acts on the **serving host**, named by `KFDC_DEPLOY_HOST` in
  `.env` (kubsdb). When that is not this machine, just reaches it over ssh and
  the remote fetches and checksum-verifies its own `install.sh` — the same
  bootstrap `docs/deploying.md` writes out. Nothing is copied from the clone.

So the serving host needs only `curl`, `tar`, `systemctl` and an ssh key — no
checkout, no toolchain, no agent tooling. Placement lives in
`~/.config/kfdc/kfdc.env` (`PORT`, `ORIGIN`) on whichever host serves, which
is why moving the board changed no application code.

**Do not `cd` to the serving host and improvise.** If `just deploy` cannot
reach it, fix the reachability — an install typed by hand on kubsdb produces
the same result today and no record of how, which is the habit the store
exists to end.

## Publish from clean, committed `main` — never a branch

`just publish` refuses a dirty tree: a published version must name a commit, or
it is a rollback target nobody can reproduce. From a branch it publishes
**without moving `latest`**, which is how a path gets proven before it becomes
what the fleet resolves.

Version is `<package.json version>-<short commit>`, so a new commit is a new
version by construction and republishing needs no version bump. The store
refuses to overwrite a version.

This is why sprint-ship deploys in Phase 7, _after_ the merge: publishing from
merged `main` is what keeps every store version's commit an ancestor of
`origin/main`. A branch commit disappears at squash-merge, leaving the host
reporting a SHA that is on no branch. **Preserve that ordering.**

## Procedure

### 1. Preflight — and capture the rollback target first

```sh
cd ~/src/tools/kfdc
git status --short                  # must be empty
git rev-parse --abbrev-ref HEAD     # must be main
git pull --ff-only origin main
just versions                       # note what is running NOW
```

Stop and ask if the tree is dirty or the branch is not `main`. **Never stash.**

Record what `just versions` reports as `running:` before you change anything —
that is the rollback target, and it is easier to read now than to reconstruct
after the symlink has moved.

```sh
PREV=0.5.0-<sha>        # what `running:` said before this deploy
```

`KFDC_STORE_HOST` (publishing) and `KFDC_STORE_URL` (fetching) come from `.env`.
Neither has a default on purpose — if a recipe complains about one, set it, do
not guess it.

### 2. Publish

```sh
just publish
```

It prints the version. Capture it exactly and pin the install to it rather than
letting the host resolve `latest` on its own — the two agree here, but naming
the version is what makes the report checkable:

```sh
V=0.5.0-<sha>           # exactly what publish printed
```

### 3. Install on the serving host

```sh
just deploy "$V"
```

The installer fetches, checks every file against `SHA256SUMS` **before**
installing anything, asserts the tarball's `VERSION` stamp equals the version it
was published under, repoints `current` by rename(2), restarts, and waits for
`http://127.0.0.1:$PORT/api/board`. It stops at the first failure rather than
half-installing.

**This takes about 90 seconds and almost all of it is the restart.** The
service does not exit on `SIGTERM`, so systemd waits out `TimeoutStopSec`
and `SIGKILL`s it (measured in sprint 009: `just deploy` = 1m32s, korg
#1200). Do not read the pause as a hang and do not interrupt it — a deploy
killed between the symlink repoint and the restart leaves `current` pointing
at a version the running process is not executing, which is exactly the state
the cwd assertion below exists to catch.

## Verify — a probe that cannot answer is a failure

The installer's own version check has one soft edge: if it cannot read the
service's `/proc/<pid>/cwd` it prints _"could not read the service's cwd —
health check passed, version unproven"_ and still **exits 0**. That is a
reasonable installer default and a bad deploy report. So assert it here, where
an unexpected non-answer is a failure rather than a footnote:

Run it **on the serving host**, because that is where the process is. The
version crosses via `env`, not a positional parameter — see the warning below:

```sh
ssh "$KFDC_DEPLOY_HOST" env WANT="$V" bash -s <<'EOF'
pid=$(systemctl --user show -p MainPID --value kfdc.service 2>/dev/null || echo 0)
[ "${pid:-0}" -gt 0 ] || { echo "no MainPID for kfdc.service" >&2; exit 1; }
[ -r "/proc/$pid/cwd" ] || { echo "cannot read cwd of pid $pid" >&2; exit 1; }
running=$(basename "$(readlink -f "/proc/$pid/cwd")")
[ "$running" = "$WANT" ] || { echo "running $running, expected $WANT" >&2; exit 1; }
echo "pid $pid running $running"
EOF
```

> **A skill body is a template, and `$1` is not inert in it.** This snippet
> originally read `bash -s -- "$V"` with `V="$1"` inside the heredoc. When the
> skill is loaded, `$1` is **substituted before you ever see it** — the
> rendered instruction said `V="deploy"`, so the assertion would have compared
> the running version against a literal word and failed for a reason nobody
> would guess. Caught on the sprint-009 deploy, on the deploy this very edit
> shipped. Avoid positional parameters in skill snippets; pass values through
> `env`, which nothing rewrites.

The unit's `WorkingDirectory` is the `current` symlink, so the running process's
cwd resolves to the versioned directory it is actually executing out of — the
one thing that cannot be stale. A healthy HTTP answer proves _a_ kfdc is
running; this proves it is **this** one.

Then confirm the board is actually reachable and rendering the way a viewer
sees it — over the tailnet, not over loopback, because `tailscale_serve` is the
half loopback does not exercise:

```sh
curl -fsS --max-time 15 -o /dev/null -w '%{http_code}\n' \
    https://kubsdb.encke-wahoo.ts.net:8100/         # expect 200
curl -fsS --max-time 15 https://kubsdb.encke-wahoo.ts.net:8100/ \
    | grep -qi 'fire missions' || { echo "board did not render" >&2; exit 1; }
```

Run this **from kai**, not from kubsdb — the point is to exercise the path a
viewer takes. (It happens to work from kubsdb too, since tailscaled terminates
TLS and proxies to the loopback bind, but a same-host check proves less.)

`--max-time` is not decoration. An unreachable serve must fail in 15 seconds
with a non-zero status, not hang a deploy report. And grep for a panel heading
rather than trusting the status code: a 200 proves the adapter answered, the
marker proves SSR rendered the board rather than an error shell.

Finally, confirm the three views agree:

```sh
just versions      # store `latest:`, `here:` top entry, and `running:` == $V
```

Three sources, one version. If they disagree, say which one disagrees — that
distinction is the whole diagnostic.

### Report

One block: version published, install result, the four assertions above with
their actual values (not "OK"), and the rollback target you captured in step 1.
If any assertion was skipped, say which and why — an unproven version reported
as a clean deploy is the failure this section exists to prevent.

## Rollback

A bad deploy does not roll back a merge — the code landed fine, the rollout
didn't. **Naming an older version is the whole rollback; there is no second
verb:**

```sh
just versions               # what the store holds
just deploy "$PREV"         # this is the rollback
```

Published versions are immutable, so an old version is exactly the bytes that
worked. The last 3 versions stay unpacked on the host for a symlink-fast one;
older ones are pruned because the store is the real history. Verify a rollback
with the same assertions above — a rollback is a deploy.

## What this skill does not do

- **Host config.** `~/.config/kfdc/kfdc.env` (`PORT`, `ORIGIN`) is host state,
  seeded once from the bundle's template and never overwritten by a deploy.
  `PORT` must match the `tailscale_serve` entry declared for that host in
  k-homelab `manifests/<host>.yml`.
- **The curator.** `bin/update-fdc`, `just curator` and `kfdc-curator.timer`
  run from the **clone on kai** and are not part of the bundle. They need
  `curator/prompt.md` and a `claude` binary; the serving host needs neither.
  A board deploy neither updates nor restarts them. If a sprint changed
  `systemd/kfdc-curator.service`, that is `just curator-install`, by hand, on
  kai.
- **The Net Log store.** `~/.local/state/kfdc/` is viewer history and lives on
  the serving host. Deploys never touch it. Moving it is a host-move problem,
  not a deploy problem — sprint 009 copied it kai → kubsdb before first start.
- **Moving the board to another host.** That is a bootstrap on the new host
  (`docs/deploying.md`), a `tailscale_serve` entry declared for it in
  k-homelab, the Net Log store copied across, and the old host's unit and
  serve entry retired. Sprint 009 did it for kubsdb; the procedure is written
  down because it will be needed again, not because it is routine.
