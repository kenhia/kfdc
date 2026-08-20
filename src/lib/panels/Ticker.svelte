<script lang="ts">
	import NodeRef from '$lib/NodeRef.svelte';
	import { shipped, type TickerLine } from '$lib/ticker';

	let { lines }: { lines: TickerLine[] } = $props();
</script>

<!--
  Restored to the slot the approved concept drew for it (docs/design/kfdc-concept.html,
  footer.ticker) — the Net Log took it in sprint 002, having been invented in
  #992 after the concept was approved. The two feeds now differ in FORM, which
  is #1186's division of labour made visible without a word of explanation: the
  Net Log is a vertical transcript of what this board observed, the Ticker a
  horizontal run of what korg recorded.

  Nothing renders on an empty window. korg's event log starts at migration 0026
  and was not backfilled, so "no events" is not evidence that nothing ever
  moved, and there is no empty state that says so without overstating.
-->
{#if lines.length}
	<footer class="ticker">
		{#each lines as l, i (i)}
			<span class="ev">
				<!-- Age like every other panel; korg's exact instant kept on the title. -->
				<span class="t" title={l.at}>{l.age}</span>
				<!-- Guarded because a program event carries no project (#1197): an
				     unguarded span still costs its 6px flex gap. Same rule, same
				     reason, as NetLog.svelte. -->
				{#if l.project}<span class="lp">{l.project}</span>{/if}
				<!-- Every kind links (#1203). The printed ref stays korg's human number;
				     the link is by node id, which is what korg's resolver takes. -->
				<NodeRef nodeId={l.node_id}>{l.ref}</NodeRef>
				<span class="tr" class:ship={shipped(l)}>{l.transition}</span>
				<span class="tx">{l.text}</span>
			</span>
		{/each}
		<span class="src-note">feed: korg transitions · newest 20</span>
	</footer>
{/if}
