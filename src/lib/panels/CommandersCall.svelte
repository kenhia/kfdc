<script lang="ts">
	import { formatAge, type AwaitingRow } from '$lib/board';

	let { awaiting, generated }: { awaiting: AwaitingRow[]; generated: string } = $props();

	// Read-only lane: acting on an ask happens in korg (korg #981), not here.
	const ref = (row: AwaitingRow) =>
		row.kind === 'workitem' && row.wi_number != null ? `#${row.wi_number}` : `korg:${row.node_id}`;
</script>

<section class="panel">
	<div class="panel-head">
		<h2>Commander's Call</h2>
		<span class="sub">blocked on you — nothing else moves these</span>
	</div>

	{#each awaiting as row (row.node_id)}
		<div class="call">
			<div class="row1">
				{#if row.project}<span class="proj">{row.project}</span>{/if}
				<span class="id">{ref(row)}</span>
				<span class="age">{row.kind} · {formatAge(generated, row.awaiting_since)}</span>
			</div>
			<h3>{row.title}</h3>
			{#if row.awaiting_note}<p>{row.awaiting_note}</p>{/if}
		</div>
	{:else}
		<p class="empty">nothing awaiting you — clear board</p>
	{/each}
</section>
