// The popover shell's contract (#1489). Two of these three tests exist because
// sprint 016 promised a keybinding the board could not honour and had to
// withdraw it in production within the hour (docs/design.md § Expanded mode).
// The lesson taken was not "never use Escape" — it was that Escape is a claim
// about FOCUS, so the focus is what gets tested.
import { createRawSnippet, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MastheadControl from './MastheadControl.svelte';

// A body of two focusables, so "focuses the first control" is a real claim
// rather than an accident of there being only one.
const body = createRawSnippet(() => ({
	render: () => `<div><input class="a" /><button class="b">b</button></div>`
}));

function render() {
	const target = document.body.appendChild(document.createElement('div'));
	const app = mount(MastheadControl, {
		target,
		props: { label: '⚙', title: 'board settings', name: 'board settings', children: body }
	});
	return {
		target,
		app,
		btn: () => target.querySelector('button.mast-btn') as HTMLButtonElement,
		pop: () => target.querySelector('.mast-pop') as HTMLDivElement | null,
		input: () => target.querySelector('input.a') as HTMLInputElement | null
	};
}

afterEach(() => {
	document.body.replaceChildren();
});

describe('MastheadControl', () => {
	it('renders only the button until it is asked for more', () => {
		const v = render();
		expect(v.pop()).toBeNull();
		expect(v.btn().getAttribute('aria-expanded')).toBe('false');
		unmount(v.app);
	});

	it('toggles open and shut from its own button', async () => {
		const v = render();
		v.btn().click();
		await Promise.resolve();
		expect(v.pop()).not.toBeNull();
		expect(v.btn().getAttribute('aria-expanded')).toBe('true');

		v.btn().click();
		await Promise.resolve();
		expect(v.pop()).toBeNull();
		unmount(v.app);
	});

	// The load-bearing one. Escape is only honourable because the popover is
	// same-origin AND holds focus; korg's cross-origin frame is what took the
	// pane's Escape away, and a popover that opened without taking focus would
	// be in exactly that position.
	it('puts focus in the popover when it opens', async () => {
		const v = render();
		v.btn().click();
		await Promise.resolve();
		expect(document.activeElement).toBe(v.input());
		unmount(v.app);
	});

	it('closes on Escape and hands focus back to the button', async () => {
		const v = render();
		v.btn().click();
		await Promise.resolve();

		v.pop()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await Promise.resolve();
		expect(v.pop()).toBeNull();
		expect(document.activeElement).toBe(v.btn());
		unmount(v.app);
	});

	// KorgPane closes the pane on a window-level Escape. One keystroke must not
	// do both — dismissing a settings popover should never cost the reader the
	// korg node they were reading.
	it('does not let its Escape reach the window, where the pane listens', async () => {
		const onWindow = vi.fn();
		window.addEventListener('keydown', onWindow);
		const v = render();
		v.btn().click();
		await Promise.resolve();

		// Every other key still belongs to the page — this is what proves the
		// stop below is Escape-shaped and not a blanket swallow.
		v.pop()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
		expect(onWindow).toHaveBeenCalledTimes(1);

		v.pop()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await Promise.resolve();
		expect(v.pop()).toBeNull();
		expect(onWindow).toHaveBeenCalledTimes(1);

		window.removeEventListener('keydown', onWindow);
		unmount(v.app);
	});

	// The dismissal that covers the case no click handler can see: focus moving
	// into the cross-origin korg frame, which reports a null relatedTarget.
	it('closes when focus leaves it altogether', async () => {
		const v = render();
		v.btn().click();
		await Promise.resolve();

		v.pop()!.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
		await Promise.resolve();
		expect(v.pop()).toBeNull();
		unmount(v.app);
	});

	it('stays open while focus moves between its own controls', async () => {
		const v = render();
		v.btn().click();
		await Promise.resolve();

		const next = v.target.querySelector('button.b') as HTMLButtonElement;
		v.pop()!.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: next }));
		await Promise.resolve();
		expect(v.pop()).not.toBeNull();
		unmount(v.app);
	});
});
