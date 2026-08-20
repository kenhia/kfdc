# 017 — Board settings: a gear in the masthead, and the korg pane gets its width back

korg proposal `korg:1492`, covering **#1489** (task/S).

## Goal

Sprint 016 put real korg in a pane beside the board. Ken's report a fortnight
later: korg cramped, kfdc stretched. Give the pane an adjustable width — a
setting, not a draggable divider — behind a gear in the masthead.

## The cap was the bug, and worse than the proposal knew

The proposal measured `app.css`'s `.korg-pane { flex: 0 0 clamp(420px, 38%,
900px) }` against Ken's 3440px screen and found the pane pinned at its cap:
38% of the 3404px deck is 1294px, and he has never once seen it. That framing
was right, but it understates the consequence. Restoring 016's clamp in a
headless browser with a **stored preference of 41.1%**:

```
@3440, pane open
  016 cap restored   pane  900   board 2490     ← 38% and 41.1% both render 900
  this sprint        pane 1399   board 1991
```

The pane renders 900px whether the setting says 38% or 41.1%. So a settings
dialog built on top of that cap would have been a control whose value CSS
silently discards — the proposal's phrase, "the current bug wearing a settings
dialog", turns out to be literal. That is the argument for changing the *kind*
of bound rather than its value.

**What replaces it is a floor under the board, not a ceiling on the pane:**

```css
flex: 0 0 clamp(420px, var(--pane-w, 38%), calc(100% - 640px - 14px));
```

The invariant the cap was protecting survives intact — *the board never becomes
the sidebar of its own dashboard* — but it no longer hardcodes a width that only
suited a 1080p screen.

## Measurements

Headless Chromium, `.scratch/017-layout.mjs` (deliberately not a dependency and
not a `just check` gate — jsdom cannot see layout, and #1284/#1460 are why this
repo measures instead of reasoning). Pane open, at 3440/2560/1920/1600/1366:
**zero page overflow, no panel spilling its box, at every width in every state.**

On Ken's screen (viewport 3440 → deck 3404):

| | pane | `.deck-main` | columns |
|---|---|---|---|
| pane closed | — | 3404 | 3 |
| before (016 cap) | 900 | 2490 | 3 |
| now, nothing stored (38%) | **1294** | 2096 | 3 |
| now, 1400px typed (41.1%) | **1399** | 1991 | 3 |

The out-of-box split improves without anyone touching a setting: 38% finally
applies. Three columns hold throughout — the board sheds its third at a
`.deck-main` of 1164px, and 41.1% leaves 1991px, nowhere near it.

The one thing the browser corrected: **the readout was lying by 2px.** There is
no global `box-sizing: border-box` in this board, so `flex-basis` was sizing the
*content* box and the pane's 1px borders landed outside it — 1400px asked for,
1402px on screen. The box model moved rather than the readout, scoped to
`.korg-pane`; retrofitting border-box across a mature layout is a different
sprint. After it, measured pane width equals the popover's number exactly.

## Decisions

- **Percent of `.deck`'s content box**, matching what a `flex-basis: %` actually
  resolves against. Measuring against `window.innerWidth` would be off by the
  body's 36px of padding — small enough never to be noticed and never right.
- **`localStorage`, one key holding an object** (`kfdc.settings.v1` →
  `{"panePct":41.1}`). A second setting is an added field, not a format
  migration. This is kfdc's first client-side persistence, so it sets the
  pattern. It does not breach GP-1: a browser chrome preference is not korg's
  data, and pushing it server-side would mean a settings endpoint, a store on
  kubsdb and a deploy to change a number.
- **Unset is silence, not 38.** Nothing stored → no `--pane-w` → no inline
  style at all, so app.css keeps the single home of the default and `reset`
  clears rather than writes. Recommended and kept: a browser that never opens
  the popover renders from the CSS alone.
- **Two clamps, deliberately.** The *stored percent* is held to 10–80% so a
  half-typed `1` is not persisted as 0.03%; the *rendered width* is clamped by
  CSS. `resolvedPanePx` mirrors the CSS clamp — including the rule that makes it
  a mirror rather than an approximation, that `clamp()` returns the **minimum**
  when the minimum exceeds the maximum — so the popover prints what will render
  rather than what was asked for. CSS owns enforcement, because it has to hold
  at any window size with no JS.
- **The input is never rewritten under the reader.** A half-finished number that
  snapped to 420 mid-keystroke would make the field unusable, so clamping lands
  on the stored percent and the readout is where the reader learns what it did.
- **No SSR flash to design around**, as the proposal predicted, and for the
  reason it gave: `PaneState.node` starts null, so the pane is not in the SSR'd
  HTML and cannot render before hydration. By the time anything with a width
  exists, the stored value has been read.
- **`MastheadControl` is a slot, not a wrapper.** It owns open state, focus and
  dismissal and knows nothing of its contents, so #1202's transmit drawer will
  add contents rather than refactor this. The gear's glyph and label live in
  `Board.svelte`, which is the masthead's business.
- **Measured on demand, not bound.** `bind:clientWidth` costs a ResizeObserver
  running for the life of the board; the width is wanted at the moment the
  popover opens, and it cannot go stale while the popover is up because setting
  the pane width resizes `.deck-main`, never `.deck`. It also kept jsdom out of
  the ResizeObserver business, which is how the Board test exists at all.

## The two rules the sprint was warned about

**No gear on `/wall`.** Nobody is at the keyboard, and *the wall draws no
affordance it cannot honour*. `Board.svelte` renders no `MastheadControl` there
at all, and `Board.svelte.test.ts` is a real gate on it — the first component
test of `Board.svelte` in this repo.

**Escape, promised only where it can be kept.** Sprint 016 advertised
`close (Esc)` on the pane and had to withdraw it within the hour: Chromium hands
focus to the cross-origin korg frame and the board's window sees zero keydowns.
A same-origin popover has no such problem *provided it actually holds focus*, so
it takes focus on open and that is what the test asserts — the focus is the
claim, not the keybinding. It also stops the event: `KorgPane` listens for
Escape on the window, so without `stopPropagation` one keystroke would close
both, and dismissing a settings box would cost the reader the korg node they
were reading. Verified in a real browser with the pane open and the frame
loaded — the exact state that caught 016 out. Escape closes the popover; the
pane stays.

Dismissal is otherwise the gear itself and `focusout`. The latter is the only
one that can see a click landing *inside* the korg iframe, which fires no event
this document receives and reports a null `relatedTarget`.

## Scope held

korg untouched — no route, no CSP, no API, no `postMessage` (GP-17). Refs are
still real `<a href>`s and the pane is still the whole node (GP-18). One
setting: the popover is *shaped* as a list, and ships with one row. No
per-breakpoint width table (Ken named it YAGNI himself). No
`cross-project-planning` amendment — nothing here is a contract between repos.

## Tests

19 new, 200 total, all green. **All ten new gates negative-tested** — the
planted error and the failure it produced:

| gate | planted | result |
|---|---|---|
| clamp mirror | min no longer wins over max | 1 failed |
| board floor | `BOARD_FLOOR_PX = 0` | 2 failed |
| corrupt-storage fallback | coerce instead of reject | 4 failed |
| wall rule | gear rendered on `/wall` | 1 failed |
| Escape containment | `stopPropagation` removed | 1 failed |
| popover takes focus | focus call removed | 1 failed |
| focusout dismissal | dismissal removed | 1 failed |
| truthful readout | print requested, not resolved | 2 failed |
| input not rewritten | write clamped value back | 1 failed |
| reset clears | reset stores 38 instead | 1 failed |

Plus the two layout negative tests above, in a real browser: 016's cap back
(pane pinned at 900px, setting ignored) and the floor removed (board crushed to
363px at 1920/80%).

Files: `settings.svelte.test.ts` (pure — round-trip, both clamps, seven flavours
of untrusted stored value, a storage that throws on every call),
`SettingsPopover.svelte.test.ts`, `MastheadControl.svelte.test.ts`,
`Board.svelte.test.ts`.

## Follow-ups

- The `visually-hidden` over-scroll the layout probe reports is Rate of Fire's
  screen-reader data table, positioned off-screen on purpose. Pre-existing, not
  a #1284 spill; the probe now excludes it so the signal stays clean.
- `box-sizing: border-box` is scoped to `.korg-pane`. If the board ever wants it
  globally, that is its own sprint with its own measurements.
