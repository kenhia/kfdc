<script lang="ts">
	import type { Board, DepthRow } from '$lib/board';

	let {
		queue,
		omitted,
		depth
	}: {
		queue: Board['queue'];
		omitted: Board['proposals_omitted'];
		depth: DepthRow[];
	} = $props();

	// Per-project queue depth: active projects holding queued/active proposals,
	// deepest first; the tail aggregates so the list stays five rows.
	const TOP = 5;
	const ranked = $derived(
		depth
			.filter((d) => d.status === 'active' && d.proposals > 0)
			.sort((a, b) => b.proposals - a.proposals)
	);
	const top = $derived(ranked.slice(0, TOP));
	const rest = $derived(ranked.slice(TOP));
	const restSum = $derived(rest.reduce((n, d) => n + d.proposals, 0));
	// Scale bars against the aggregate row too, or shallow ties all read 100%.
	const max = $derived(Math.max(1, restSum, ...top.map((d) => d.proposals)));
</script>

<section class="panel">
	<div class="panel-head">
		<h2>On Deck</h2>
		<span class="sub">priorities of fire — queue by rank</span>
	</div>

	<table class="queue">
		<tbody>
			{#each queue as row (row.node_id)}
				<tr>
					<td class="rank"
						>{#if row.pinned}<span class="pin" title="pinned">⚑</span>{/if}{row.rank}</td
					>
					<td class="qproj"><span class="proj">{row.project}</span></td>
					<td class="qtitle">{row.title}</td>
				</tr>
			{:else}
				<tr><td class="qtitle empty">queue is empty</td></tr>
			{/each}
		</tbody>
	</table>
	<p class="queue-foot">
		omitted: {omitted.done} done, {omitted.declined} declined, {omitted.archived} archived
	</p>

	<div class="depth">
		{#each top as d (d.project)}
			<div class="drow">
				<span class="dlabel">{d.project}</span>
				<div class="dbar" style="width:{(d.proposals / max) * 100}%"></div>
				<span class="dval">{d.proposals}</span>
			</div>
		{/each}
		{#if rest.length > 0}
			<div class="drow others">
				<span class="dlabel">{rest.length} others</span>
				<div class="dbar" style="width:{(restSum / max) * 100}%"></div>
				<span class="dval">{restSum}</span>
			</div>
		{/if}
	</div>
</section>
