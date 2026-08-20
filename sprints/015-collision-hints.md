# 015 — Deterministic collision hints feeding the curator

korg:1455 · covers #1205 · branch `015-collision-hints`

## Goal

Deconfliction renders `collides-with` edges the curator mined from prose —
an LLM reading text, so it finds only collisions somebody wrote down. Add a
**deterministic** pass that finds the other half: two live proposals naming
the same file, endpoint, or contract symbol. It emits *candidates*; the
curator still decides and still writes every edge.

## Decisions taken at the start

**Signal source: korg prose, token-extracted.** Not git (proposals describe
work not yet done, and the curator host has only kfdc's clone — korg's and
kfo's proposals would go unserved), not a new korg field (that blocks this
sprint on a korg sprint, and on humans populating it). The extraction is
deterministic *string* work over `summary`, `notes` and human comments: it
does not need prose to say "collides with X", only for both sides to name
the same artifact. Stays inside korg — **GP-12**, consumers query korg, they
do not index it.

**Delivery: a pre-pass injected into the prompt.** The curator runs with
`--strict-mcp-config --allowed-tools mcp__korg` and Bash/Edit/Write
disallowed — it *cannot* run a script. So the hints are produced outside the
pass and appended to `curator/prompt.md` on stdin by `bin/update-fdc`; the
`/update-fdc` skill runs the same script. One prompt file, no fork.

**GP-1 holds unchanged.** The hint pass writes nothing, to korg or anywhere.
The curator remains the only writer, with its `origin` stamp, and the board
still learns collisions only from korg.

**GP-2 holds too:** the hint list is a pure function of korg's state, so the
same queue produces the same hints, and the curator's diff-first rule still
means an unchanged queue writes nothing.

## What shipped

- `curator/hints.ts` — the whole heuristic, pure. Token extraction, pairing,
  the ambient cut, suppression, ranking, and the rendered block.
- `curator/hints-run.ts` — the I/O half: `GET /api/board` plus
  `GET /api/proposals/<id>` per live row (korg's REST mirror of
  `get_proposal`, so `notes` and comments come along), then print.
- `bin/collision-hints` — the wrapper. Node runs the TypeScript directly
  (type stripping); no build step, and this is not in the board bundle.
- `bin/update-fdc` — appends the block to the prompt on stdin.
- `curator/prompt.md` § *Deterministic collision hints* — how the curator
  treats a block, and the explicit rule that an **absent** block means the
  pass did not run while `none` means it ran and found nothing.
- `.claude/skills/update-fdc/SKILL.md` — runs the same script, so the two
  entry points stay identical.
- `just hints`, and two harness invariants (`bin/update-fdc` and
  `bin/collision-hints` executable).

**The render contract did not move.** `src/lib/curator.ts` parses
`(mined from <source>)` as free text, so a hint-derived citation needs no
read-side change. The one contract both sides share stayed still.

## Where the code lives, and why the gates had to be taught to reach it

`curator/` is deliberately **not** under `src/lib`. That directory is the
board's library, and a collision derivation sitting in it would read as the
board deriving collisions — the exact thing GP-1 forbids, even as dead code.
The cost is that neither gate reached `curator/` by default:

- `vite.config.ts` — the `server` test project's `include` gains
  `curator/**`.
- `tsconfig.json` — `include` is now **overridden**, not extended, because
  svelte-kit's generated config lists only `src/`. The four `.svelte-kit`
  entries restate what the generated one includes; if SvelteKit ever adds a
  fifth, this list is what needs updating.

Negative-tested, because a gate never seen to fail is not a gate: a planted
`const x: number = "no"` in `curator/hints.ts` passed `npm run check` with
**0 errors** before the tsconfig change and failed with 1 after. The harness
invariants were negative-tested the same way (`chmod -x`).

## The heuristic, and what measurement changed about it

Three token kinds, all lifted from raw prose:

- **file** — a path with a known extension. URLs are stripped first, and a
  dotted name with no directory (`kubsdb.encke-wahoo.ts.net`) is rejected as
  a hostname rather than admitted as a `.ts` file.
- **endpoint** — `GET /api/board` and friends.
- **symbol** — snake_case or kebab-case, **only inside backticks**. That is
  the precision half: bare prose says "collides with" constantly, so only
  `` `collides-with` `` counts.

The curator's own `⟦curator⟧` synopsis is skipped. It quotes the artifacts it
mined, so leaving it in would let a written edge re-propose itself forever.

**Suppression, before ranking.** Pairs korg already carries a `depends_on` /
`collides-with` edge for; pairs korg reports as `sequenced_by` a live program
(kfdc #1070, sprint 007 — a deterministic pass that ignored that rule would
re-surface what 007 quieted, and would do it *reliably*, which is worse); and
pairs that are two slices of one program, which that program has already
ordered. Every count is printed in the block: nothing is set aside silently.

**The ambient cut.** A token named by more than 3 live proposals is
vocabulary, not collision. An inverse-frequency cut was chosen over a
stoplist because it maintains itself.

