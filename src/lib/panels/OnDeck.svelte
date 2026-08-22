<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { onDeckRows, type Board, type DepthRow, type ProgramRow } from '$lib/board';
	import NodeRef from '$lib/NodeRef.svelte';

	let {
		queue,
		omitted,
		parkedHidden = 0,
		depth,
		programs,
		// Wall mode (#1204): nobody is at the keyboard, so nothing here offers to
		// be operated. See the roll-up below — this is the only panel that had
		// anything to withdraw.
		wall = false
	}: {
		queue: Board['queue'];
		omitted: Board['proposals_omitted'];
		/**
		 * Parked rows this board chose not to draw (#1540). Distinct from
		 * `omitted`, which is what korg withheld — and printed distinctly, because
		 * one is undone by a checkbox and the other is not.
		 */
		parkedHidden?: number;
		depth: DepthRow[];
		programs: ProgramRow[];
		wall?: boolean;
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

<!-- One body, two wrappers (below): the wall's row must not drift from the
     desk's by being written twice. -->
{#snippet rollBody(program: ProgramRow, remaining: number, total: number)}
	<span class="op-tag">program</span>
	<span class="roll-t">{program.title}</span>
	<span class="rem">{remaining} of {total} slices</span>
{/snippet}

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
						<!-- The parked marker (#1540). Without it, a queue row korg calls
						     parked is indistinguishable from one it calls proposed the
						     moment the setting is on — which is to say, invisible to the
						     only reader who asked to see it. Found by looking at the real
						     board, not by a test: the palette gate reaches the program
						     literals and had nothing to say about a queue row.
						     Inside the `.chips` wrapper so it wraps with the project chip
						     rather than extending the unbreakable run #1284 measured. -->
						<td class="qproj"
							><span class="chips"
								><span class="proj">{r.row.project}</span>{#if r.row.status === 'parked'}<span
										class="status parked">parked</span
									>{/if}</span
							></td
						>
						<!-- The queue has no id column to link, so the title carries it
						     (#1203). The program roll-up row below deliberately does NOT:
						     its one click already belongs to the expand control, and two
						     things wanting the same click is how an affordance stops
						     meaning one thing. -->
						<td class="qtitle"
							><NodeRef nodeId={r.row.node_id} title="korg:{r.row.node_id}">{r.row.title}</NodeRef
							></td
						>
					</tr>
				{:else}
					{@const open = expanded.has(r.program.node_id)}
					<tr class="prog-roll">
						<td class="rank"
							>{#if r.pinned}<span class="pin" title="pinned">⚑</span>{/if}{r.rank}</td
						>
						<!-- A program's span is several chips, and #1284 measured four of
						     them as 349px of unbreakable inline run inside a 716px panel.
						     The wrapper is what gives the line breaker somewhere to break. -->
						<td class="qproj"
							><span class="chips"
								>{#each r.program.span as proj (proj)}<span class="proj">{proj}</span>{/each}</span
							></td
						>
						<td class="qtitle">
							{#if wall}
								<!-- The board's only interactive control, withdrawn rather than
								     left dead (#1204). Collapsed is also the informative form:
								     #1064's whole point is that a declared sequence does not
								     gain by being re-listed, and `N of M slices` still says
								     there is more behind the row. A caret nobody can press
								     would be an affordance the wall cannot honour. -->
								<span class="roll">{@render rollBody(r.program, r.remaining, r.total)}</span>
							{:else}
								<button
									class="roll"
									aria-expanded={open}
									title="{r.slices.length} queued slices — {open ? 'collapse' : 'expand'}"
									onclick={() => toggle(r.program.node_id)}
								>
									<span class="caret">{open ? '▾' : '▸'}</span>
									{@render rollBody(r.program, r.remaining, r.total)}
								</button>
							{/if}
						</td>
					</tr>
					{#if open}
						{#each r.slices as s (s.node_id)}
							<tr class="prog-slice">
								<td class="rank">{s.rank}</td>
								<td class="qproj"
									><span class="chips"><span class="proj">{s.project}</span></span></td
								>
								<td class="qtitle"
									><NodeRef nodeId={s.node_id} title="korg:{s.node_id}">{s.title}</NodeRef></td
								>
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
		omitted: {omitted.done} done, {omitted.declined} declined, {omitted.archived} archived{#if parkedHidden}<span
				class="parked-hid">· {parkedHidden} parked, hidden by a board setting</span
			>{/if}
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
