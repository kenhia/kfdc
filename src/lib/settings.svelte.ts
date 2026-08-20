// The board's client-side preferences (#1489, sprint 017) — kfdc's first, and
// deliberately shaped as a shell rather than as one-off plumbing for one value.
//
// Why the browser owns this at all. GP-1 and docs/design.md § Expanded mode say
// kfdc renders korg's rollup and never owns korg's data — but how wide one
// reader's pane is on one monitor is not korg's data. Pushing it server-side
// would mean a settings endpoint, a store on kubsdb and a *deploy* to change a
// number, which is a lot of machinery for a single-user board. So: localStorage,
// per browser, and nothing about korg moves.
//
// Why percent in and pixels out. Ken reasons in pixels against a monitor he can
// see; kfdc should hold a proportion, so the value survives a different window
// and stays directly comparable to the `38%` that CSS used to hardcode. The
// percent is of `.deck`'s CONTENT BOX, not the viewport — that is the box a
// `flex-basis: %` resolves against, and measuring against `window.innerWidth`
// instead would be off by the body's 36px of padding: small enough never to be
// noticed, and never right.
//
// Lives in a `.svelte.ts` module rather than inside a component so load, clamp,
// convert and persist can be tested without a DOM — same reason as
// pane.svelte.ts and wall.svelte.ts.

/** One key, holding an object. A second setting is an added field, not a format migration. */
export const STORAGE_KEY = 'kfdc.settings.v1';

/**
 * What the pane takes when nothing is stored — percent of `.deck`'s content box.
 * Must match the `var(--pane-w, 38%)` fallback in app.css: a browser that never
 * opens the popover renders from the CSS alone and never reaches this module.
 */
export const DEFAULT_PANE_PCT = 38;

// These three mirror app.css's `.korg-pane` clamp, and exist here so the
// popover's px readout can tell the truth about what CSS will actually do.
// CSS owns the ENFORCEMENT — it has to, because it works at any window size
// with no JS at all. This is the mirror, not the source; the two move together
// and settings.svelte.test.ts is what notices if they stop.
/** The pane's floor: narrower than this and korg's own pages stop being usable. */
export const PANE_MIN_PX = 420;
/**
 * The board's floor. Replaces sprint 016's fixed `900px` cap on the pane, whose
 * problem was not its value but its kind: one number cannot serve a laptop and a
 * 34" ultrawide, and on Ken's 3440px screen it pinned the pane at 900px so the
 * intended 38% never once applied. The invariant that survives is the one the cap
 * was really protecting — *the board never becomes the sidebar of its own
 * dashboard* — expressed as a floor under `.deck-main` instead of a ceiling on
 * the pane.
 */
export const BOARD_FLOOR_PX = 640;
/** `.deck`'s flex gap, which the two floors have to share the width with. */
export const DECK_GAP_PX = 14;

/**
 * The band a *stored* percent is held to. Wider than anything sensible on
 * purpose: this is not the usability bound (CSS's clamp is), it is the guard
 * that keeps a half-typed `1` from being persisted as 0.03%.
 */
export const PANE_MIN_PCT = 10;
export const PANE_MAX_PCT = 80;

/** Just the slice of `Storage` this needs, so a test can pass a plain object. */
export interface StorageLike {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function clampPct(pct: number): number {
	return Math.min(Math.max(pct, PANE_MIN_PCT), PANE_MAX_PCT);
}

/** A typed pixel width, as a percent of the live deck. Caller guards `deckWidth > 0`. */
export function pctFromPx(px: number, deckWidth: number): number {
	return clampPct(round1((px / deckWidth) * 100));
}

/**
 * What the pane will ACTUALLY render at — the same arithmetic as
 * `clamp(420px, <pct>, calc(100% - 640px - 14px))`, including the rule that
 * makes it a mirror rather than an approximation: when the minimum exceeds the
 * maximum, `clamp()` returns the MINIMUM. Getting that backwards would have the
 * popover promise a pane narrower than the pane's own floor.
 */
export function resolvedPanePx(pct: number, deckWidth: number): number {
	const max = deckWidth - BOARD_FLOOR_PX - DECK_GAP_PX;
	const wanted = (pct / 100) * deckWidth;
	return Math.round(Math.max(PANE_MIN_PX, Math.min(wanted, max)));
}

// Anything at all can be in localStorage — a hand-edited value, a half-written
// entry, a format from a kfdc two sprints from now. Every failure lands on the
// default, because the alternative is a board that throws on load for the only
// person who has one.
function readPct(storage: StorageLike | null): number | null {
	if (!storage) return null;
	try {
		const raw = storage.getItem(STORAGE_KEY);
		if (raw === null) return null;
		const parsed: unknown = JSON.parse(raw);
		if (typeof parsed !== 'object' || parsed === null) return null;
		const v = (parsed as Record<string, unknown>).panePct;
		if (typeof v !== 'number' || !Number.isFinite(v)) return null;
		return clampPct(v);
	} catch {
		// Covers both a corrupt payload and a browser that throws on the property
		// access itself (private modes do).
		return null;
	}
}

export class BoardSettings {
	/**
	 * Percent of `.deck` the korg pane takes, or null when nothing is stored —
	 * and null is not "38", it is "say nothing and let app.css decide". That is
	 * what keeps the CSS default the single default.
	 */
	panePct = $state<number | null>(null);

	private readonly storage: StorageLike | null;

	constructor(storage: StorageLike | null = null) {
		this.storage = storage;
		this.panePct = readPct(storage);
	}

	/**
	 * The inline style for `.deck`, or undefined so the attribute is not rendered
	 * at all. Undefined rather than '' because an empty `style=""` in the SSR'd
	 * HTML is a difference the hydration diff has to reconcile for no reason.
	 */
	get deckStyle(): string | undefined {
		return this.panePct === null ? undefined : `--pane-w: ${this.panePct}%`;
	}

	/** What the pane renders at right now, for the popover's readout. */
	paneWidthPx(deckWidth: number): number {
		return resolvedPanePx(this.panePct ?? DEFAULT_PANE_PCT, deckWidth);
	}

	setPct(pct: number): void {
		if (!Number.isFinite(pct)) return;
		this.panePct = clampPct(round1(pct));
		this.persist();
	}

	setPx(px: number, deckWidth: number): void {
		// A deck with no width means the board has not laid out yet, and a percent
		// derived from zero is a division by zero wearing a number.
		if (!Number.isFinite(px) || deckWidth <= 0) return;
		this.setPct(pctFromPx(px, deckWidth));
	}

	/** Back to nothing stored, which is how the CSS default becomes reachable again. */
	reset(): void {
		this.panePct = null;
		try {
			this.storage?.removeItem(STORAGE_KEY);
		} catch {
			// See persist().
		}
	}

	private persist(): void {
		try {
			this.storage?.setItem(STORAGE_KEY, JSON.stringify({ panePct: this.panePct }));
		} catch {
			// A full or unavailable store costs this reader persistence, never the
			// board. The width they just set is already applied.
		}
	}
}
