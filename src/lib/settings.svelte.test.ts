// BoardSettings and the pure arithmetic around it (#1489). Named
// `.svelte.test.ts` because the class uses `$state` — the vitest projects
// partition on exactly that suffix (sprint 007), so a rune-using module tested
// under the wrong name runs in the wrong environment.
import { describe, expect, it } from 'vitest';
import {
	BoardSettings,
	DEFAULT_PANE_PCT,
	PANE_MAX_PCT,
	PANE_MIN_PCT,
	PANE_MIN_PX,
	STORAGE_KEY,
	clampPct,
	pctFromPx,
	resolvedPanePx,
	type StorageLike
} from './settings.svelte';

// Ken's monitor, which is the measurement the whole sprint came from: 3440px
// viewport less the body's 18px a side.
const DECK = 3404;

function fakeStorage(seed: Record<string, string> = {}): StorageLike & { data: typeof seed } {
	const data = { ...seed };
	return {
		data,
		getItem: (k) => (k in data ? data[k] : null),
		setItem: (k, v) => void (data[k] = v),
		removeItem: (k) => void delete data[k]
	};
}

// A store that fails every way a real one can: private-mode reads, quota-full
// writes. The board must survive all of it.
const hostileStorage: StorageLike = {
	getItem() {
		throw new DOMException('denied');
	},
	setItem() {
		throw new DOMException('quota');
	},
	removeItem() {
		throw new DOMException('denied');
	}
};

describe('resolvedPanePx', () => {
	// The number that justified the sprint: 38% of Ken's deck is ~1294px, and
	// sprint 016's `900px` cap meant he never once saw it — the pane has been
	// pinned at that cap on this screen since the day it shipped.
	it('gives the CSS default its intended width on a 3440px screen', () => {
		expect(resolvedPanePx(DEFAULT_PANE_PCT, DECK)).toBe(1294);
	});

	it('honours a width the old fixed cap would have swallowed', () => {
		expect(resolvedPanePx(41.1, DECK)).toBe(1399);
	});

	// The floor that replaced the cap. The board never becomes the sidebar of
	// its own dashboard, however wide the pane is asked to be. Measured on a
	// 1920px deck, not Ken's: on his the stored-percent band binds first (80% of
	// 3404 still leaves the board 667px), so a floor test there would pass
	// without the floor existing.
	it('keeps 640px under the board rather than capping the pane', () => {
		const px = resolvedPanePx(PANE_MAX_PCT, 1920);
		expect(px).toBe(1920 - 640 - 14);
		expect(1920 - px - 14).toBe(640);
	});

	it('never renders the pane below its own floor', () => {
		expect(resolvedPanePx(PANE_MIN_PCT, DECK)).toBe(PANE_MIN_PX);
	});

	// `clamp(MIN, VAL, MAX)` returns MIN when MIN > MAX, and this mirror has to
	// agree or the popover promises a pane narrower than the pane can be. At a
	// 900px deck the board floor leaves only 246px, which is under the 420px min.
	it('returns the minimum when the board floor leaves less than one, as clamp() does', () => {
		expect(resolvedPanePx(50, 900)).toBe(PANE_MIN_PX);
	});
});

describe('pctFromPx', () => {
	it('converts against the deck, and round-trips back to the pixels typed', () => {
		const pct = pctFromPx(1400, DECK);
		expect(pct).toBe(41.1);
		expect(resolvedPanePx(pct, DECK)).toBe(1399);
	});

	it('clamps a half-typed number up rather than storing 0.03%', () => {
		expect(pctFromPx(1, DECK)).toBe(PANE_MIN_PCT);
	});

	it('clamps an absurd number down', () => {
		expect(pctFromPx(99_999, DECK)).toBe(PANE_MAX_PCT);
	});
});

describe('clampPct', () => {
	it('holds both ends', () => {
		expect(clampPct(-5)).toBe(PANE_MIN_PCT);
		expect(clampPct(1000)).toBe(PANE_MAX_PCT);
		expect(clampPct(38)).toBe(38);
	});
});

describe('BoardSettings', () => {
	it('says nothing at all when nothing is stored, so app.css keeps the default', () => {
		const s = new BoardSettings(fakeStorage());
		expect(s.panePct).toBeNull();
		expect(s.deckStyle).toBeUndefined();
		expect(s.paneWidthPx(DECK)).toBe(resolvedPanePx(DEFAULT_PANE_PCT, DECK));
	});

	it('has no store at all on the server, and still renders', () => {
		const s = new BoardSettings(null);
		expect(s.panePct).toBeNull();
		expect(s.deckStyle).toBeUndefined();
	});

	it('applies and persists a width typed in pixels', () => {
		const store = fakeStorage();
		const s = new BoardSettings(store);
		s.setPx(1400, DECK);
		expect(s.panePct).toBe(41.1);
		expect(s.deckStyle).toBe('--pane-w: 41.1%');
		expect(JSON.parse(store.data[STORAGE_KEY])).toEqual({ panePct: 41.1 });
	});

	// The point of storing a proportion: the same preference on a different
	// window is a different number of pixels.
	it('reads back as a proportion, not as the pixels it was typed as', () => {
		const store = fakeStorage();
		new BoardSettings(store).setPx(1400, DECK);
		const reloaded = new BoardSettings(store);
		expect(reloaded.panePct).toBe(41.1);
		expect(reloaded.paneWidthPx(DECK)).toBe(1399);
		expect(reloaded.paneWidthPx(1920)).toBe(789);
	});

	it('refuses to derive a percent from a deck that has not laid out', () => {
		const s = new BoardSettings(fakeStorage());
		s.setPx(1400, 0);
		expect(s.panePct).toBeNull();
	});

	it('resets to nothing stored rather than to a second copy of the default', () => {
		const store = fakeStorage();
		const s = new BoardSettings(store);
		s.setPx(1400, DECK);
		s.reset();
		expect(s.panePct).toBeNull();
		expect(s.deckStyle).toBeUndefined();
		expect(STORAGE_KEY in store.data).toBe(false);
	});

	// The failure that would blank the board for the only person who has one.
	// Every one of these is a value a real browser can hold.
	describe('a stored value it cannot trust', () => {
		it.each([
			['not JSON at all', 'not json'],
			['JSON that is not an object', '42'],
			['null', 'null'],
			['an object with no panePct', '{}'],
			['a panePct that is not a number', '{"panePct":"41.1%"}'],
			['a panePct that is NaN', '{"panePct":null}'],
			['a shape from some other kfdc', '{"paneWidth":{"px":1400}}']
		])('falls back to the default on %s', (_why, raw) => {
			const s = new BoardSettings(fakeStorage({ [STORAGE_KEY]: raw }));
			expect(s.panePct).toBeNull();
			expect(s.paneWidthPx(DECK)).toBe(resolvedPanePx(DEFAULT_PANE_PCT, DECK));
		});

		// Out-of-band but well-formed: trusted enough to use, clamped on the way in.
		it('clamps a stored percent outside the band instead of discarding it', () => {
			const s = new BoardSettings(fakeStorage({ [STORAGE_KEY]: '{"panePct":250}' }));
			expect(s.panePct).toBe(PANE_MAX_PCT);
		});
	});

	it('survives a storage that throws on every call', () => {
		const s = new BoardSettings(hostileStorage);
		expect(s.panePct).toBeNull();
		expect(() => s.setPx(1400, DECK)).not.toThrow();
		// The width is applied even though it could not be saved.
		expect(s.panePct).toBe(41.1);
		expect(() => s.reset()).not.toThrow();
		expect(s.panePct).toBeNull();
	});
});
