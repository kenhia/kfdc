<script lang="ts">
	import type { Snippet } from 'svelte';
	import { usePane } from '$lib/pane.svelte';

	let {
		// korg's NODE id, never a wi_number. `/n/:id` resolves node ids — and for
		// a work item the two are the same number anyway since korg migration
		// 0009, so there is no conversion to get wrong, only a field name to pick
		// correctly.
		nodeId,
		title = undefined,
		class: klass = undefined,
		children
	}: {
		nodeId: number;
		title?: string;
		class?: string;
		children: Snippet;
	} = $props();

	const pane = usePane();
	const href = $derived(pane.link(nodeId));

	function open(e: MouseEvent) {
		// Modified clicks stay the browser's. ctrl/⌘/shift/alt and any
		// non-primary button mean "open korg somewhere else", and the real href
		// already honours that. Swallowing them would remove a working affordance
		// in order to add ours.
		if (!pane.enabled) return;
		if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
		e.preventDefault();
		pane.show(nodeId);
	}
</script>

<!--
  A real href, always, on every route. It is what makes ⌘-click, middle-click
  and "copy link address" work, and on the wall it is the ENTIRE affordance —
  there is no pane there to open. The pane is an enhancement on top of a link,
  never a substitute for one, which is also why this is an `<a>` and not a
  `<button>` that happens to look like one.

  href is an absolute URL into korg's origin, not an app route.
-->
<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
<a {href} {title} class={klass} onclick={open}>{@render children()}</a>
