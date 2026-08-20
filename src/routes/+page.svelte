<script lang="ts">
	import Board from '$lib/Board.svelte';
	import { BoardFeed } from '$lib/feed.svelte';
	import { fetchPayload, type BoardPayload } from '$lib/payload';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// The desk board refreshes IN PLACE since #1496 (sprint 018). A full reload
	// used to be the only way to get fresh data, and it took the korg pane with
	// it: the pane is in-memory state on a component the reload destroys. Not
	// unmounting is the whole fix, and the pane surviving is a CONSEQUENCE of it
	// rather than a feature that was built — the iframe keeps exactly what it was
	// showing, including wherever Ken navigated to inside korg. No restore can
	// match that, which is why this is the primary path and sessionStorage
	// (pane.svelte.ts) is only the floor under the reloads no page can intercept.
	//
	// No timer here, unlike the wall. Somebody IS at the keyboard: a board that
	// re-sorted itself under the row Ken was reading would be the desk's version
	// of the wall's silence problem — right data, wrong moment.
	// svelte-ignore state_referenced_locally
	const feed = new BoardFeed<BoardPayload>(data, fetchPayload);
</script>

<Board {...feed.payload} stale={feed.stale} busy={feed.busy} refresh={() => void feed.refresh()} />
