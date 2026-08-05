<script lang="ts">
	import { statline } from '$lib/board';
	import CommandersCall from '$lib/panels/CommandersCall.svelte';
	import FireMissions from '$lib/panels/FireMissions.svelte';
	import OnDeck from '$lib/panels/OnDeck.svelte';

	let { data } = $props();

	const board = $derived(data.board);
	const stats = $derived(statline(board));
	// The board's own assembly time (Postgres's clock) — the reference every
	// age on the page is computed against.
	const asOf = $derived(board.generated.slice(0, 16).replace('T', ' ') + 'Z');
</script>

<header class="masthead">
	<div class="wordmark">
		K<span class="dot">·</span>F<span class="dot">·</span>D<span class="dot">·</span>C
	</div>
	<div class="mission">
		Fire direction for the homelab — what's firing, what's on deck, what's masked
	</div>
	<div class="statline">
		<span><b>{stats.live}</b> live proposals</span>
		<span><b>{stats.active}</b> active</span>
		<span><b>{stats.projects}</b> projects</span>
		<span><b>{stats.shipped}</b> shipped</span>
		<span class="warn"><b>{stats.awaiting}</b> awaiting Ken</span>
		<span>{asOf}</span>
	</div>
</header>

<div class="board">
	<div class="col">
		<FireMissions active={board.active} />
	</div>
	<div class="col">
		<OnDeck queue={board.queue} omitted={board.proposals_omitted} depth={board.depth} />
	</div>
	<div class="col">
		<CommandersCall awaiting={board.awaiting} generated={board.generated} />
	</div>
</div>
