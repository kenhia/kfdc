<script lang="ts">
	import Board from '$lib/Board.svelte';
	import { BoardFeed } from '$lib/feed.svelte';
	import { fetchPayload, type BoardPayload } from '$lib/payload';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Seeded from the server load and owned outright from there on: the wall
	// never navigates, and following `data` afterwards would let a framework-side
	// reload overwrite a board BoardFeed knows to be the last good one.
	// svelte-ignore state_referenced_locally
	const feed = new BoardFeed<BoardPayload>(data, fetchPayload);

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
