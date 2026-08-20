// PaneState's state machine, tested without a DOM. Named `.svelte.test.ts`
// because the class uses `$state` — the vitest projects partition on exactly
// that suffix (sprint 007), so a rune-using module tested under the wrong name
// runs in the wrong environment.
import { describe, expect, it } from 'vitest';
import { PANE_STORAGE_KEY, PaneState } from './pane.svelte';
import type { StorageLike } from './settings.svelte';

const BASE = 'https://korg.example';

/** A plain object standing in for sessionStorage, so persistence is testable
 *  without a DOM — the same reason this whole module lives outside a component. */
function store(seed: string | null = null): StorageLike & { value: string | null } {
	return {
		value: seed,
		getItem() {
			return this.value;
		},
		setItem(_k: string, v: string) {
			this.value = v;
		},
		removeItem() {
			this.value = null;
		}
	};
}

describe('PaneState', () => {
	it('starts closed and opens on the node it was shown', () => {
		const p = new PaneState(BASE);
		expect(p.open).toBe(false);
		expect(p.node).toBeNull();
		expect(p.href).toBeNull();

		p.show(1203);
		expect(p.open).toBe(true);
		expect(p.href).toBe('https://korg.example/n/1203');
	});

	it('retargets in place rather than stacking panes', () => {
		const p = new PaneState(BASE);
		p.show(1203);
		p.show(1470);
		expect(p.node).toBe(1470);
		expect(p.href).toBe('https://korg.example/n/1470');
	});

	it('closes back to nothing', () => {
		const p = new PaneState(BASE);
		p.show(1203);
		p.close();
		expect(p.open).toBe(false);
		expect(p.node).toBeNull();
		expect(p.href).toBeNull();
	});

	// The wall's half of #1203. The wall is a display mode with nobody at the
	// keyboard, so it gets a pane that cannot open — and `show` is a no-op
	// rather than a throw, so every panel behaves correctly on both routes
	// without carrying a `wall` prop just to decide whether a ref is clickable.
	describe('disabled (wall mode)', () => {
		it('never opens, however hard it is asked', () => {
			const p = new PaneState(BASE, false);
			p.show(1203);
			expect(p.open).toBe(false);
			expect(p.node).toBeNull();
			expect(p.href).toBeNull();
		});

		// The link is not the pane. Refs on the wall have always been real
		// anchors into korg and they stay that way — what the wall withdraws is
		// the pane, not the address.
		it('still builds korg links', () => {
			const p = new PaneState(BASE, false);
			expect(p.enabled).toBe(false);
			expect(p.link(1203)).toBe('https://korg.example/n/1203');
		});
	});

	// One place knows what a korg URL looks like (GP-16). If `link` ever stops
	// agreeing with `href`, two of them do.
	it('builds hrefs and links through the same rule', () => {
		const p = new PaneState(BASE);
		p.show(1470);
		expect(p.href).toBe(p.link(1470));
	});

	// #1496. The desk board no longer reloads to refresh, so the pane survives by
	// simply not unmounting — but the app window's own refresh control is browser
	// chrome and can never be intercepted, and neither can Ctrl+R while focus is
	// inside korg's frame. This is the floor under those two.
	describe('surviving a reload the page could not intercept', () => {
		it('writes the open node, and clears it again on close', () => {
			const st = store();
			const p = new PaneState(BASE, true, st);
			p.show(1203);
			expect(st.value).toBe(JSON.stringify({ node: 1203 }));

			p.show(1470);
			expect(st.value).toBe(JSON.stringify({ node: 1470 }));

			// Cleared, not left behind: a pane Ken deliberately closed must not
			// reopen on the next reload.
			p.close();
			expect(st.value).toBeNull();
		});

		it('reopens on the node the tab had open', () => {
			const p = new PaneState(BASE, true, store(JSON.stringify({ node: 1203 })));
			expect(p.open).toBe(false);
			p.restore();
			expect(p.node).toBe(1203);
			expect(p.href).toBe('https://korg.example/n/1203');
		});

		it('opens nothing when the tab had nothing open', () => {
			const p = new PaneState(BASE, true, store());
			p.restore();
			expect(p.node).toBeNull();
		});

		// Anything at all can be in a web store. Every one of these opens nothing
		// rather than throwing — a board that throws on load is worse than a board
		// that forgot which node you were reading.
		it.each([
			['not JSON at all', 'not json{'],
			['a bare number', '1203'],
			['null', 'null'],
			['the wrong field', JSON.stringify({ panePct: 41 })],
			['a string node', JSON.stringify({ node: '1203' })],
			// `/n/1203.5` is a URL korg never served — the class of bug GP-16 exists
			// to prevent, and there is no reason to let a stored value reintroduce it.
			['a fractional node', JSON.stringify({ node: 1203.5 })],
			['a zero node', JSON.stringify({ node: 0 })],
			['a negative node', JSON.stringify({ node: -1 })],
			['NaN survived as null', JSON.stringify({ node: NaN })]
		])('opens nothing for %s', (_label, raw) => {
			const p = new PaneState(BASE, true, store(raw));
			p.restore();
			expect(p.node).toBeNull();
		});

		// Private modes throw on the property access itself.
		it('opens nothing when the store itself throws', () => {
			const hostile: StorageLike = {
				getItem() {
					throw new Error('SecurityError');
				},
				setItem() {
					throw new Error('SecurityError');
				},
				removeItem() {
					throw new Error('SecurityError');
				}
			};
			const p = new PaneState(BASE, true, hostile);
			expect(() => p.restore()).not.toThrow();
			expect(p.node).toBeNull();
			// And the board keeps working: what it costs is a restore, never a pane.
			expect(() => p.show(1203)).not.toThrow();
			expect(p.node).toBe(1203);
		});

		// The wall gets a disabled pane, so it has nothing to persist and nothing
		// to restore — and must never inherit a pane from a desk session in the
		// same browser. Belt and braces: the wall passes no storage at all, and a
		// disabled pane drops any it is handed.
		it('persists and restores nothing on the wall', () => {
			const st = store(JSON.stringify({ node: 1203 }));
			const p = new PaneState(BASE, false, st);
			p.restore();
			expect(p.node).toBeNull();

			p.show(1203);
			expect(p.node).toBeNull();
			// Untouched — a disabled pane is not a writer.
			expect(st.value).toBe(JSON.stringify({ node: 1203 }));
		});

		// One key holding an object, same shape rule as the settings store: a
		// second pane preference is an added field, not a format migration.
		it('keeps its own key, separate from the settings store', () => {
			expect(PANE_STORAGE_KEY).toBe('kfdc.pane.v1');
			const st = store();
			new PaneState(BASE, true, st).show(1203);
			expect(JSON.parse(st.value!)).toEqual({ node: 1203 });
		});
	});
});
