<script lang="ts">
	import Board from '$lib/Board.svelte';

	let { data } = $props();
</script>

<Board {...data} />
