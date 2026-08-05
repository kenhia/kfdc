<script lang="ts">
	import { lineHref, type NetLogLine } from '$lib/netlog';

	let { lines, korgBase }: { lines: NetLogLine[]; korgBase: string } = $props();

	// Observation time, never invented precision: the muted stamp is when the
	// observing digest was assembled (kfdc #992's honesty rule).
	const ts = (l: NetLogLine) => l.observed.slice(5, 16).replace('T', ' ') + 'Z';
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
				{@const href = lineHref(l, korgBase)}
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
						<!-- href is always an absolute URL into korg's origin, not an app route -->
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
						{#if href}<a {href}>{ref(l)}</a>{:else}<span class="lref">{ref(l)}</span>{/if}
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
