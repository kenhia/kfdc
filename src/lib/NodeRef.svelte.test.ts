// NodeRef's whole job is a click policy, and a click policy is only testable
// through the DOM.
import { createRawSnippet, mount, unmount } from 'svelte';
import { describe, expect, it } from 'vitest';
import NodeRef from './NodeRef.svelte';
import { PaneState, paneContext } from './pane.svelte';

const BASE = 'https://korg.example';

// The ref's visible label. NodeRef is a wrapper — what it wraps is the caller's.
const label = createRawSnippet(() => ({ render: () => '<span>ref</span>' }));

function render(pane: PaneState, nodeId = 1203) {
	const target = document.body.appendChild(document.createElement('div'));
	const app = mount(NodeRef, {
		target,
		context: paneContext(pane),
		props: { nodeId, children: label }
	});
	return { target, app, a: () => target.querySelector('a') as HTMLAnchorElement };
}

// A left-click with no modifiers, which is the only one NodeRef may take.
const plain = () => new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });

describe('NodeRef', () => {
	it('renders a real korg href, not a bare click handler', () => {
		const pane = new PaneState(BASE);
		const v = render(pane);
		expect(v.a().getAttribute('href')).toBe('https://korg.example/n/1203');
		unmount(v.app);
	});

	it('opens the pane on a plain click and suppresses the navigation', () => {
		const pane = new PaneState(BASE);
		const v = render(pane);
		const e = plain();
		v.a().dispatchEvent(e);
		expect(pane.node).toBe(1203);
		expect(e.defaultPrevented).toBe(true);
		unmount(v.app);
	});

	// The affordance the href already promises must keep working. Hijacking a
	// ⌘-click would take away "open korg in a tab" in order to add the pane,
	// which is a trade nobody asked for.
	it.each([
		['meta', { metaKey: true }],
		['ctrl', { ctrlKey: true }],
		['shift', { shiftKey: true }],
		['alt', { altKey: true }],
		['middle button', { button: 1 }]
	])('leaves a %s click to the browser', (_name, init) => {
		const pane = new PaneState(BASE);
		const v = render(pane);
		const e = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init });
		v.a().dispatchEvent(e);
		expect(pane.node).toBeNull();
		expect(e.defaultPrevented).toBe(false);
		unmount(v.app);
	});

	// Wall mode. The ref stays a link — it always was one — but there is no pane
	// to open, so the click is the browser's and nothing is swallowed. A board
	// that preventDefault'd here would leave a dead link on an unattended
	// screen, which is precisely the affordance-it-cannot-honour failure that
	// sprint 014's rule exists to prevent.
	it('stays an ordinary link when the pane is disabled', () => {
		const pane = new PaneState(BASE, false);
		const v = render(pane);
		const e = plain();
		v.a().dispatchEvent(e);
		expect(pane.open).toBe(false);
		expect(e.defaultPrevented).toBe(false);
		expect(v.a().getAttribute('href')).toBe('https://korg.example/n/1203');
		unmount(v.app);
	});
});
