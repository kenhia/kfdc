<script lang="ts">
	import { statline } from '$lib/board';
	import KorgPane from '$lib/KorgPane.svelte';
	import { PaneState, providePane } from '$lib/pane.svelte';
	import type { BoardPayload } from '$lib/payload';
	import CommandersCall from '$lib/panels/CommandersCall.svelte';
	import Deconfliction from '$lib/panels/Deconfliction.svelte';
	import FireMissions from '$lib/panels/FireMissions.svelte';
	import NetLog from '$lib/panels/NetLog.svelte';
	import OnDeck from '$lib/panels/OnDeck.svelte';
	import Operations from '$lib/panels/Operations.svelte';
	import RateOfFire from '$lib/panels/RateOfFire.svelte';
	import SensorNet from '$lib/panels/SensorNet.svelte';
	import Ticker from '$lib/panels/Ticker.svelte';
	import { tickerLines } from '$lib/ticker';

	// The board, once. `/` and `/wall` are the same layout with the same panels
	// reading the same korg — wall mode is a display MODE, not a second board
	// (#1204), and the only way to keep that true is for there to be one of
	// these.
	let {
		board,
		flow,
		netlog,
		korgBase,
		// Wall mode: unattended widescreen, nobody at the keyboard.
		wall = false,
		// Wall mode only, and null whenever the board is being refreshed
		// normally: how long the wall has been showing a board it could not
		// refresh. See the statline below for why it is here rather than in a
		// corner.
		stale = null
	}: BoardPayload & { wall?: boolean; stale?: string | null } = $props();

	// Expanded mode (#1203): one pane per board, published to every ref on the
	// page through context. Disabled on the wall — refs there stay the plain
	// links they always were, because a pane nobody can close is an affordance
	// the wall cannot honour (docs/design.md § Wall mode).
	//
	// `korgBase` is read once. It comes from the service's KORG_URL and cannot
	// change without a restart, which reloads the page; a board tracking a moving
	// korg origin would have lost its data feed long before its links mattered.
	// svelte-ignore state_referenced_locally
	const pane = providePane(new PaneState(korgBase, !wall));

	const stats = $derived(statline(board));
	const ticker = $derived(tickerLines(board));
	// The board's own assembly time (Postgres's clock) — the reference every
	// age on the page is computed against.
	const asOf = $derived(board.generated.slice(0, 16).replace('T', ' ') + 'Z');
</script>

<header class="masthead">
	<!--
	  3d Cavalry Regiment DUI — "the Bug" (kfdc #1183). A unit crest belongs on
	  the letterhead, and the masthead is this board's letterhead; that is the
	  placement where it reads as earned rather than applied. Rendered in its own
	  enamel-and-gold rather than recoloured to the board's palette: it is
	  heraldry, and it should look like itself. Provenance and the AR 670-1 /
	  10 U.S.C. § 771 caveat are in docs/design.md.

	  It stays on the wall. Identity is worth MORE to a screen a passer-by has to
	  recognise from across a room than to a tab someone opened on purpose.
	-->
	<img
		class="crest"
		src="/brave-rifles.png"
		alt="3d Cavalry Regiment distinctive unit insignia — Brave Rifles"
		title="3d Cavalry Regiment — Brave Rifles"
		width="128"
		height="102"
	/>
	<div class="wordmark">
		K<span class="dot">·</span>F<span class="dot">·</span>D<span class="dot">·</span>C
	</div>
	{#if !wall}
		<!-- Prose that explains the board to someone meeting it. Read once, then
		     it is furniture — so the wall, which nobody is meeting for the first
		     time twice a day, does without it. -->
		<div class="mission">
			Fire direction for the homelab — what's firing, what's on deck, what's masked
		</div>
	{/if}
	<div class="statline">
		<span><b>{stats.live}</b> live proposals</span>
		<span><b>{stats.active}</b> active</span>
		<span><b>{stats.projects}</b> projects</span>
		<span><b>{stats.shipped}</b> shipped</span>
		<span class="warn"><b>{stats.awaiting}</b> awaiting Ken</span>
		<span>{asOf}</span>
		{#if stale}
			<!-- Beside `asOf`, deliberately, and not in a corner: the two are one
			     claim. `asOf` says when korg assembled what you are reading; this
			     says the wall has stopped being able to ask. A board that silently
			     keeps showing an hour-old queue is exactly the wrong information
			     nobody is standing there to scroll away from. -->
			<span class="stale"><b>NO REFRESH</b> {stale}</span>
		{/if}
	</div>
</header>

<!-- The deck: the board, and beside it the korg pane when one is open (#1203).
     The pane is not a panel — it is real korg, so it sits OUTSIDE the board grid
     and takes its own share of the width. `.deck-main` is a container, and the
     board's column count keys off ITS width rather than the viewport's, so a
     narrowed board sheds a column instead of overflowing one (docs/design.md —
     nothing renders past its box). -->
<div class="deck" class:paned={pane.open}>
	<div class="deck-main">
		<div class="board">
			<div class="col">
				<FireMissions active={board.active} />
				<Deconfliction {board} />
			</div>
			<div class="col">
				<!-- Operations holds the concept's second column; On Deck rides below. -->
				<Operations programs={board.programs} omitted={board.programs_omitted} />
				<OnDeck
					queue={board.queue}
					omitted={board.proposals_omitted}
					depth={board.depth}
					programs={board.programs}
					{wall}
				/>
			</div>
			<div class="col">
				<CommandersCall awaiting={board.awaiting} generated={board.generated} />
				<SensorNet reports={board.reports} generated={board.generated} />
				<RateOfFire {flow} />
			</div>
		</div>

		<!-- Two transition feeds, one board (#1186): the Net Log is what THIS board
		     observed, the Ticker is what korg recorded. Different forms on purpose. -->
		<NetLog lines={netlog} />
		<Ticker lines={ticker} />
	</div>

	<KorgPane />
</div>
