<script lang="ts">
	import { progress, type Board, type ProgramRow, type ProgramSlice } from '$lib/board';
	import NodeRef from '$lib/NodeRef.svelte';

	let {
		programs,
		omitted,
		// Parked programs this board chose not to draw (#1540) — kfdc's own
		// hiding, named the way korg's is (docs/design.md: nothing disappears
		// silently).
		parkedHidden = 0
	}: {
		programs: ProgramRow[];
		omitted: Board['programs_omitted'];
		parkedHidden?: number;
	} = $props();

	// Slice chip state, switched on korg's proposal literal: done → checked
	// off, active → in motion, declined → dropped, anything else (proposed) →
	// still ahead. The glyph carries it; color reinforces.
	//
	// `declined` used to fall into "still ahead" and sit pending forever, which
	// also disagreed with board.ts's PROPOSAL_FINISHED — the same korg fact
	// defined twice in one repo, which is the #1196 shape.
	function state(s: ProgramSlice): 'done' | 'now' | 'dropped' | 'next' {
		if (s.status === 'done') return 'done';
		if (s.status === 'active') return 'now';
		if (s.status === 'declined') return 'dropped';
		return 'next';
	}
	const MARK = { done: '✓', now: '▶', dropped: '✕', next: '·' } as const;
</script>

<section class="panel">
	<div class="panel-head">
		<h2>Operations</h2>
		<span class="sub">multi-project programs — ordered single-project slices</span>
	</div>

	{#each programs as prog (prog.node_id)}
		<!-- One card class per korg status literal (#1444). Not a predicate per
		     state: a predicate leaves every unmatched literal wearing the base
		     treatment, which is how `queued` arrived from korg 069 and read as
		     ACTIVE. The base is neutral now, so an unknown literal is quiet. -->
		<div class="op op-{prog.status}">
			<div class="row1">
				<h3><NodeRef nodeId={prog.node_id} title="korg:{prog.node_id}">{prog.title}</NodeRef></h3>
				<span class="status {prog.status}">{prog.status}</span>
				<span class="span-chips">
					{#each prog.span as proj (proj)}<span class="proj">{proj}</span>{/each}
				</span>
			</div>
			<p class="aim" title={prog.aim}>{prog.aim}</p>
			<!-- Slices in korg's rank order; chips joined by a plain arrow that
			     points with time, per the #1027 decision — no sequence words. -->
			<div class="slices">
				{#each prog.slices as s, i (s.node_id)}
					{@const st = state(s)}
					{@const p = progress(s)}
					{#if i > 0}<span class="arrow">→</span>{/if}
					<NodeRef nodeId={s.node_id} class="slice s-{st}" title={s.title}>
						<span class="mark">{MARK[st]}</span>
						<span class="proj">{s.project}</span>
						<span class="slice-t">{s.title}</span>
						<span class="s-cnt"
							>{p.complete}/{p.total}{#if p.verified > 0}
								<span class="ver">{p.verified}✓</span>{/if}</span
						>
					</NodeRef>
				{/each}
			</div>
		</div>
	{:else}
		<p class="empty">no programs in motion — single-tube fires only</p>
	{/each}

	<p class="queue-foot">
		omitted: {omitted.done} done, {omitted.archived} archived{#if parkedHidden}<span
				class="parked-hid">· {parkedHidden} parked, hidden by a board setting</span
			>{/if}
	</p>
</section>
