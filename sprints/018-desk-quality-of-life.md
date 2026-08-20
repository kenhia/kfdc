# 018 — Desk quality of life

**Proposal:** korg:1495 · **Items:** #1494, #1496, #1497 · **Branch:** `018-desk-quality-of-life`

Three fixes Ken hits every day at the desk, bundled because they share a shape:
none touches korg's data or kfdc's server surface, and any one could have been
dropped without harming the others. Done in the proposal's order — cheapest
first, largest last — because #1497 unblocks an actual workflow (Copy Sprint
Command → paste into a session, which is how sprints get started from the board
without mistyping a node_id) and #1496 was the one that could have run long.

## #1497 — the pane can't copy

One attribute, and the interesting part is what it is *not*.

`clipboard-write` is a Permissions-Policy feature whose default allowlist is
`self`, so a cross-origin child frame is denied it unless the embedder
delegates. `KorgPane.svelte` handed nothing down, so korg's copy buttons failed
in the pane with an error that reads like korg's bug and is kfdc's. kfdc serves
no `Permissions-Policy` header of its own, so the delegation was always ours to
give: `allow="clipboard-write"`, bare, which means "this feature, for the
frame's own origin".

`clipboard-read` is deliberately absent. korg's image paste reads
`ClipboardEvent.clipboardData` — the reader's own gesture, no permission needed
— and the async read API is a different capability the pane has no reason to
hold.

**The rule this produced, and it is the durable half.** The pane's capability
surface is a *knob*. Ken asked, fairly, whether the pane was the right shape at
all: three capability losses have now surfaced (Escape not reaching the board,
restore fidelity after a reload, and this). Two of the three are delegable —
`allow` and the CSP allowlist are the levers — and only restore fidelity is
structural, structural on purpose (GP-17). So the pane stays, and capability
delegation is ordinary maintenance: **the next report of "X doesn't work in the
pane" goes to the `allow` list first**, not back to first principles. Written
into `docs/design.md` § Expanded mode and into korg+ GP-17, because the next
consumer to embed korg will hit the same wall and should not re-derive it.

Delegating a capability is not the channel GP-17 forbids. It lets korg do its
own job inside the frame; a `postMessage` handler would let the two round-trip
state, and only the second is the road to a second korg UI.

## #1494 — the installed app showed a "K"

The tab was always right; the *install* path was starved. An SVG favicon and no
manifest at all, so Chromium synthesised a monogram from the title.

No icon to design — the reticle already existed and is the mark Ken wanted
kept. Rasterised to `static/` at 32/128/192/512 with a one-off headless
Chromium pass (`.scratch/018-icons.mjs`), so what ships is the *actual* SVG
rendered rather than a re-drawing of it. Deliberately not a build step and
deliberately not a dependency: four committed static files. Colours land exact.

Added `static/manifest.webmanifest` and declared it plus the rasters in
`src/app.html`, where `%sveltekit.assets%` paths stay un-hashed — an icon
imported through Vite is served from a hashed `/_app/immutable/…` URL, fine for
a tab and useless as a shortcut icon. The SVG `<link rel="icon">` stayed in
`+layout.svelte` where a route can still override it, and gained
`type="image/svg+xml" sizes="any"` so Chromium keeps preferring it for the tab.

**Maskable, measured rather than asserted.** The reticle is full-bleed on
`#15170f`, so the same files serve `any` and `maskable`. The ring's outer radius
is 10.25 of 32, comfortably inside the 40% safe circle; only the outer ~2 units
of each tick tip fall outside, so the harshest circular mask shortens the ticks
and never touches the ring or centre.

**The gate.** `src/app-icons.test.ts` reads the manifest, reads each PNG's own
IHDR, and holds the two to each other — because everything that goes wrong here
goes wrong *silently*: Chromium skips an unusable icon and falls back to the
monogram, no test imports these files, and the build copies `static/` without
looking inside it. Negative-tested six ways (missing file, wrong declared size,
no 512, maskable dropped, manifest unlinked, ground colour drifted); all exit 1.

## #1496 — refreshing closed the korg pane

The largest of the three, and most of it was already in the repo.

**In-app refresh, the primary path.** `/api/wall` was never wall-specific — it
is `boardPayload`, the same thing `/`'s server load returns, and its own header
said "the page payload" from day one. `WallFeed` was already generic, already
tested, and already refused to blank the board on a failed load. Wiring the desk
to them was the fix, and *the pane surviving is a consequence of not unmounting
rather than a feature that was built* — which is strictly better than restoring,
because the iframe keeps exactly what it was showing, including wherever Ken
clicked to inside korg.

