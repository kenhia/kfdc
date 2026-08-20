// The pane's two behaviours a pure state test cannot reach: Escape closing it,
// and taking keyboard focus back from the iframe once it loads.
//
// The focus one is not decoration. Production measurement on the sprint-016
// deploy: Chromium moved `document.activeElement` to `IFRAME.pane-frame` about
// a second after the pane opened, and the window then saw ZERO keydowns — so
// the header's `close (Esc)` was an affordance the board could not honour.
import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it } from 'vitest';
import KorgPane from './KorgPane.svelte';
import { PaneState, paneContext } from './pane.svelte';

function render(pane: PaneState) {
	const target = document.body.appendChild(document.createElement('div'));
	const app = mount(KorgPane, { target, context: paneContext(pane) });
	// `bind:this` lands in an effect, and effects flush asynchronously. In a
	// browser the frame's load event arrives long after mount, so this only
	// stands in for the time the real thing has anyway.
	flushSync();
	return {
		target,
		app,
		aside: () => target.querySelector('aside.korg-pane'),
		frame: () => target.querySelector('iframe.pane-frame') as HTMLIFrameElement,
		closeBtn: () => target.querySelector('button.pane-x') as HTMLButtonElement
	};
}

const esc = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

describe('KorgPane', () => {
	it('renders nothing at all while closed', () => {
		const v = render(new PaneState('https://korg.example'));
		expect(v.aside()).toBeNull();
		unmount(v.app);
	});

	it('frames the node korg was asked for', () => {
		const pane = new PaneState('https://korg.example');
		pane.show(1203);
		const v = render(pane);
		expect(v.frame().getAttribute('src')).toBe('https://korg.example/n/1203');
		expect(v.target.querySelector('.pane-id')!.textContent).toBe('korg:1203');
		// The escape hatch, pointing at the same node in a full window.
		expect(v.target.querySelector('a.pane-out')!.getAttribute('href')).toBe(
			'https://korg.example/n/1203'
		);
		unmount(v.app);
	});

	it('closes on Escape', () => {
		const pane = new PaneState('https://korg.example');
		pane.show(1203);
		const v = render(pane);
		esc();
		expect(pane.open).toBe(false);
		unmount(v.app);
	});

	// The fix for the production failure above. Without it Escape is dead from
	// the moment the frame finishes loading, which is most of the pane's life.
	it('takes keyboard focus back from the frame when it loads', () => {
		const pane = new PaneState('https://korg.example');
		pane.show(1203);
		const v = render(pane);

		// Stand in for Chromium focusing the freshly loaded frame.
		v.frame().dispatchEvent(new Event('load'));
		expect(document.activeElement).toBe(v.closeBtn());

		// And the consequence that actually matters: Escape still reaches us.
		esc();
		expect(pane.open).toBe(false);
		unmount(v.app);
	});

	it('closes on the ✕, which is the unconditional affordance', () => {
		const pane = new PaneState('https://korg.example');
		pane.show(1203);
		const v = render(pane);
		v.closeBtn().click();
		expect(pane.open).toBe(false);
		unmount(v.app);
	});
});
