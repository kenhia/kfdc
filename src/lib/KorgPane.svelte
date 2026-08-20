<script lang="ts">
	import { usePane } from '$lib/pane.svelte';

	const pane = usePane();
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && pane.open) pane.close();
	}}
/>

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
			<iframe class="pane-frame" title="korg — node {pane.node}" src={pane.href}></iframe>
		{/key}
	</aside>
{/if}
