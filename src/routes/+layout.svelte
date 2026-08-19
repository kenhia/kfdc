<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<!-- The board's default name. It lives here rather than in app.html because
	     a route that wants its own (wall mode) must be able to REPLACE it —
	     `svelte:head` keeps one title, the innermost; two static ones in the
	     same head is invalid HTML resolved differently by different browsers,
	     which is not a thing to leave under a kiosk. -->
	<title>KFDC — Homelab Fire Direction</title>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
