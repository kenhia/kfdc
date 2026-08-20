<script lang="ts">
	import { usePane } from '$lib/pane.svelte';

	const pane = usePane();

	// The close button, so the pane can keep keyboard focus on the BOARD's side
	// of the frame boundary — see `holdFocus` below.
	let closeBtn = $state<HTMLButtonElement | null>(null);

	// Escape only reaches this handler while focus is in the board's document.
	// A cross-origin frame's keystrokes are korg's and nothing here can see
	// them, which is a browser boundary, not a choice — `holdFocus` is what
	// keeps the common case on this side of it.
	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && pane.open) pane.close();
	}

	// Chromium focuses a freshly loaded iframe. Measured against production on
	// the sprint-016 deploy: `document.activeElement` became `IFRAME.pane-frame`
	// about a second after the pane opened, and from that moment the window saw
	// ZERO keydowns — so the header's `close (Esc)` was an affordance the board
	// could not honour, which is the one thing docs/design.md forbids outright.
	//
	// So focus is taken back once, on load. The trade is deliberate: while you
	// are *reading* the node, Escape closes the pane; the moment you click into
	// korg to *work*, focus is korg's and so is Escape. Nothing is stolen from a
	// user who is typing, because a user who just clicked a ref on the board is
	// not typing yet. The ✕ is the unconditional affordance either way.
	function holdFocus() {
		closeBtn?.focus();
	}
</script>

<svelte:window {onkeydown} />

{#if pane.open}
	<aside class="korg-pane">
		<div class="pane-head">
			<span class="pane-id">korg:{pane.node}</span>
			<span class="pane-sub">live korg — edit here, not on the board</span>
			<!-- The escape hatch a pane always owes: a 700px column is the wrong
			     place for some of korg's pages, and this hands the same URL to a
			     full window rather than making the reader re-find the node.
			     href is korg's origin, not an app route. -->
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a class="pane-out" href={pane.href} target="_blank" rel="noreferrer">open in korg ↗</a>
			<button
				bind:this={closeBtn}
				class="pane-x"
				title="close (Esc)"
				aria-label="close pane"
				onclick={() => pane.close()}>✕</button
			>
		</div>
		<!--
		  Keyed on the node so a NEW iframe element is created for each one rather
		  than the src being reassigned on the existing element. Reassigning
		  `iframe.src` pushes an entry onto the TOP-LEVEL session history, which
		  hands the board a Back button that silently rewinds the pane instead of
		  leaving the board — the classic iframe trap. `location.replace` is the
		  other fix and is unavailable to us: korg is cross-origin, which is the
		  whole reason the CSP allowlist (GP-17) exists.

		  Sandboxing is deliberately NOT set. korg needs its own scripts, forms and
		  same-origin storage to be the real editor this pane exists to provide,
		  and a sandbox tight enough to be worth anything would break exactly that.
		  The perimeter here is the tailnet, per GP-17 — the frame-ancestors header
		  decides who may paint korg, and it is not an access-control list.
		-->
		{#key pane.node}
			<iframe class="pane-frame" title="korg — node {pane.node}" src={pane.href} onload={holdFocus}
			></iframe>
		{/key}
	</aside>
{/if}
