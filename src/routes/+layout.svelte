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
	<!-- `type` and `sizes="any"` are what make Chromium PREFER this over the PNGs
	     app.html declares for the install path (#1494) — without them the tab icon
	     is chosen by pixel size and a downscaled 128 wins, which is the same mark
	     rendered less crisply. The install path is unaffected either way: it reads
	     the manifest's `icons`, and those are PNG only. -->
	<link rel="icon" type="image/svg+xml" sizes="any" href={favicon} />
</svelte:head>

{@render children()}
