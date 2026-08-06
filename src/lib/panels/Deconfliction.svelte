<script lang="ts">
	import type { Board } from '$lib/board';
	import { deconfliction } from '$lib/curator';

	let { board }: { board: Board } = $props();

	const cards = $derived(deconfliction(board));

	// Provenance line: prefer the mined-from citation; otherwise say how the
	// edge got here — a curator edge without prose is still a curator edge,
	// and a write-time edge is the roadmap's direction of travel.
	function src(card: (typeof cards)[number]): string {
		if (card.minedFrom) return `mined from: ${card.minedFrom}`;
		if (card.origin === 'kfdc-curator') return 'mined by curator';
		return card.origin ? `recorded at write time (${card.origin})` : 'recorded at write time';
	}
</script>

<section class="panel">
	<div class="panel-head">
		<h2>Deconfliction</h2>
		<span class="sub">collisions &amp; sequencing</span>
	</div>

	<!-- Chips read left-to-right in execution order (kfdc #1027): the arrow
	     points with time and needs no sequence words; the ⟂ form stays
	     symmetric because collisions are unordered. -->
	{#each cards as c (`${c.kind}:${c.chips[0].node_id}:${c.chips[1].node_id}`)}
		<div class="conflict" class:seq={c.kind === 'after'}>
			<div class="row1">
				<span class="node-chip" title={c.chips[0].title}
					>{c.chips[0].project} {c.chips[0].node_id}</span
				>
				<span class="vs">{c.kind === 'collides-with' ? '⟂ SAME CONTRACT ⟂' : '→'}</span>
				<span class="node-chip" title={c.chips[1].title}
					>{c.chips[1].project} {c.chips[1].node_id}</span
				>
			</div>
			{#if c.why}<p>{c.why}</p>{/if}
			<span class="src">{src(c)}</span>
		</div>
	{:else}
		<p class="empty">no collisions on the board — fires deconflicted</p>
	{/each}
</section>
