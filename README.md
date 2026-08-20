# kfdc

**K Fire Direction Center** — the homelab overseer board. A widescreen,
deliberately dense web dashboard answering *what's firing, what's on deck,
what's blocked, what's waiting on Ken* across every active project.

kfdc reads [`korg`](https://github.com/kenhia/korg) (the system of record for
work) and renders it deterministically; a headless curator agent writes
summaries and sequencing edges back into korg for the board to pick up, with a
deterministic pass (`just hints`) handing it collision candidates that prose
never mentioned.
Agents curate korg; the board renders korg. The FDC framing is literal:
fire missions (active sprints), priorities of fire (the ranked queue),
deconfliction (sequencing collisions), commander's call (decisions only Ken
can make).

> Status: **in production** — Fire Missions, On Deck, statline, Commander's
> Call, Net Log, Deconfliction, Sensor Net, Operations and the Ticker render
> production korg at `https://kubsdb.encke-wahoo.ts.net:8100` (tailnet
> only). Phase 3 closed in sprint 009 with the move off kai, the interim
> host. The live plan is korg — the board is how you read it; the approved
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