### Measurement 1 — the whole corpus (264 proposals, 251 of them done)

872 mentions over 199 proposals; 529 distinct tokens; 43 cut as ambient
(`CLAUDE.md` 22, `install.sh` 12, `docs/api.md` 10). The top 8 candidates
contained six that were plainly real (`dr/kubsdb.md`, `deploy/docker-compose.yml`,
`collectors.py`, `dr/kai.md` …) and **two false positives** — `docs/usage.md`
shared by kyac and klams, `package.json` shared by kyac and kfdc.

Both false positives were the same mistake: a **cross-project file match**.
A repo-relative path names one file only inside one repo. So `file` tokens
are docked when the two proposals are in different projects, and the block
labels such a pair `weak: different projects`. Contracts are *not* docked —
being global is what makes something a contract.

Docked rather than dropped, and that turned out to matter (below). Re-run,
the top 8 became 8/8 plausible, all same-project.

### Measurement 2 — a queue-sized window (newest 20 proposals)

The one that actually predicts behaviour, since the live queue is ~5–15 rows
and the cap almost never binds. 7 candidates, ranked:

1. **korg:1435 ↔ korg:1436** — korg widening the flow endpoint against kfdc
   correcting the Rate of Fire delta. A real cross-project contract
   collision, and the sprint that produced GP-13. It ranks **first** on two
   shared symbols (`backlog_before`, `added_durable`) — the docking cost it
   nothing, which is the evidence for docking rather than dropping.
2. **korg:1452 ↔ korg:1454** — kfdc sprints 013 and 014, both editing
   `src/hooks.server.ts`. Nobody wrote that down anywhere. This is exactly
   the class of collision the sprint exists to find.
3. …then `docs/design.md` between 014 and this sprint, and three pairs from
   the cross-project-planning rollout sharing `index.md`.

Two things worth keeping from that tail. Those three rollout pairs were
**slices of one program** (korg:1405) — on a real board the same-program
suppression removes them, and this run passed an empty context on purpose.
And the `index.md` they share genuinely *is* one file (the plan repo's
routing table) despite spanning projects, so the `weak` label is wrong there.
That is the argument for the whole shape: the label is a reason for the
curator to look, not a verdict, and the curator is the filter.

The ambient cut removed nothing at this size. It is insurance against a full
queue, not a working part of a small one.

## Verification

- 21 unit tests over the pure module, including the undirected pairing, each
  suppression rule, the cross-project docking (and the contract case that
  must *not* dock), the cap, and byte-identical output for identical input.
- End-to-end through the real wrapper, with a shim standing in for
  `claude -p`: healthy korg puts prompt + `---` + block on stdin; with korg
  unreachable the wrapper prints `collision-hints: fetch failed` to stderr,
  exits 0, and stdin is `curator/prompt.md` **byte for byte**. Failure of the
  hint pass cannot take down a curator pass.
- `just check` green: harness, prettier/eslint, svelte-check (379 files),
  build, 141 tests.

## Follow-ups

- The live 2026-08-19 queue is 5 proposals and yields `none`, so no real
  curator pass has yet had candidates to act on. The first pass that does is
  where the prompt's hint section gets its real test — read that run's report
  for hints rejected and why, and tune from there.
- korg inlines only the newest 10 comments per proposal; the runner says so
  in the block when it bit, rather than letting a partial read look whole.

## Deployed

**2026-08-20** — `0.5.0-5fedecb` on kubsdb, published from merged `main`
(`5fedecb`) and installed through knarr. Rollback target: `0.5.0-fc88d05`
(sprint 014), still unpacked on the host.

**The bundle carries none of this sprint's work, and that is correct.** Nothing
under `src/` or `systemd/` changed — the payload is curator-side, and the
curator runs from the clone on kai, not from the bundle. The board version moved
so that what the store holds keeps naming a commit on `main`; its behaviour did
not.

knarr status document, asserted on the `confirm` step rather than `ok: true`:
sha256 `98d20b8f…`, resolved `0.5.0-5fedecb`, **1850ms total** — stage 386ms,
backup 191ms, install 214ms, restart 222ms, ready 255ms, confirm 199ms, cleanup
0ms (pruned `0.5.0-294cdf5`). In line with the post-sprint-013 norm; no sign of
the shutdown stall returning.

Verified live:

- `https://kubsdb.encke-wahoo.ts.net:8100/` → 200, and SSR rendered the board
  (matched *fire missions*, so not an error shell). Checked from kai over the
  tailnet, which is the path a viewer takes.
- `/wall` → 200; sprint 014's mode still serves.
- `just versions` — store `latest`, host top entry and `running:` all
  `0.5.0-5fedecb`.

Verified for the work this sprint actually shipped, which the deploy does not
cover:

- `just hints` runs from the clone at merged `main` against production korg —
  3 live proposals, `none`, suppression counts all zero.
- `kfdc-curator.timer` is enabled and active, `ExecStart` is the clone's
  `bin/update-fdc`, and the installed unit still matches `systemd/` — so the
  timer picks up the hints block on its next run with no `just curator-install`.
