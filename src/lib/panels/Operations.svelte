<script lang="ts">
	import { progress, type Board, type ProgramRow, type ProgramSlice } from '$lib/board';

	let { programs, omitted }: { programs: ProgramRow[]; omitted: Board['programs_omitted'] } =
		$props();

	// Slice chip state: done → checked off, active → in motion, anything else
	// (proposed) → still ahead. The glyph carries it; color reinforces.
	function state(s: ProgramSlice): 'done' | 'now' | 'next' {
		return s.status === 'done' ? 'done' : s.status === 'active' ? 'now' : 'next';
	}
	const MARK = { done: '✓', now: '▶', next: '·' } as const;
</script>

<section class="panel">
	<div class="panel-head">
		<h2>Operations</h2>
		<span class="sub">multi-project programs — ordered single-project slices</span>
	</div>

	{#each programs as prog (prog.node_id)}
		<div
			class="op"
			class:holding={prog.status === 'holding'}
			class:op-done={prog.status === 'done'}
		>
			<div class="row1">
				<h3>{prog.title}</h3>
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
					<span class="slice s-{st}" title={s.title}>
						<span class="mark">{MARK[st]}</span>
						<span class="proj">{s.project}</span>
						<span class="slice-t">{s.title}</span>
						<span class="s-cnt"
							>{p.complete}/{p.total}{#if p.verified > 0}
								<span class="ver">{p.verified}✓</span>{/if}</span
						>
					</span>
				{/each}
			</div>
		</div>
	{:else}
		<p class="empty">no programs in motion — single-tube fires only</p>
	{/each}

	<p class="queue-foot">omitted: {omitted.done} done, {omitted.archived} archived</p>
</section>
