// The settings list itself (#1489): pixels in, percent stored, applied live.
// The arithmetic is settings.svelte.test.ts's job — this is about the wiring
// between the box and the board, and about the readout telling the truth.
import { mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import SettingsPopover from './SettingsPopover.svelte';
import { BoardSettings, DEFAULT_PANE_PCT, type StorageLike } from './settings.svelte';

const DECK = 3404;

function fakeStorage(): StorageLike & { data: Record<string, string> } {
	const data: Record<string, string> = {};
	return {
		data,
		getItem: (k) => (k in data ? data[k] : null),
		setItem: (k, v) => void (data[k] = v),
		removeItem: (k) => void delete data[k]
	};
}

function render(settings: BoardSettings, width = DECK) {
	const target = document.body.appendChild(document.createElement('div'));
	const app = mount(SettingsPopover, {
		target,
		props: { settings, deckWidth: () => width }
	});
	const input = target.querySelector('input.setting-i') as HTMLInputElement;
	const type = (v: string) => {
		input.value = v;
		input.dispatchEvent(new Event('input', { bubbles: true }));
	};
	return {
		target,
		app,
		input,
		type,
		note: () => target.querySelector('.setting-n')!.textContent!.replace(/\s+/g, ' ').trim(),
		reset: () => (target.querySelector('button.setting-reset') as HTMLButtonElement).click()
	};
}

afterEach(() => {
	document.body.replaceChildren();
});

describe('SettingsPopover', () => {
	it('opens showing the width the pane is actually rendering at', () => {
		const v = render(new BoardSettings(fakeStorage()));
		expect(v.input.value).toBe('1294');
		expect(v.note()).toBe(`stored ${DEFAULT_PANE_PCT}% of ${DECK}px · renders 1294px`);
		unmount(v.app);
	});

	it('applies and stores a typed width as a percent of the deck', async () => {
		const store = fakeStorage();
		const settings = new BoardSettings(store);
		const v = render(settings);

		v.type('1400');
		await Promise.resolve();
		expect(settings.panePct).toBe(41.1);
		expect(settings.deckStyle).toBe('--pane-w: 41.1%');
		expect(JSON.parse(store.data['kfdc.settings.v1'])).toEqual({ panePct: 41.1 });
		expect(v.note()).toBe(`stored 41.1% of ${DECK}px · renders 1399px`);
		unmount(v.app);
	});

	// The box holds what was typed and never a rewritten version of it. A
	// half-finished number that snapped to 420 under the reader's cursor would
	// make the field unusable, so the clamp lands on the stored percent instead
	// — and the readout is where the reader learns what it did.
	it('never rewrites the box under a half-typed number', async () => {
		const settings = new BoardSettings(fakeStorage());
		const v = render(settings);

		v.type('1');
		await Promise.resolve();
		expect(v.input.value).toBe('1');
		expect(settings.panePct).toBe(10);
		expect(v.note()).toBe(`stored 10% of ${DECK}px · renders 420px`);

		v.type('1400');
		await Promise.resolve();
		expect(settings.panePct).toBe(41.1);
		unmount(v.app);
	});

	it('leaves the board alone when the box is emptied', async () => {
		const settings = new BoardSettings(fakeStorage());
		settings.setPx(1400, DECK);
		const v = render(settings);

		v.type('');
		await Promise.resolve();
		expect(settings.panePct).toBe(41.1);
		unmount(v.app);
	});

	// Reset means "nothing stored", not "store 38" — that is what keeps app.css
	// the single home of the default.
	it('resets to nothing stored, and says so in the box', async () => {
		const store = fakeStorage();
		const settings = new BoardSettings(store);
		const v = render(settings);

		v.type('2000');
		await Promise.resolve();
		expect(settings.panePct).not.toBeNull();

		v.reset();
		await Promise.resolve();
		expect(settings.panePct).toBeNull();
		expect(settings.deckStyle).toBeUndefined();
		expect('kfdc.settings.v1' in store.data).toBe(false);
		expect(v.input.value).toBe('1294');
		unmount(v.app);
	});

	// The readout is not decoration: on a narrow deck CSS's clamp overrides what
	// was asked for, and a popover that printed the request rather than the
	// result would be lying about what is on screen.
	it('reports what CSS will do, not what was asked for', async () => {
		const settings = new BoardSettings(fakeStorage());
		const v = render(settings, 1440);

		v.type('1200');
		await Promise.resolve();
		// Both bounds visible in one line: 1200px is 83.3% of a 1440px deck, held
		// to the stored band's 80%; 80% would still leave the board only 288px, so
		// the floor takes it the rest of the way down to what leaves 640px.
		expect(v.note()).toBe('stored 80% of 1440px · renders 786px');
		expect(1440 - 786 - 14).toBe(640);
		unmount(v.app);
	});
});
