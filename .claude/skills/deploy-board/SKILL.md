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

Since sprint 013, `just deploy` is a **knarr** call — the homelab fleet deploy
runner — not a hand-rolled ssh bootstrap. That changes this skill's verify
step from "re-probe the host four ways and hope" to "read the status document
knarr already returned". Read the Verify section before improvising.

Doctrine is k-homelab `docs/deploying.md`; the kfdc-specific half is
`docs/deploying.md` here, which this skill does not restate. Read it if
anything below surprises you.

## Where this runs

Type both commands **from the clone on kai**. They act on different machines,
and since sprint 009 those machines are not the same box:

- `just publish` runs **here** — it needs the build toolchain and a commit.
- `just deploy` acts on the **serving host**, named by `KFDC_DEPLOY_HOST` in
  `.env` (kubsdb). It runs `knarr deploy kfdc --host "$KFDC_DEPLOY_HOST"`,
  which fetches and verifies the bundle **here** and then uploads the verified
  bytes. Nothing is copied from the clone; what crosses is a store artifact.

So the serving host needs only `tar`, `systemctl` and an ssh key — no
checkout, no toolchain, no agent tooling, and since sprint 013 not even store
reachability for a deploy (only for the once-ever bootstrap). Placement lives
in `~/.config/kfdc/kfdc.env` (`PORT`, `ORIGIN`) on whichever host serves,
which is why moving the board changed no application code.

`knarr` must be on `PATH` here. `just deploy` refuses with the fix if it is
not; do not work around it with a `go build`.

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

knarr writes **exactly one JSON status document** to stdout and human-readable
progress to stderr, so redirect stdout and you get both — progress live, the
document kept to assert on:

```sh
STATUS=$(mktemp)
just deploy "$V" > "$STATUS"
```

knarr fetches, checks every file against `SHA256SUMS` and asserts the
tarball's `VERSION` stamp **before the host is touched at all**, then uploads,
unpacks into `versions/<v>`, repoints `current` by rename(2), restarts the
user unit, polls readiness, confirms the running version by its cwd, and
prunes past `--keep 3`. It stops at the first failure rather than
half-installing.

**Expect a couple of seconds, not a pause.** A deploy used to take about 90
seconds because kfdc ignored `SIGTERM` and systemd waited out
`TimeoutStopSec` before `SIGKILL`ing it; that was fixed in sprint 013 (korg
#1200), and knarr's own work was only ever ~1.3s of the total. Measured on
kubsdb the day it landed: **1.91s end to end, `restart` 220ms.** So a deploy
that hangs for 90 seconds is now news, not normal — it means something
reintroduced a referenced timer or handle that keeps the event loop alive.
Do not wait it out and call it fine.

> **The restart time belongs to the version being _stopped_, not the one
> being installed.** `systemctl restart` stops the old process first. So the
> deploy that first carries a shutdown fix still pays the old version's
> stall — sprint 013's own proving deploy took 91.96s with `restart` at
> 90,286ms, and the very next deploy of the same artifact took 1.91s with
> `restart` at 220ms. Nothing regressed between them. If you are deploying
> across a change to shutdown behaviour, time the _second_ deploy before
> concluding anything.

knarr's exit code is the diagnostic and this skill must not flatten it:

| exit | meaning                                                      |
| ---- | ------------------------------------------------------------ |
| `0`  | deployed and confirmed                                       |
| `1`  | usage                                                        |
| `2`  | store failure — **the host was never touched**               |
| `3`  | a deploy step failed; the previous version is still in place |
| `4`  | installed but running the wrong version                      |

## Verify — read the status document, do not re-probe

Until sprint 013 this section hand-rolled four ssh probes, because
`install.sh`'s exit code did not carry enough: its version check printed
_"could not read the service's cwd — health check passed, version unproven"_
and still **exited 0**. knarr fails that step instead and returns a structured
document, so the assertions become reads rather than re-runs.

**`ok: true` is not version proof.** It proves the steps ran. Check the steps.

```sh
export WANT="$V"
jq -e '
  .ok == true
  and .resolved_version == env.WANT
  and ([.steps[] | select(.status != "ok" and .status != "skipped")] | length == 0)
  and ([.steps[] | select(.name == "confirm" and .status == "ok")] | length == 1)
' "$STATUS" >/dev/null \
  || { echo "status document did not assert clean — read it, do not re-run" >&2; exit 1; }

jq -r '"resolved  \(.resolved_version)",
       "sha256    \(.sha256)",
       "host      \(.host)  (\(.scope) scope, shape \(.shape))",
       "total     \(.ms)ms",
       (.steps[] | "  \(.name)  \(.status)  \(.ms)ms  \(.detail // "")")' "$STATUS"
```

`WANT` is exported so the filter can read it as `env.WANT` — see the warning
below for why the version does not get interpolated into the snippet.

The step that matters most is **`confirm`**. It reads the unit's `MainPID` and
resolves `/proc/<pid>/cwd`; because the unit's `WorkingDirectory` **is** the
`current` symlink, that resolves to the versioned directory the process is
actually executing out of — the one thing that cannot be stale. `ready` is a
_separate_ step precisely so an HTTP 200 can never be mistaken for it: a
healthy answer proves _a_ kfdc is running, and the old process serves those
just as happily.

A `skipped` step is only acceptable for `stage`/`install` on a `--dry-run`. In
a real deploy, treat anything that is not `ok` as a failed deploy and say which
step it was — that is the whole value of the document over an exit code.

> **A skill body is a template, and positional parameters are not inert in
> it.** What this replaced ran `ssh … bash -s -- "$V"` and assigned `V` from
> the first positional parameter inside the heredoc. When a skill loads, that
> token is **substituted with the skill's own invocation arguments before you
> ever see it** — the rendered instruction read `V="deploy"`, so the assertion
> compared the running version against a literal word and would have failed
> for a reason nobody would guess. Caught on the sprint-009 deploy, on the
> deploy that very edit shipped.
>
> **This paragraph used to demonstrate the bug by containing one.** On the
> sprint-013 ship the skill was invoked with arguments, and the token in this
> warning was replaced by the word `Phase` from them — the lesson quietly
> rewrote itself into nonsense. Hence the prose. Never write a positional
> parameter into a skill body, not even to warn about them; pass values
> through the environment, which nothing rewrites. That is why the filter
> above reads `env.WANT`.

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

One block: version published, the status document's own numbers (resolved
version, sha256, per-step timings — actual values, not "OK"), the tailnet
render check, the three-way `just versions` agreement, and the rollback target
captured in step 1. If any assertion was skipped, say which and why — an
unproven version reported as a clean deploy is the failure this section exists
to prevent.

Report the **total deploy time** too. It is the one number that says whether
the thing sprint 013 bought is still bought.

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

- **Host config, and the unit.** `~/.config/kfdc/kfdc.env` (`PORT`, `ORIGIN`)
  and `~/.config/systemd/user/kfdc.service` are host state. knarr will never
  write either — it ships artifacts, restarts services and verifies versions,
  and nothing else (knarr D12). Both are `deploy/bootstrap.sh`, once per host,
  ever; it refuses to run once they are in place. `PORT` must match the
  `tailscale_serve` entry declared for that host in k-homelab
  `manifests/<host>.yml`.
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
