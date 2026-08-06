# kfdc

**K Fire Direction Center** — the homelab overseer board. A widescreen,
deliberately dense web dashboard answering *what's firing, what's on deck,
what's blocked, what's waiting on Ken* across every active project.

kfdc reads [`korg`](https://github.com/kenhia/korg) (the system of record for
work) and renders it deterministically; a headless curator agent writes
summaries and sequencing edges back into korg for the board to pick up.
Agents curate korg; the board renders korg. The FDC framing is literal:
fire missions (active sprints), priorities of fire (the ranked queue),
deconfliction (sequencing collisions), commander's call (decisions only Ken
can make).

> Status: **Phase 2 live** — Fire Missions, On Deck, statline, Commander's
> Call, Net Log, Deconfliction, Sensor Net and Operations render production
> korg at `https://kai.encke-wahoo.ts.net:8100` (tailnet only; interim host
> — the production move to kubsdb is Phase 3). The plan onward is
> [`sprints/planning/roadmap.md`](sprints/planning/roadmap.md); the approved
> visual concept is
> [`docs/design/kfdc-concept.html`](docs/design/kfdc-concept.html).

Related: `korg-dash` remains the small-panel summary feed for the kdeskdash
desk display; kfdc is the full-screen board. They should share korg's rollup
read once it exists.

## Development

SvelteKit + TypeScript (node adapter), on the
[kprojects](https://github.com/kenhia/kprojects) minimal harness. `just`
lists recipes; `just dev` runs the dev server; `just check` runs the CI
gates (harness invariants, prettier/eslint, svelte-check, build, vitest).
korg base URL lives in `.env` (see `.env.example`).

`just publish` puts a versioned bundle in the homelab package store and
`just deploy` installs that artifact on the serving host — naming an older
version is the rollback. See [`docs/deploying.md`](docs/deploying.md); kfdc
does not build in place.

## License

MIT — see [LICENSE](LICENSE).
