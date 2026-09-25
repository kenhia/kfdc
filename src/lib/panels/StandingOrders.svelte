<script lang="ts">
	import { formatAge, type InFlightSchedule } from '$lib/board';
	import NodeRef from '$lib/NodeRef.svelte';

	// Standing Orders (#1645, korg #1644) — work a SCHEDULE put in flight, which
	// until now was the one kind of live work this board could not see.
	//
	// The failure is an invisibility rather than a wrong pixel, and it happened
	// BETWEEN two surfaces: the instant a schedule materializes it stops being
	// due, and the open item it left behind is in no proposal, not blocked, not
	// awaiting, and never appeared in `events` because being created is not a
	// status change. Ken met it on WI #1635 — the first-ever materialization made
	// its own work invisible.
	//
	// WHY A PANEL AND NOT A LINE SOMEWHERE ELSE. Fire Missions is proposals; On
	// Deck is the ranked queue; Commander's Call is the awaiting-Ken column;
	// Delayed Ops is soaking programs. Scheduled work is none of those — it is
	// work that recurs by standing order rather than by anyone calling for it, so
	// it has no host panel, which is exactly how it came to be invisible. It
	// leads nothing and follows Fire Missions, so the first column now reads:
	// what is firing, what a standing order put in flight, what collides.
	//
	// THE OVERSEER'S CALL WAS "beside `due_schedules`", AND THERE IS NO BESIDE:
	// kfdc renders no due-schedules surface, and neither does korg-dash, though
	// four decision records said both did (corrected 2026-09-25, korg #3085).
	// What survives of the call is its substance and it is honoured here — due
	// is a nag, in-flight is a tracker, and folding the two together would lose
	// the distinction korg's sibling field was created to keep.
	let { rows, generated }: { rows: InFlightSchedule[]; generated: string } = $props();
</script>

<section class="panel">
	<div class="panel-head">
		<h2>Standing Orders</h2>
		<span class="sub">fired — scheduled work still in flight</span>
	</div>

	<!--
	  Keyed on `wi_number`, not `node_id`: the row's identity is the WORK, and a
	  `once` schedule that fires, finishes and is replaced would otherwise reuse a
	  key across two different items. korg allows only one unfinished item per
	  schedule, so this is unique by construction either way — the choice is about
	  which of the two ids names the thing on screen.
	-->
	{#each rows as r (r.wi_number)}
		<div class="order">
			<div class="row1">
				{#if r.project}<span class="proj" title={r.project}>{r.project}</span>{/if}
				<!-- The ref goes on the ID, which is Fire Missions' idiom and Commander's
				     Call's. Putting it on the title instead left `#1635` and
				     `korg:1112` sitting side by side in the same `.id` grey with only
				     one of them clickable — two things that look alike and behave
				     differently, which is worse than either arrangement. -->
				<NodeRef nodeId={r.wi_number} class="id" title={r.wi_title}>#{r.wi_number}</NodeRef>
				<!-- korg's literal, printed and worn as a class — one rule per literal
				     the board knows, and the neutral base for everything else (#1444).
				     `parked` reuses the chip `parked` already has, because GP-19 is a
				     rule about every node kind and a work item parked means what a
				     proposal parked means. -->
				<span class="status {r.wi_status}">{r.wi_status}</span>
				<span class="age" title="fired {r.materialized_at}"
					>{formatAge(generated, r.materialized_at)}</span
				>
				<!-- The SECOND ref, and the only compact line on this board that draws
				     one. korg carries the schedule's node id expressly "so a consumer
				     can link the schedule as well as the item", and the two are
				     different destinations for different questions: the item is what is
				     being worked, the schedule is the standing order that will fire
				     again. `korg:<id>` rather than `#n` because a schedule has no
				     wi_number — the same spelling Commander's Call uses for a non-item
				     row. The template title, `{DATE}` and all, rides in the tooltip
				     rather than on the board: it is a FORM, and printing a placeholder
				     where a reader expects work would say less than the substituted
				     title already below it says. -->
				<span class="sched"
					>⟳ <NodeRef nodeId={r.node_id} class="id" title={r.title}>korg:{r.node_id}</NodeRef></span
				>
			</div>
			<!-- `wi_title`, substituted — what the firing actually produced, and plain
			     text for the reason above: both of this row's refs live in row1, and
			     a card with a clickable title as well would put three links on two
			     destinations. -->
			<h3>{r.wi_title}</h3>
		</div>
	{:else}
		<!-- The ordinary state of this panel, and it has to read as an answer
		     rather than as a panel that failed to load: korg's block is empty most
		     of the time, because a schedule leaves it the moment its work finishes. -->
		<p class="empty">no scheduled work in flight — every standing order is between firings</p>
	{/each}
</section>