A ↻ in the masthead beside the ⚙, desk-only by the same rule as the gear. Not a
`MastheadControl` — it opens nothing — but it wears the same button, because two
visual languages for two glyphs in one statline is how a masthead becomes a
toolbar. `Ctrl+R` and `F5` are claimed and routed to it; `Ctrl+Shift+R` is
deliberately left alone so a real hard reload stays one keystroke away for when
the *app* is what needs re-fetching.

**Two names stopped being true, so both were corrected.** `/api/wall` →
`/api/page`, `WallFeed` → `BoardFeed` in `feed.svelte.ts`, and the endpoint is
now spelled exactly once, in `payload.fetchPayload` — the same instinct as
`korglink.nodeHref` (GP-16) turned on kfdc's own surface. Both consumers are in
this repo; nothing external reads either.

**sessionStorage, the floor.** Two reload paths can never be intercepted: the
installed app window's own refresh control (browser chrome) and Ctrl+R while
focus is inside korg's frame — the same cross-origin boundary that killed
sprint 016's advertised Escape, except Chromium still services Ctrl+R as a
top-level reload. So the open node is written to `kfdc.pane.v1` and reopened
from an **effect** on mount. Not the constructor: the server renders the pane
closed, and an `{#if}` whose condition differs between the SSR'd HTML and the
first client render is a hydration mismatch, not a preference.

**The caveat is stated, not engineered around.** After a real reload kfdc can
restore only the node *it* set. Wherever Ken navigated inside korg is
cross-origin and unknowable, and `postMessage` is forbidden (GP-17, and #1203's
own 2026-08-05 decision). It stays a gap — the restore-fidelity itch is exactly
the one that would justify breaking that rule, which is why the WI named it in
advance.

### Two things found while building it

**A hung refresh was the worst failure mode, not the mildest — and it was
already shipped on the wall.** `fetch` has no default timeout. A socket that
never answers leaves `misses` at zero forever, so the wall goes stale carrying
*no* staleness marker: precisely the silence wall mode exists to prevent. On the
desk it would strand `busy`, leaving the ↻ dim and Ctrl+R swallowed with nothing
to un-stick them. Fixed with `REFRESH_TIMEOUT_MS` (30s) — well clear of any
healthy response, well inside the 3-minute poll it must not overlap. This is a
latent bug in sprint 014's wall, fixed here because sprint 018 is what made it
matter twice.

**Advertising `Ctrl+R` is honest where advertising `close (Esc)` was not.** Both
die the same way. The difference is what happens next: Escape's failure mode was
*nothing*, while Ctrl+R's is a real browser reload — which refreshes the board
and restores the pane. It degrades to the thing it replaced. So "the board draws
no affordance it cannot honour" is satisfied by a fallback, not only by a
guarantee, and the tooltip says `refresh (Ctrl+R)`.

## Verification

`just check` green: 24 files, 241 tests. Every new gate negative-tested — ten
planted failures across the hotkeys, the wall control, the pane restore, the
busy guard, the endpoint name, the timeout, the `finally`, and the hardened
parse; all exit 1, restored state exits 0.

Layout and reload behaviour are things jsdom cannot see (#1284, #1460 are the
precedent), so a headless browser ran from `.scratch/`:

- **Masthead** at 3440/2560/1920/1600/1366: ↻ and ⚙ both drawn, same row, ↻
  left of ⚙, zero page overflow and zero masthead overflow at every width.
- **Manifest** as *Chromium* parses it: linked, name/short_name/display/
  theme_color correct, both icons load at their declared 192×192 and 512×512,
  tab icon still the SVG.
- **Hotkeys**, and this is where the first measurement was wrong and had to be
  redone. The first pass asked "did the page survive Ctrl+R" — and the wall,
  which arms nothing, survived identically: headless Chromium has no browser UI,
  so it never services a reload shortcut either way. The result was an artifact
  of the harness. The honest instrumentation asks what is actually observable —
  does kfdc *claim* the keystroke, and does claiming it fire a real
  `GET /api/page`. Desk: Ctrl+R and F5 both `defaultPrevented`, one fetch each;
  Ctrl+Shift+R and Shift+F5 unclaimed, zero fetches. Wall: nothing claimed,
  zero fetches. Whether Chromium then suppresses its own reload is not
  observable without a browser UI — and is the bounded half, since if
  `preventDefault` did not take, Ken gets today's behaviour plus a restored
  pane.
- **Pane survival**: open the pane, then ↻ / Ctrl+R / F5 — document survives
  (same `window` stamp) and the pane stays open. Against a *real*
  `page.reload()`: pane reopens on `korg:1495`; closed first, it stays closed
  (`sessionStorage` cleared on close); corrupted by hand to `{"node":"not-a-node"}`
  it opens nothing and the board renders with zero page errors.
- **Wall**: pane never appears even with `kfdc.pane.v1` seeded, no ↻, no
  hotkeys.

