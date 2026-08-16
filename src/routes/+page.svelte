<script lang="ts">
	import { statline } from '$lib/board';
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

	let { data } = $props();

	const board = $derived(data.board);
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
		/>
	</div>
	<div class="col">
		<CommandersCall awaiting={board.awaiting} generated={board.generated} />
		<SensorNet reports={board.reports} generated={board.generated} />
		<RateOfFire flow={data.flow} />
	</div>
</div>

<!-- Two transition feeds, one board (#1186): the Net Log is what THIS board
     observed, the Ticker is what korg recorded. Different forms on purpose. -->
<NetLog lines={data.netlog} korgBase={data.korgBase} />
<Ticker lines={ticker} korgBase={data.korgBase} />
