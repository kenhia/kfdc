<script lang="ts">
	import { soakClock, type DelayedOpsRow } from '$lib/board';
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
	let { rows, generated }: { rows: DelayedOpsRow[]; generated: string } = $props();
</script>

<section class="panel">
	<div class="panel-head">
		<h2>Delayed Ops</h2>
		<span class="sub">soaking — rounds away, waiting on the clock</span>
	</div>

	{#each rows as r (r.program.node_id)}
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
				<span class="span-chips">
					{#each r.program.span as proj (proj)}<span class="proj">{proj}</span>{/each}
				</span>
			</div>
			<p class="aim" title={r.program.aim}>{r.program.aim}</p>

			<ul class="soaks">
				{#each r.program.soaks as s (s.node_id)}
					{@const clock = soakClock(generated, s.check_after)}
					<li class="soak">
						<span class="soak-head">
							<span class="proj">{s.project ?? '—'}</span>
							<NodeRef nodeId={s.node_id} title="korg:{s.node_id}">#{s.wi_number}</NodeRef>
							<span class="soak-t">{s.title}</span>
							{#if s.wi_status !== 'open'}
								<!-- Drawn only when it is NOT the expected state. A soak is
								     `open` until somebody judges it, so a column of `open`
								     chips would be a column of no information — where a
								     `resolved` one is the whole news: the evidence has been
								     judged and this program is waiting on its close, not on
								     the clock. -->
								<span class="soak-st">{s.wi_status}</span>
							{/if}
							{#if clock}
								<span class="clock c-{clock.state}" title="check after {s.check_after}"
									>{clock.label}</span
								>
							{:else}
								<!-- korg demands both soak fields to CREATE the edge and never
								     re-checks them, so a soak with no check date is a state an
								     operator can reach. Said in words rather than rendered as a
								     countdown from nothing. -->
								<span class="clock c-none" title="no check_after on this work item"
									>no check date</span
								>
							{/if}
						</span>
						{#if s.invalidated_if}
							<!-- The kmon #2058 lesson, and the reason this is a column rather
							     than prose in a body: a soak lives inside a live fleet, and the
							     reader who needs this sentence is the next agent about to touch
							     the state it names. -->
							<span class="voids"><b>voids if</b> {s.invalidated_if}</span>
						{/if}
					</li>
				{:else}
					<li class="soak-none">
						no extended tests listed — korg gates entry to <b>soaking</b>, not what happens after
					</li>
				{/each}
			</ul>

			<p class="blocks">
				{#if r.blocks.length > 0}
					<span class="blocks-l">blocks</span>
					{#each r.blocks as b (b.node_id)}
						<span class="blocked-row">
							{#if b.project}<span class="proj">{b.project}</span>{/if}
							<NodeRef nodeId={b.node_id} title="korg:{b.node_id}">{b.title}</NodeRef>
						</span>
					{/each}
				{:else}
					<!-- The sharpest thing in Ken's original framing, and the fact that
					     turns an anxious two-day wait into a shrug. Rendered in words
					     because an absent line reads as "not computed" — the reader has to
					     be told the answer is nothing, not left to infer it. -->
					<span class="blocks-none">blocks nothing — nothing is waiting on this</span>
				{/if}
			</p>
		</div>
	{:else}
		<p class="empty">no missions in soak — nothing waiting on the clock</p>
	{/each}
</section>
