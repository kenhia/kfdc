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

Both commands run on **kai** today, but for different reasons, and the
distinction is what keeps the Phase-3 move cheap:

- `just publish` runs **from the clone** (`~/src/tools/kfdc`) — it needs the
  build toolchain and a commit. It stays on kai.
- `just deploy` runs **on the serving host** — it needs only `curl`, `tar` and
  `systemctl`. That is kai now and kubsdb after Phase 3.

They are the same box at the moment. That is placement, not a rule. Placement
lives in `~/.config/kfdc/kfdc.env` (`PORT`, `ORIGIN`) on whichever host serves,
which is why moving the board changes no file in this repo — including this
one, except the URL in the verify step.

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

## Verify — a probe that cannot answer is a failure

The installer's own version check has one soft edge: if it cannot read the
service's `/proc/<pid>/cwd` it prints _"could not read the service's cwd —
health check passed, version unproven"_ and still **exits 0**. That is a
reasonable installer default and a bad deploy report. So assert it here, where
an unexpected non-answer is a failure rather than a footnote:

```sh
pid=$(systemctl --user show -p MainPID --value kfdc.service 2>/dev/null || echo 0)
[ "${pid:-0}" -gt 0 ] || { echo "no MainPID for kfdc.service" >&2; exit 1; }
[ -r "/proc/$pid/cwd" ] || { echo "cannot read cwd of pid $pid" >&2; exit 1; }
running=$(basename "$(readlink -f "/proc/$pid/cwd")")
[ "$running" = "$V" ] || { echo "running $running, expected $V" >&2; exit 1; }
```

The unit's `WorkingDirectory` is the `current` symlink, so the running process's
cwd resolves to the versioned directory it is actually executing out of — the
one thing that cannot be stale. A healthy HTTP answer proves _a_ kfdc is
running; this proves it is **this** one.

Then confirm the board is actually reachable and rendering the way a viewer
sees it — over the tailnet, not over loopback, because `tailscale_serve` is the
half loopback does not exercise:

```sh
curl -fsS --max-time 15 -o /dev/null -w '%{http_code}\n' \
    https://kai.encke-wahoo.ts.net:8100/            # expect 200
curl -fsS --max-time 15 https://kai.encke-wahoo.ts.net:8100/ \
    | grep -qi 'fire missions' || { echo "board did not render" >&2; exit 1; }
```

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
- **The Net Log store.** `~/.local/state/kfdc/` is viewer history. Deploys
  never touch it; the Phase-3 host move has to copy it across.
- **Phase 3 itself.** Moving the board to kubsdb is a bootstrap on that host
  (`docs/deploying.md`), a new `tailscale_serve` entry, and retiring kai's unit
  — its own work, not a deploy.
