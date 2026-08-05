<script lang="ts">
	import { progress, type ProposalRow } from '$lib/board';

	let { active }: { active: ProposalRow[] } = $props();

	// Track segment states, three-part per korg #980: Ken-verified (closed) as
	// green, work-complete-but-unverified as amber, remainder as unfilled.
	function segments(row: ProposalRow): ('verified' | 'complete' | 'open')[] {
		const p = progress(row);
		return Array.from({ length: p.total }, (_, i) =>
			i < p.verified ? 'verified' : i < p.complete ? 'complete' : 'open'
		);
	}
</script>

<section class="panel">
	<div class="panel-head">
		<h2>Fire Missions</h2>
		<span class="sub">active sprints</span>
	</div>

	{#each active as row (row.node_id)}
		{@const p = progress(row)}
		<div class="mission-card">
			<div class="row1">
				<span class="proj">{row.project}</span>
				<span class="id">korg:{row.node_id}</span>
				<span class="status active">firing</span>
			</div>
			<h3>{row.title}</h3>
			<p>{row.summary}</p>
			<div class="wi-track">
				{#each segments(row) as state, i (i)}
					<i class={state}></i>
				{/each}
				<span class="cnt">
					{p.complete}/{p.total} WIs{#if p.verified > 0}
						· <span class="ver">{p.verified} ✓ Ken</span>{/if}
				</span>
			</div>
		</div>
	{:else}
		<p class="empty">no active sprints — the tubes are cold</p>
	{/each}
</section>
