<script lang="ts">
	import Board from '$lib/Board.svelte';
	import { BoardFeed } from '$lib/feed.svelte';
	import { fetchPayload, type BoardPayload } from '$lib/payload';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Seeded from the server load and owned outright from there on: the wall
	// never navigates, and following `data` afterwards would let a framework-side
	// reload overwrite a board BoardFeed knows to be the last good one.
	//
	// And it reloads on a new kfdc, at once (#2190). The wall is the worst case
	// for the stale-bundle bug and the reason it is worth fixing: it is the one
	// display nobody ever reloads, so after every deploy it ran old code until
	// someone walked over and touched it. No notice and no delay — the only
	// reader here is the screen, and every second of the pause would be a second
	// of the board drawing a layout the server has already replaced.
	// svelte-ignore state_referenced_locally
	const feed = new BoardFeed<BoardPayload>(data, fetchPayload, Date.now, {
		of: (p) => p.build,
		reload: () => location.reload(),
		delayMs: 0
	});

	// Period, not phase: the wall asks as often as the server's Net Log observer
	// polls korg (`POLL_INTERVAL_MS`, imported through the load), so the board's
	// two clocks cannot disagree about how fresh it is. Phase alignment would buy
	// nothing — the endpoint reads korg live on every request.
	$effect(() => feed.start(data.pollIntervalMs));
</script>

<svelte:head>
	<!-- A kiosk tab wants a name; there is nobody there to recognise it by URL. -->
	<title>K·F·D·C — wall</title>
</svelte:head>

<Board {...feed.payload} wall stale={feed.stale} />
