# Sprint 001 — walking skeleton: the board renders, live, at a URL

korg proposal: **kfdc:987** · branch `001-walking-skeleton` · started 2026-08-05

## Goal

First kfdc code. A SvelteKit board that renders live korg production data at a
ts.net URL: Fire Missions + On Deck + statline in the approved visual system,
deployed on kai via tailscale serve. Stretch: Commander's Call.

Scope (sequenced): #983 scaffold + `/api/board` proxy + real CI gates →
#984 panels + statline → #985 deploy → #986 stretch (droppable).

## Standing decisions honored (handoff korg:974 — not relitigated)

- SvelteKit + TypeScript, node adapter; korg REST via one server-route proxy.
- No LLM in the render path — the board renders korg deterministically.
- Visual system: `docs/design.md` tokens + `docs/design/kfdc-concept.html`.
  FDC vocabulary and density load-bearing; single-theme dark deliberate.
- Ages computed against the board's `generated` field (Postgres clock),
  never the browser clock.
- Progress renders three-part per korg #980: work-complete
  (resolved+done+closed) / Ken-verified (closed) / total.
- Statline derives from the lists (korg D-3, no counters block): live =
  `active.length + queue.length`, shipped = `proposals_omitted.done`,
  awaiting = `awaiting.length`, projects = `depth` filtered to active.

## Decisions made this sprint

- Scaffold: `sv create` output merged into the existing repo without
  disturbing the kproject harness files (CLAUDE.md managed block, README,
  docs/, sprints/, justfile kept).
- korg base URL + optional token live in `.env`
  (`KORG_URL`, `KORG_TOKEN` — token unused today, korg is no-auth on the
  tailnet; the proxy is the single place it would go).
- The page's server `load` and the `/api/board` proxy share one server-only
  fetch module (`src/lib/server/korg.ts`) so there is exactly one path to
  korg.
- On Deck renders queue order as delivered (pinned first, then rank) —
  no client-side re-sort.

## Shipped

- **#983** — SvelteKit + TS scaffold (node adapter, new vite-plugin config
  style: adapter passed to `sveltekit()` in `vite.config.ts`, no
  `svelte.config.js`). One server path to korg (`src/lib/server/korg.ts`)
  behind `GET /api/board`; board types + statline/progress/age derivations
  in `src/lib/board.ts`, written test-first. `just check` = harness
  invariants + prettier/eslint + svelte-check + build + vitest.
- **#984** — Fire Missions, On Deck (queue + omitted counts + depth bars),
  statline — concept CSS as `src/app.css`, FDC reticle favicon, no-comms
  error page. Verified against live production data by screenshot.
- **#986** (stretch, taken) — Commander's Call renders `board.awaiting`
  read-only, ages against `generated`.
- **#985** — deployed on kai at **https://kai.encke-wahoo.ts.net:8100**
  (port 8100: the 81mm nod). `just deploy` rebuilds + restarts.

### Deploy record (kai)

- systemd user unit `~/.config/systemd/user/kfdc.service`: WorkingDirectory
  `%h/src/tools/kfdc`, EnvironmentFile `%h/src/tools/kfdc/.env`,
  `HOST=127.0.0.1 PORT=8100 ORIGIN=https://kai.encke-wahoo.ts.net:8100`,
  ExecStart `/usr/bin/node build/index.js`, Restart=on-failure, enabled
  (linger already on, so it survives reboot).
- `sudo tailscale serve --bg --https=8100 http://127.0.0.1:8100` —
  loopback-bind pattern, one URL valid everywhere including kai itself.
  Needs declaring in k-homelab `manifests/kai.yml` `tailscale_serve`
  (incoming-change note filed).

## Follow-ups

- Declare the serve entry + unit in k-homelab (incoming-change note filed
  per record-machine-change).
- Wall mode (auto-refresh) and session-freshness stay roadmap Later; the
  board is a static render per load today.
