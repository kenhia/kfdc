<script lang="ts">
	import { DEFAULT_PANE_PCT, type BoardSettings } from '$lib/settings.svelte';

	// The board's settings, as a LIST (#1489, sprint 017). It ships with one row
	// and is shaped for the second: another setting is another `.setting`, not a
	// redesign. Resisting theme/refresh/density on the way past is deliberate —
	// the sprint is an S, and an empty shell is cheaper to fill than a full one
	// is to unpick.
	// `deckWidth` is a getter, not a number: the board measures `.deck` on demand
	// rather than keeping a ResizeObserver alive for a popover that is open for
	// seconds a week.
	let { settings, deckWidth }: { settings: BoardSettings; deckWidth: () => number } = $props();

	// Mounted only while the popover is open — MastheadControl renders its
	// children inside the `{#if}` — so this measures on every open. That is the
	// whole reason the draft lives here rather than in the parent: after a window
	// resize, a box holding the pixels from before the resize would be a small
	// lie, and this board does not tell those.
	// Capturing the initial value is the point, not an oversight: `.deck` cannot
	// change width while this is open, and a re-measuring width would move the
	// readout under the reader mid-keystroke.
	// svelte-ignore state_referenced_locally
	const deck = deckWidth();
	// svelte-ignore state_referenced_locally
	let draft = $state(String(settings.paneWidthPx(deck)));

	// What the pane will actually render at, through the same clamp CSS applies.
	// The readout is the honest half of a px input whose value CSS may bound.
	const resolved = $derived(settings.paneWidthPx(deck));
	const pct = $derived(settings.panePct ?? DEFAULT_PANE_PCT);

	function oninput(e: Event & { currentTarget: HTMLInputElement }) {
		// The draft is whatever the box holds, always — reflected straight back so
		// the value attribute never fights a half-typed number. The clamping
		// happens to the STORED percent, not to what is being typed.
		draft = e.currentTarget.value;
		const px = Number(draft);
		if (draft !== '' && Number.isFinite(px)) settings.setPx(px, deck);
	}

	function resetWidth() {
		settings.resetPaneWidth();
		draft = String(settings.paneWidthPx(deck));
	}
</script>

<div class="settings">
	<div class="settings-h">BOARD SETTINGS</div>

	<div class="setting">
		<label class="setting-l" for="set-pane-w">korg pane width</label>
		<input
			id="set-pane-w"
			class="setting-i"
			type="number"
			min="0"
			step="20"
			value={draft}
			{oninput}
		/>
		<span class="setting-u">px</span>
		<!-- Pixels in, percent stored: he reasons against a monitor he can see,
		     the board holds a proportion that survives a different window. Both
		     are printed, because the stored number is the one a later session
		     will find in localStorage and need to recognise. -->
		<div class="setting-n">
			stored <b>{pct}%</b> of {deck}px · renders <b>{resolved}px</b>
		</div>
	</div>

	<!-- The second row (#1540), and sprint 017's prediction holding: the shell
	     was shaped as a list and this is another `.setting`, not a redesign.
	     Phrased as INCLUDE rather than "hide parked", so the checked state means
	     more on screen — a checkbox whose ticked state removes rows is the kind
	     of double negative a reader has to stop and solve. -->
	<div class="setting">
		<label class="setting-l" for="set-parked">include parked</label>
		<input
			id="set-parked"
			class="setting-c"
			type="checkbox"
			checked={settings.includeParked}
			onchange={(e) => settings.setIncludeParked(e.currentTarget.checked)}
		/>
		<!-- Says what korg means by it, because `parked` is korg's word and this
		     is the only place on the board that has room to explain it. -->
		<div class="setting-n">
			korg's dormant rows — deferred with no end date. Off by default; the wall never shows them.
		</div>
	</div>

	<button class="setting-reset" type="button" onclick={resetWidth}>
		reset width to default ({DEFAULT_PANE_PCT}%)
	</button>
</div>
