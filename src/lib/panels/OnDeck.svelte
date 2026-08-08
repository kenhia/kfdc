<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { onDeckRows, type Board, type DepthRow, type ProgramRow } from '$lib/board';

	let {
		queue,
		omitted,
		depth,
		programs
	}: {
		queue: Board['queue'];
		omitted: Board['proposals_omitted'];
		depth: DepthRow[];
		programs: ProgramRow[];
	} = $props();

	// #1064: a program's queued slices collapse into one row — the sequence is
	// already declared, so listing it again adds rows, not information.
	// Expanding restores the individual slices for the one time it is wanted.
	const rows = $derived(onDeckRows(queue, programs));
	const expanded = new SvelteSet<number>();
	function toggle(node_id: number) {
		if (!expanded.delete(node_id)) expanded.add(node_id);
	}

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
			{#each rows as r (r.kind === 'program' ? `p${r.program.node_id}` : r.row.node_id)}
				{#if r.kind === 'proposal'}
					<tr>
						<td class="rank"
							>{#if r.row.pinned}<span class="pin" title="pinned">⚑</span>{/if}{r.row.rank}</td
						>
						<td class="qproj"><span class="proj">{r.row.project}</span></td>
						<td class="qtitle">{r.row.title}</td>
					</tr>
				{:else}
					{@const open = expanded.has(r.program.node_id)}
					<tr class="prog-roll">
						<td class="rank"
							>{#if r.pinned}<span class="pin" title="pinned">⚑</span>{/if}{r.rank}</td
						>
						<td class="qproj"
							>{#each r.program.span as proj (proj)}<span class="proj">{proj}</span>{/each}</td
						>
						<td class="qtitle">
							<button
								class="roll"
								aria-expanded={open}
								title="{r.slices.length} queued slices — {open ? 'collapse' : 'expand'}"
								onclick={() => toggle(r.program.node_id)}
							>
								<span class="caret">{open ? '▾' : '▸'}</span>
								<span class="op-tag">program</span>
								<span class="roll-t">{r.program.title}</span>
								<span class="rem">{r.remaining} of {r.total} slices</span>
							</button>
						</td>
					</tr>
					{#if open}
						{#each r.slices as s (s.node_id)}
							<tr class="prog-slice">
								<td class="rank">{s.rank}</td>
								<td class="qproj"><span class="proj">{s.project}</span></td>
								<td class="qtitle">{s.title}</td>
							</tr>
						{/each}
					{/if}
				{/if}
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
