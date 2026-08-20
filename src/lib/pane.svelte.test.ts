// PaneState's state machine, tested without a DOM. Named `.svelte.test.ts`
// because the class uses `$state` — the vitest projects partition on exactly
// that suffix (sprint 007), so a rune-using module tested under the wrong name
// runs in the wrong environment.
import { describe, expect, it } from 'vitest';
import { PaneState } from './pane.svelte';

const BASE = 'https://korg.example';

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
});
