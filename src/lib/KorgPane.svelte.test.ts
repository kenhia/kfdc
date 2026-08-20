// The pane's behaviours a pure state test cannot reach: what closes it, and
// what the header is willing to promise.
//
// The promise matters here. `close (Esc)` shipped on the sprint-016 deploy and
// was measured false in production within the hour — see the title test below.
import { mount, unmount } from 'svelte';
import { describe, expect, it } from 'vitest';
import KorgPane from './KorgPane.svelte';
import { PaneState, paneContext } from './pane.svelte';

function render(pane: PaneState) {
	const target = document.body.appendChild(document.createElement('div'));
	const app = mount(KorgPane, { target, context: paneContext(pane) });
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

	// True whenever the board holds focus, which is all jsdom can model and all
	// the board ever claims — see the title test below for the other half.
	it('closes on Escape while the board has focus', () => {
		const pane = new PaneState('https://korg.example');
		pane.show(1203);
		const v = render(pane);
		esc();
		expect(pane.open).toBe(false);
		unmount(v.app);
	});

	// THE regression guard for what the sprint-016 deploy got wrong. The button
	// said `close (Esc)` and the board could not honour it: Chromium hands focus
	// to korg's frame shortly after it loads, and a cross-origin frame's
	// keystrokes are korg's — the window saw ZERO keydowns from that moment on.
	//
	// The reclaim that would win is a timing race (measured: too early at
	// load+0ms, holds from load+50ms out past 1000ms), and its failure mode is
	// Escape silently dying — invisible to every gate in `just check`. So the
	// promise is withdrawn instead, per docs/design.md's rule that the board
	// draws no affordance it cannot honour. The ✕ is what the pane promises.
	//
	// If a later sprint takes the race on, this test is the thing to argue with.
	it('promises only what it can honour, so the title never mentions Esc', () => {
		const pane = new PaneState('https://korg.example');
		pane.show(1203);
		const v = render(pane);
		expect(v.closeBtn().title).toBe('close');
		expect(v.closeBtn().title).not.toMatch(/esc/i);
		expect(v.target.textContent).not.toMatch(/esc/i);
		unmount(v.app);
	});

	it('closes on the ✕, which is the affordance it does promise', () => {
		const pane = new PaneState('https://korg.example');
		pane.show(1203);
		const v = render(pane);
		v.closeBtn().click();
		expect(pane.open).toBe(false);
		unmount(v.app);
	});
});
