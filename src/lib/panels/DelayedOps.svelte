<script lang="ts">
	import { soakClock, type DelayedOpsRow, type ProgramSoak, type SoakClock } from '$lib/board';
	import NodeRef from '$lib/NodeRef.svelte';

	// Delayed Ops (#2155, korg #2149) — the panel that answers Ken's actual
	// complaint: "I will essentially be looking at an 'almost done' program for a
	// couple of days with not much that I can do immediately to drive it
	// forward." Operations means WANTS YOUR ATTENTION, and a program whose
	// engineering is finished and whose acceptance is a calendar generates demand
	// nobody can satisfy. korg's state was never wrong; kfdc's rendering was.
	//
	// ITS DEFINING PROPERTY IS WHAT IT DOES NOT DRAW: no slice chips. Every slice
	// of a soaking program is terminal by korg's entry rule, so re-listing them
	// would fill the panel with the one part of the program nobody can act on —
	// which is Operations' failure mode moved one panel down. The soaks are the
	// remainder, so the soaks are the content.
	//
	// COMPACT SINCE #2193, which is that rule applied a second time and to
	// itself. Sprint 020 drew every fact a soak carries; a day of living with it
	// said a program nobody can advance was still taking a program's worth of
	// board. So the card keeps the row that identifies the program and collapses
	// the rest to ONE LINE OF REFS: the wi_number is a link into real korg, and
	// korg holds the title, the status and the invalidation clause one click
	// away (GP-1, GP-18 — the board renders the rollup and delegates the node).
	// What survives the collapse is what a GLANCE is for: which program, which
	// tests, and how long is left.
	let { rows, generated }: { rows: DelayedOpsRow[]; generated: string } = $props();

	/**
	 * The separators of the compact line, `,` within a project and `;` between —
	 * Ken's format in #2193, kept in one place because the rendered line and the
	 * spec have to stay the same string.
	 *
	 * THE TRAILING SPACE IS LOAD-BEARING, and is why these are constants rather
	 * than literal text in the markup: Svelte trims a trailing space out of a
	 * text node, which rendered `#2180,#2181` until the test caught it. Real
	 * characters in the DOM rather than a CSS `::after`, so the line copies out
	 * of the board exactly as it reads on it.
	 */
	const WITHIN_PROJECT = ', ';
	const BETWEEN_PROJECTS = '; ';

	interface SoakGroup {
		/** korg's project name, or `—` for a work item that carries none. */
		project: string;
		soaks: ProgramSoak[];
	}

	/**
	 * `kmon #2180, #2181; kfo #2185` — the refs grouped so the project is said
	 * once per run rather than once per ref (#2193).
	 *
	 * Groups appear in FIRST-APPEARANCE order and soaks keep korg's rank order
	 * within a group. Sorting by project name instead would re-order the array
	 * korg deliberately ranks, and a program whose soaks interleave projects
	 * would silently read in an order nobody chose.
	 */
	function byProject(soaks: ProgramSoak[]): SoakGroup[] {
		const groups: SoakGroup[] = [];
		for (const s of soaks) {
			const project = s.project ?? '—';
			const run = groups.find((g) => g.project === project);
			if (run) run.soaks.push(s);
			else groups.push({ project, soaks: [s] });
		}
		return groups;
	}

	/**
	 * The one clock the compact card keeps: the SOONEST check date across the
	 * program's soaks. The panel's subtitle is "waiting on the clock" and this is
	 * the fact that sentence promises — the date the program next becomes
	 * judgeable, which is the soonest of them by definition.
	 *
	 * Chosen on the computed `days` rather than by string-comparing the dates, so
	 * a soak korg carries with an unparseable `check_after` drops out the same
	 * way a null one does instead of winning the comparison and rendering
	 * nothing.
	 *
	 * NULL WHEN NO SOAK HAS A DATE, and the card then draws no chip at all. That
	 * is the same trade #2193 made for "blocks nothing": at this footprint an
	 * absent line reads as "nothing", not as "not computed", and korg's own row
	 * is one click away for the reader who wants to know why.
	 */
	function soonest(gen: string, soaks: ProgramSoak[]): (SoakClock & { on: string }) | null {
		let best: (SoakClock & { on: string }) | null = null;
		for (const s of soaks) {
			const c = soakClock(gen, s.check_after);
			if (!c || !s.check_after) continue;
			if (!best || c.days < best.days) best = { ...c, on: s.check_after };
		}
		return best;
	}
</script>

<section class="panel">
	<div class="panel-head">
		<h2>Delayed Ops</h2>
		<span class="sub">soaking — rounds away, waiting on the clock</span>
	</div>

	{#each rows as r (r.program.node_id)}
		{@const groups = byProject(r.program.soaks)}
		{@const clock = soonest(generated, r.program.soaks)}
		<div class="soak-card">
			<div class="row1">
				<h3>
					<NodeRef nodeId={r.program.node_id} title="korg:{r.program.node_id}"
						>{r.program.title}</NodeRef
					>
				</h3>
				<!-- korg's literal, printed and worn as a class, exactly as Operations
				     does it (#1444). One card class per status literal is why this panel
				     does not invent a treatment of its own for the same word. -->
				<span class="status {r.program.status}">{r.program.status}</span>
				{#if clock}
					<span class="clock c-{clock.state}" title="soonest check date — {clock.on}"
						>{clock.label}</span
					>
				{/if}
				<span class="span-chips">
					{#each r.program.span as proj (proj)}<span class="proj">{proj}</span>{/each}
				</span>
			</div>

			{#if groups.length > 0}
				<p class="soak-line">
					{#each groups as g, gi (g.project)}{#if gi > 0}<span class="sep">{BETWEEN_PROJECTS}</span
							>{/if}<span class="proj">{g.project}</span>
						{#each g.soaks as s, si (s.node_id)}{#if si > 0}<span class="sep">{WITHIN_PROJECT}</span
								>{/if}<NodeRef
								nodeId={s.node_id}
								title={s.wi_status === 'open' ? s.title : `${s.title} — ${s.wi_status}`}
								>#{s.wi_number}</NodeRef
							>{/each}{/each}
				</p>
			{:else}
				<!-- Reachable because korg gates entry to `soaking` on having a live
				     soak and deliberately never re-checks it. -->
				<p class="soak-none">
					no extended tests listed — korg gates entry to <b>soaking</b>, not what happens after
				</p>
			{/if}

			<!-- Drawn only when something IS blocked (#2193). The "blocks nothing"
			     sentence #2155 wrote was right for a card with an aim line and a row
			     per soak: an absent line there would have read as "not computed". At
			     this footprint the card is three lines and the reader has seen the
			     panel do this — so an absent line now reads as the answer it always
			     was, and spending a line on it costs more than it tells. The fact
			     itself is undiminished: `blocks` is still derived from the UNFILTERED
			     board (board.ts), so a real blocked row can never go unsaid. -->
			{#if r.blocks.length > 0}
				<p class="blocks">
					<span class="blocks-l">blocks</span>
					{#each r.blocks as b (b.node_id)}
						<span class="blocked-row">
							{#if b.project}<span class="proj">{b.project}</span>{/if}
							<NodeRef nodeId={b.node_id} title="korg:{b.node_id}">{b.title}</NodeRef>
						</span>
					{/each}
				</p>
			{/if}
		</div>
	{:else}
		<p class="empty">no missions in soak — nothing waiting on the clock</p>
	{/each}
</section>
