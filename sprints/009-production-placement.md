# Sprint 009 — production placement, and the roadmap retires

**Proposal:** korg:1191 (slice 2 of program korg:1192, "kfdc Phase 3 —
switch over, and manage kfdc in kfdc")
**Covers:** #1188 (M) move hosting to kubsdb · #1189 (XS) retire the roadmap
into korg
**Branch:** `009-production-placement`

The sprint that ends Phase 3, and with it the part of kfdc's life where kfdc
was being built. Two halves of one claim: the board reaches its permanent
home, and the plan for it stops living in a markdown file that only existed
because there was no board yet.

Order was fixed by the proposal — **#1188 first**, because #1189's whole
assertion is that the plan lives in korg now, and writing that while the
board still ran on the interim host would have documented a state that was
not true yet.

## What sprint 005 bought, collected here

This used to be a rebuild. Sprint 005 made it a placement change, and this
sprint is the payoff: the service runs from `~/.local/share/kfdc/current`
out of a published bundle with `PORT`/`ORIGIN` in
`~/.config/kfdc/kfdc.env`, so **kubsdb got the exact bytes kai was serving**
— `0.5.0-8705758`, fetched from the store, not rebuilt from the commit.

The real work was on two hosts, and the diff here is mostly docs. Mostly.

## The cutover

Ordered so nothing could be lost or double-written: **stop kai → copy the
Net Log store → bootstrap kubsdb → verify → retire kai.** Stopping first
costs a few minutes of downtime and buys a clean cut — no window where two
observers append to two divergent stores.

**The Net Log store came across before first start.** `~/.local/state/kfdc/`
copied kai → kubsdb, md5 identical both ends: 240 lines,
`netlog.jsonl` `0a777bb0…`, oldest `2026-08-05T20:49:10Z` (sprint 002's
first observation), newest `2026-08-12T04:46:52Z`. That last line is *this
proposal going active* — the cutover was recorded in the log it was
carrying, which is a nicer coincidence than it deserves.

Ordering matters more than the copy: the observer diffs against
`last-digest.json`, so a host that starts without one records its first poll
as a wall of spurious transitions. It did not. Post-move the store went
240 → 243 lines with three real transitions and no noise, one of them the
`CC: call made` line for the awaiting marker set later in this same sprint.
That is the continuity proof end to end — carried, resumed, correct.

kfdc was built after a real loss of exactly this kind of continuity. Losing
it *during the move* would have been a poor joke.

**Bootstrap** was `docs/deploying.md` §"Bootstrapping a host with no
checkout", run verbatim: `install.sh` fetched from the store and
checksum-verified *before* running it, which `curl | sh` cannot offer. First
run seeded the config and stopped, as designed; second run activated.

**Verified**, values not "OK": `/proc/1256164/cwd` → `0.5.0-8705758`;
`https://kubsdb.encke-wahoo.ts.net:8100/` → 200 **from kai**, cross-host,
the path a viewer actually takes; SSR markers `Fire Missions / On Deck /
Commander / Net Log / Ticker`; `just versions` agreeing across store
`latest:`, `here:` and `running:`.

**kai retired**: unit stopped, disabled, deleted, daemon-reloaded;
`tailscale serve --https=8100 off`; `~/.local/share/kfdc` and
`~/.config/kfdc` removed. Nothing listens on `:8100`, nothing in its serve
status, and the old URL fails to connect. `~/.local/state/kfdc` was kept on
purpose as the cutover backup — 64 KB, and the one thing that would be
genuinely painful to be wrong about.

The curator stayed on kai, untouched, as specified. kubsdb got no agent
tooling and is not getting any (k-homelab #988).

## D-1: the deploy locus had to become explicit

The proposal said no file in this repo changes. One had to, and finding out
which was the only real surprise in the sprint.

**`just deploy` runs `deploy/install.sh` on whatever host you type it on.**
That was invisible while the clone and the service were the same box. After
the move, sprint-ship Phase 7 would have installed the new version onto
kai — where nothing serves — and reported success. Silently, which is the
failure mode this repo keeps designing against.

So `.env` gains **`KFDC_DEPLOY_HOST`**, with no default, on the same
reasoning the store variables have none: a guessed store URL fails as a
confusing curl error, and a guessed *deploy* host is worse than that. `just
deploy` and `just versions` act on that host, over ssh when it is not this
machine.

The remote path is deliberately **the documented bootstrap** — the serving
host fetches and checksum-verifies its own `install.sh`; nothing is copied
out of the clone. That collapses two procedures into one: adding a host and
redeploying one are now the same command, and the bootstrap section of
`docs/deploying.md` describes what `just deploy` does rather than a special
case beside it. A clone-less serving host was always the point of deploying
from a store; this is the first sprint where it had to be true.

Exercised end-to-end before being written up: `just deploy 0.5.0-8705758`
from kai reinstalled on kubsdb and passed every check.

`deploy/kfdc.env.example` also stopped shipping kai's real ORIGIN. A
template carrying a working URL for some *other* host satisfies install.sh's
non-empty check while pointing every redirect and form post at a machine
that no longer serves the board. It is a placeholder now.

## D-2: measured, filed, not absorbed

`just deploy` takes **1m32s**, and almost all of it is one thing: the
service does not exit on `SIGTERM`, so systemd waits out `TimeoutStopSec`
and `SIGKILL`s it. A clean, deliberate stop leaves the unit in `failed`
state.

This is pre-existing — true since the service existed — and nobody had timed
a deploy end-to-end before. Filed as **#1200** with the measurement and the
prime suspect (the observer's bare `setInterval` in `hooks.server.ts`
holding the event loop open, so adapter-node's graceful drain never
finishes). Explicitly *not* fixed by lowering `TimeoutStopSec`, which would
only `SIGKILL` sooner.

The `deploy-board` skill gained a warning about the pause, because the
90 seconds sit exactly between the symlink repoint and the health check —
the one window where interrupting genuinely corrupts state.

## The k-homelab tail — filed, not merged

**kenhia/k-homelab#39** (`chore/kfdc-serve-to-kubsdb`): declare `:8100` on
kubsdb, remove it from kai, one changelog entry per host, cross-linked.

Backend spelled `http://127.0.0.1:8100` **verbatim**, not `localhost` —
kfdc binds loopback and tailscaled echoes the backend back exactly as
given, so the spelling is part of the declaration. That is what bit PR #35.

Both machine changes were already made, so the PR declares reality rather
than requesting it. On the branch, from kubs0: `just check` OK, `bin/audit
kai` → `tailscale-serve: ok`, `bin/audit kubsdb` → `:8100` clean.

**Not merged.** Landing on another repo's main is Ken's call, same as #35.
Recorded as k-homelab **#1199**, Awaiting Ken. Not skipping this matters in
both directions: without it a rebuilt kai comes back serving a dead `:8100`,
and kubsdb's board URL does not come back at all.

Filed *after* the change, per the fold-in convention — pre-filing would have
put a fabricated blocker on the board.

**Noticed while there, not touched:** kubsdb serves an undeclared `:4870`
(kaed) that `bin/audit` flags and no manifest declares — while kaed's
placement is on record as deliberately absent from kubsdb (kaed #929). It
needs a decision rather than a default, so it is k-homelab **#1201** and not
a line in a kfdc ride-along.

## #1189 — the retirement, which is not a delete

*Later / Ideas* became six korg rows, `open` and **unqueued**, each carrying
its recorded text as a blockquote rather than a summary: **#1202** Transmit
drawer, **#1203** expanded-mode korg iframe, **#1204** wall mode, **#1205**
deterministic collision hints, **#1206** session-freshness, **#1207**
kdeskdash deep-link + korg-dash on the same rollup.

The two with real design in them earned a fact from being written down
today rather than a month ago:

- **#1203**'s `frame-ancestors` origin is kubsdb's now, not kai's.
- **#1202** predicted "the runner stays on kai" and was right — but that
  means the drawer now needs a **cross-host** path that did not exist when
  it was designed: the endpoint is on kubsdb, the runner on kai. First thing
  to design when it is picked up, and not a reason to put agent tooling on
  kubsdb.

`sprints/planning/roadmap.md` kept Phase 0–3 as the record and the two-layer
architecture decision, gained an explicit **Standing constraints** section,
and lost its claim to be a plan. `just harness` asserts the file exists;
that invariant is right and was left alone.

`CLAUDE.md` and `.github/copilot-instructions.md` moved in the same PR, as
#1189 required — otherwise the instruction outlives the file it points at.
Both now say to read the roadmap for *why* and *what was built*, never for
*what's next*.

**The check:** "what's next for kfdc" is answerable from the board, and the
honest answer today is **nothing queued** — 8 done proposals plus this one,
Phase 3 complete, no successor filed. The six preserved ideas are
deliberately not on the board, because unqueued work is memory rather than
plan. That is the retirement working, not a gap in it.

## Follow-ups

- **#1200** — kfdc ignores SIGTERM; every deploy waits out the 90s stop
  timeout and the unit lands `failed`. Measured here.
- **k-homelab #1199** — merge kenhia/k-homelab#39. **Awaiting Ken.**
- **k-homelab #1201** — kubsdb's undeclared `:4870`.
- **#1202–#1207** — the preserved ideas, unqueued.