Scripts: `.scratch/018-icons.mjs`, `018-verify.mjs`, `018-hotkeys.mjs`,
`018-restore.mjs`; screenshot `018-masthead.png`. Deliberately not dependencies
and deliberately not `just check` gates.

**What could not be verified before the deploy, by construction:** the clipboard
delegation's *effect*. 127.0.0.1 is not on korg's `frame-ancestors` allowlist,
so korg does not paint in the pane under `npm run dev` — correct default-closed
behaviour, not a bug. The attribute's presence is asserted in
`KorgPane.svelte.test.ts` and was confirmed on the live element; whether the
copy button then works is the deploy's to prove.

## Cross-project

korg+ amended in the same ship, per the plan's amend rule: GP-17 gains the
capability-delegation note (the `allow` list is not the channel; the next
consumer will hit the same clipboard wall), and GP-1's 2026-08-20 side-store
note gains the pointer-vs-content distinction that lets a consumer remember
which surface a reader had open.

`korg#1498` — `copyStart`'s `legacyCopy` fallback being unreachable when
`writeText` *rejects* rather than being absent — is in korg's own queue and not
this bundle. `covers` is single-project by design, and after #1497 the primary
path works anyway.

## Deployed

**2026-08-20 · `0.5.0-6da12b4`** on kubsdb (`https://kubsdb.encke-wahoo.ts.net:8100`).
Rollback target: `0.5.0-efd1cd0` (sprint 017) — still unpacked on the host, so
`just deploy 0.5.0-efd1cd0` is the whole rollback.

Published from merged `main` at `6da12b4`; `latest` moved. sha256
`fe1a4e7898bb592993af3a8ec7205d174b79e2ef5c6941d2a64128a00a194e9b`, 568021 bytes.

**1.886s end to end**, `restart` 224ms — in line with sprint 013's measured
1.91s/220ms, so the shutdown fix is still holding. Every knarr step `ok`:
stage 395ms · backup 191ms · install 203ms · restart 224ms · ready 253ms ·
**confirm 197ms → `0.5.0-6da12b4`** · cleanup 0ms (pruned `0.5.0-8b602c4`).
Three-way agreement: store `latest`, host top entry and `running:` all
`0.5.0-6da12b4`.

### Verified live

Over the tailnet from kai, which is the path a viewer takes:

- Board 200, SSR rendered (`Fire Missions` present); `/wall` 200.
- `/manifest.webmanifest` 200 as `application/manifest+json`, with the name,
  short_name, display, theme_color and both `any maskable` icons intact;
  `/favicon-192.png`, `/favicon-512.png`, `/favicon.png` all 200.
- `/api/page` 200; **`/api/wall` 404** — the rename landed and nothing else
  was still asking for the old name.
- The masthead draws `refresh the board` and `board settings` on `/`, and
  **neither on `/wall`**.

**#1497's acceptance, which only this host could run.** kubsdb:8100 is on
korg's `frame-ancestors` allowlist and 127.0.0.1 is not, so the delegation's
*effect* was unprovable until now. korg painted in the pane; then, with browser
permission granted for both read and write so that Permissions-Policy was the
only variable left:

| probe | result |
|---|---|
| `writeText` in the korg frame | **ALLOWED** — and `kfdc-1497-probe` actually reached the clipboard |
| `readText` in the korg frame | **REFUSED** — *"blocked because of a permissions policy"* |

The negative control is what makes this proof rather than coincidence: the
withheld capability still fails with exactly the error #1494's sibling WI
quoted, so the `allow` attribute is doing the work and is doing it narrowly.
A first pass had reported `writeText` refused with *"Write permission denied"*
— a different gate (the browser's, in a headless context with no user
activation), not this one; worth knowing, because the two failures read alike
and only one is kfdc's.

Then Ken's literal journey: open the pane, navigate **inside** korg to
Planning, press the copy affordance → clipboard held **`/start-sprint
korg:1477`**, no error toast, zero permissions-policy violations logged.

### Still owed by Ken, and it is the acceptance criterion for #1494

**Uninstall and reinstall the Edge web app.** Edge caches an installed app's
shortcut icon at install time and will not repaint an existing install, so the
taskbar will keep showing the old "K" until it is reinstalled — a correct fix
reading as a failed one. Everything the install path fetches is confirmed live
above; what remains is the cache.

### Fixed in flight: the deploy skill's own verify filter

`deploy-board`'s documented `jq` assertion read `.steps[]` at the top level of
knarr's status document. It is a multi-host envelope — `steps` lives under
`hosts[]` — so the filter died on `Cannot iterate over null`, a message naming
neither the field nor the fix. Corrected in the skill, and made stricter than
it was: it now asserts across **every** host rather than the first, and
requires `confirm`'s `detail` to equal the deployed version, so the step proves
what its name claims. The hazard was not the error — an error is loud — but the
obvious "fix" of deleting the assertion that was in the way.
