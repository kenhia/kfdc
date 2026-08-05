<script lang="ts">
	import { page } from '$app/state';
</script>

<div class="nocomms">
	<h1>No Comms</h1>
	<p>
		{page.status} — {page.error?.message ?? 'korg unreachable'}. The board renders korg; without
		korg there is nothing to render.
	</p>
</div>
