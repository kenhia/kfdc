<script lang="ts">
	import { formatAge, type ReportRow } from '$lib/board';

	let { reports, generated }: { reports: ReportRow[]; generated: string } = $props();

	// Status → light, form + color together (design rule): the status word is
	// in the title attribute and the escalated flag is text, never color alone.
	const light = (r: ReportRow) =>
		r.status === 'problem' ? 'r' : r.status === 'attention' ? 'a' : 'g';
</script>

<section class="panel">
	<div class="panel-head">
		<h2>Sensor Net</h2>
		<span class="sub">reports — health &amp; risk</span>
	</div>

	<ul class="health">
		{#each reports as r (r.node_id)}
			<li>
				<span class="light {light(r)}" title={r.status}></span>
				<span>
					<b>{r.source}</b>
					{r.summary}
					{#if r.escalated}<span class="esc">ESCALATED</span>{/if}
					<span class="age">{formatAge(generated, r.report_date)}</span>
				</span>
			</li>
		{:else}
			<li class="net-silent">net silent — no reports</li>
		{/each}
	</ul>
</section>
