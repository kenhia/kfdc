<script lang="ts">
	import NodeRef from '$lib/NodeRef.svelte';
	import { type NetLogLine } from '$lib/netlog';

	let { lines }: { lines: NetLogLine[] } = $props();

	// Observation time, never invented precision: the muted stamp is when the
	// observing digest was assembled (kfdc #992's honesty rule).
	const ts = (l: NetLogLine) => l.observed.slice(5, 16).replace('T', ' ') + 'Z';
	// The ref the operator reads is still korg's human number — a WI by its
	// wi_number where there is one. The ref the LINK uses is always the node id
	// (NodeRef), which for a work item is the same number anyway.
	const ref = (l: NetLogLine) => String(l.wi_number ?? l.node_id);
</script>

<div class="netlog-strip">
	<section class="panel">
		<div class="panel-head">
			<h2>Net Log</h2>
			<span class="sub">radio traffic on the fires net — observed times, last 20</span>
		</div>
		<div class="traffic">
			{#each lines as l, i (i)}
				<div class="line">
					<span class="t">{ts(l)}</span>
					<span class="body">
						<span class="pc {l.panel.toLowerCase()}">{l.panel}:</span>
						{#if l.panel === 'CC'}
							{l.verb} -
						{:else}
							{l.verb}
						{/if}
						{#if l.project}<span class="lp">{l.project}</span>{/if}
						<!-- Every kind links now (#1203): korg resolves the id to its own
						     page, so the plain-text fallback this line used to need for six
						     of nine kinds has nothing left to fall back FROM. -->
						<NodeRef nodeId={l.node_id}>{ref(l)}</NodeRef>
						{#if l.panel === 'CC'}
							{l.text}
						{:else}
							- {l.text}
						{/if}
					</span>
				</div>
			{:else}
				<p class="empty">no traffic observed — the net is quiet</p>
			{/each}
		</div>
	</section>
</div>
