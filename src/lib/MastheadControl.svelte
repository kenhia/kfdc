<script lang="ts">
	import type { Snippet } from 'svelte';

	// A masthead control: a button in the statline and the popover it opens
	// (#1489, sprint 017). The settings gear is the first one; #1202's transmit
	// drawer is the next, and it should be able to supply contents and nothing
	// else. So this owns everything that is about being a popover — open state,
	// focus, dismissal — and knows nothing about what is inside it.
	//
	// Desk only. `Board.svelte` does not render this on the wall at all: nobody
	// is at the keyboard there, and *the wall draws no affordance it cannot
	// honour* (docs/design.md § Wall mode) — the same rule that renders On Deck's
	// roll-up as text and hands the wall a disabled pane.
	let {
		// What the button shows. A glyph, so it stays the size of the statline.
		label,
		// The button's tooltip AND its accessible name — a glyph has no text to
		// fall back on.
		title,
		// The popover's accessible name.
		name,
		children
	}: { label: string; title: string; name: string; children: Snippet } = $props();

	let open = $state(false);
	let root = $state<HTMLDivElement | null>(null);
	let panel = $state<HTMLDivElement | null>(null);
	let btn = $state<HTMLButtonElement | null>(null);

	// The popover MUST take focus when it opens, and that is not a nicety: it is
	// the entire reason Escape can work here at all. Sprint 016 shipped an
	// advertised `close (Esc)` on the pane and had to withdraw it, because
	// Chromium hands focus to the cross-origin korg frame and the board's window
	// then sees zero keydowns (docs/design.md § Expanded mode). A same-origin
	// popover has no such problem — provided it actually holds focus, which is
	// what this does and what MastheadControl.svelte.test.ts holds it to.
	$effect(() => {
		if (!open || !panel) return;
		// The first control if there is one, so the reader can type immediately;
		// the panel itself otherwise, so focus is still inside either way.
		const first = panel.querySelector<HTMLElement>(
			'input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"])'
		);
		(first ?? panel).focus();
	});

	function dismiss() {
		open = false;
		btn?.focus();
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key !== 'Escape' || !open) return;
		// Stopped here deliberately. KorgPane listens for Escape on the *window*
		// to close the pane, so without this one keystroke would close both — and
		// dismissing a settings popover would cost the reader the korg node they
		// were reading. Bubbling stops at this element, well before the window.
		e.stopPropagation();
		dismiss();
	}

	function onfocusout(e: FocusEvent) {
		if (!open) return;
		if (e.relatedTarget instanceof Node && root?.contains(e.relatedTarget)) return;
		// `relatedTarget` is null both when focus falls to the page body and when
		// it goes into the cross-origin korg frame. Either way the reader has moved
		// on, and a popover left floating over the board is clutter. This is also
		// the only dismissal that works when the click lands *inside* the iframe,
		// which fires no event this document can see.
		open = false;
	}
</script>

<div class="mast-control" bind:this={root} {onfocusout}>
	<button
		class="mast-btn"
		bind:this={btn}
		type="button"
		{title}
		aria-label={title}
		aria-haspopup="dialog"
		aria-expanded={open}
		onclick={() => (open = !open)}>{label}</button
	>
	{#if open}
		<!-- The children render only while open, which is what lets a popover body
		     hold its own draft state and initialise it fresh on every open — no
		     effect racing the reader's keystrokes to keep a stale number current. -->
		<div
			class="mast-pop"
			bind:this={panel}
			role="dialog"
			aria-label={name}
			tabindex="-1"
			{onkeydown}
		>
			{@render children()}
		</div>
	{/if}
</div>
