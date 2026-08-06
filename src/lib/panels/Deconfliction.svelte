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

	{#each cards as c (`${c.kind}:${c.left.node_id}:${c.right.node_id}`)}
		<div class="conflict" class:seq={c.kind === 'after'}>
			<div class="row1">
				<span class="node-chip" title={c.left.title}>{c.left.project} {c.left.node_id}</span>
				<span class="vs">{c.kind === 'collides-with' ? '⟂ SAME CONTRACT' : '⟵ AFTER'}</span>
				<span class="node-chip" title={c.right.title}>{c.right.project} {c.right.node_id}</span>
			</div>
			{#if c.why}<p>{c.why}</p>{/if}
			<span class="src">{src(c)}</span>
		</div>
	{:else}
		<p class="empty">no collisions on the board — fires deconflicted</p>
	{/each}
</section>
