<script lang="ts">
	import { browser } from '$app/environment';
	import { delayedOps, statline, withoutParked, withoutReviewed, withoutSoaking } from '$lib/board';
	import KorgPane from '$lib/KorgPane.svelte';
	import MastheadControl from '$lib/MastheadControl.svelte';
	import { PaneState, providePane } from '$lib/pane.svelte';
	import type { BoardPayload } from '$lib/payload';
	import SettingsPopover from '$lib/SettingsPopover.svelte';
	import { BoardSettings } from '$lib/settings.svelte';
	import CommandersCall from '$lib/panels/CommandersCall.svelte';
	import Deconfliction from '$lib/panels/Deconfliction.svelte';
	import DelayedOps from '$lib/panels/DelayedOps.svelte';
	import FireMissions from '$lib/panels/FireMissions.svelte';
	import NetLog from '$lib/panels/NetLog.svelte';
	import OnDeck from '$lib/panels/OnDeck.svelte';
	import Operations from '$lib/panels/Operations.svelte';
	import RateOfFire from '$lib/panels/RateOfFire.svelte';
	import SensorNet from '$lib/panels/SensorNet.svelte';
	import StandingOrders from '$lib/panels/StandingOrders.svelte';
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
		// `build` (#2190) arrives in the payload spread and is deliberately NOT
		// destructured here: nothing on the board draws it. The comparison that
		// uses it belongs to `BoardFeed`, which is the only thing that knows which
		// build this page was SERVED with — a panel reading the field would be
		// reading the build of the latest fetch and calling it the running one.
		// Wall mode: unattended widescreen, nobody at the keyboard.
		wall = false,
		// Null whenever the board is current: how long this browser has been
		// showing a board it could not refresh. Wall mode's original (#1204), and
		// the desk's too since the desk stopped reloading (#1496) — a long-lived
		// board is a board that can go stale. See the statline below for why it is
		// there rather than in a corner.
		stale = null,
		// The desk's in-place refresh (#1496), and null on the wall, which refreshes
		// on its own timer and has nobody to press anything. Its presence is what
		// draws the ↻ and what arms the hotkeys — one prop, so the control and the
		// keystroke can never disagree about whether refreshing is possible here.
		refresh = null,
		// A refresh is in flight. A slow korg should look slow rather than dead.
		busy = false,
		// A newer kfdc is serving (#2190) and the board is about to reload to pick
		// it up. Says so rather than jumping: a board that blanked and came back
		// under Ken's cursor with no explanation is indistinguishable from a
		// crash. The wall never sets this — it reloads at once, and there is
		// nobody there to read a notice.
		updated = false
	}: BoardPayload & {
		wall?: boolean;
		stale?: string | null;
		refresh?: (() => void) | null;
		busy?: boolean;
		updated?: boolean;
	} = $props();

	// Expanded mode (#1203): one pane per board, published to every ref on the
	// page through context. Disabled on the wall — refs there stay the plain
	// links they always were, because a pane nobody can close is an affordance
	// the wall cannot honour (docs/design.md § Wall mode).
	//
	// `korgBase` is read once. It comes from the service's KORG_URL and cannot
	// change without a restart, which reloads the page; a board tracking a moving
	// korg origin would have lost its data feed long before its links mattered.
	// svelte-ignore state_referenced_locally
	const pane = providePane(
		new PaneState(korgBase, !wall, browser && !wall ? window.sessionStorage : null)
	);

	// The floor under the reloads no page can intercept (#1496): the Edge app
	// window's own refresh control is browser chrome, and Ctrl+R while focus is
	// inside korg's frame never reaches this document at all. In an effect rather
	// than in PaneState's constructor because the server renders the pane closed —
	// see `restore()` for why that distinction is a hydration mismatch, not a
	// preference. Writes `pane.node` and reads nothing reactive, so it runs once.
	$effect(() => pane.restore());

	// One entry point for both ways of asking, so the button and the keystroke
	// cannot drift, and neither can stack a second fetch on a slow korg.
	function doRefresh() {
		if (refresh && !busy) refresh();
	}

	// Ctrl+R and F5 become the IN-APP refresh on the desk (#1496). Both are
	// interceptable in Chromium, unlike Ctrl+T/N/W. Ctrl+Shift+R is deliberately
	// left alone: a real hard reload has to stay one keystroke away for when the
	// app itself is what needs re-fetching, not korg.
	//
	// When focus is inside korg's frame this handler sees nothing — the same
	// cross-origin boundary KorgPane.svelte documents for Escape — and Chromium
	// services Ctrl+R as an ordinary top-level reload. That is why advertising the
	// hotkey is honest where advertising `close (Esc)` was not: this one DEGRADES
	// to what it replaced, and the pane comes back from sessionStorage. Escape's
	// failure mode was nothing happening at all.
	function onkeydown(e: KeyboardEvent) {
		if (!refresh || e.shiftKey || e.altKey) return;
		const mod = e.ctrlKey || e.metaKey;
		if (!((e.key === 'F5' && !mod) || (mod && (e.key === 'r' || e.key === 'R')))) return;
		e.preventDefault();
		doRefresh();
	}

	// Board settings (#1489), kfdc's first client-side preference. No store on
	// the server (nothing to read) and none on the wall — the wall renders no
	// gear, so a preference set at the desk must not follow the board onto an
	// unattended screen where nobody can change it back.
	// svelte-ignore state_referenced_locally
	const settings = new BoardSettings(browser && !wall ? window.localStorage : null);

	// `.deck`'s content box — the box a `flex-basis: %` resolves against, and so
	// the only honest basis for converting the pixels Ken types into the percent
	// kfdc stores. Measured on demand rather than bound: `bind:clientWidth` costs
	// a ResizeObserver running for the life of the board, and the one moment this
	// number is wanted is when the popover opens. It cannot go stale while the
	// popover is up either — setting the pane width resizes `.deck-main`, never
	// `.deck`. Zero before layout, which every consumer guards.
	let deck = $state<HTMLDivElement | null>(null);
	const deckWidth = () => deck?.clientWidth ?? 0;

	// The board as this reader has asked to see it (#1540). Everything below the
	// masthead renders `shown`; `board` itself is used only where a figure must
	// come from korg's whole corpus rather than from the filtered view.
	//
	// THE WALL'S ANSWER IS A LITERAL, not a consequence. `settings` is already
	// built with no storage on the wall, so `includeParked` would read false
	// there anyway — but that is an accident of plumbing, and the rule it has to
	// express is sprint 017's: the wall draws no affordance it cannot honour, so
	// a preference with no control on that screen must not be able to reach it.
	// Written as `!wall &&` so deleting the storage guard could never quietly
	// hand the wall a setting it has no gear to change back.
	//
	// The wall suppressing parked unconditionally is the right fixed answer on
	// its own terms too: the wall is an at-a-glance display of what is in
	// motion, and parked is the definition of what is not.
	const showParked = $derived(!wall && settings.includeParked);

	// The wall's answer for reviewed reports is a literal too, and it is the
	// OPPOSITE of parked's — which is the point of writing both out rather than
	// letting `!wall &&` stand for "the wall hides things". Sensor Net asks
	// whether the net is reporting, not whether there is unread news, so a wall
	// that dropped reviewed reports could show a sensor as silent on a morning
	// when it had in fact reported and been read. Parked is what is not in
	// motion; a reviewed report is still the latest word from that sensor.
	const showReviewed = $derived(wall ? true : settings.includeReviewed);

	const parked = $derived(withoutParked(board));
	const afterParked = $derived(showParked ? board : parked.board);
	const reviewed = $derived(withoutReviewed(afterParked));
	const afterReviewed = $derived(showReviewed ? afterParked : reviewed.board);

	// Soaking programs leave the general program collection LAST, and they are
	// routed rather than hidden — Delayed Ops draws them in full, below On Deck.
	// So there is no setting here and nothing to confess in a count: this one is
	// not a preference, it is where that kind of program belongs (#2155).
	const shown = $derived(withoutSoaking(afterReviewed));

	// Built from the UNFILTERED board on purpose — see delayedOps(): "what does
	// this block?" is korg's fact, and a display setting must not be able to turn
	// a real blocked row into "blocks nothing".
	const delayed = $derived(delayedOps(board));

	// Zero when the rows are being drawn, so the receipt appears only where
	// something was actually withheld — the same shape as korg's omitted counts.
	const hidden = $derived({
		queue: showParked ? 0 : parked.hidden.queue,
		programs: showParked ? 0 : parked.hidden.programs,
		reports: showReviewed ? 0 : reviewed.hidden
	});

	// The statline reads the FILTERED board, and korg's D-3 rule is why: every
	// figure derives from the lists it is printed beside, so it cannot disagree
	// with them. A `live` count including rows On Deck is not drawing would be
	// the statline contradicting the panel under it. `shipped` and `projects`
	// come from korg's own counts either way and do not move.
	const stats = $derived(statline(shown));
	// The Ticker quotes korg verbatim (#1186) and takes the unfiltered board on
	// purpose: `→ parked` is a real korg transition, and the feed that exists to
	// say what korg recorded must not go quiet about the act of parking.
	const ticker = $derived(tickerLines(board));
	// The board's own assembly time (Postgres's clock) — the reference every
	// age on the page is computed against.
	const asOf = $derived(board.generated.slice(0, 16).replace('T', ' ') + 'Z');
</script>

<svelte:window {onkeydown} />

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
			     says the browser has stopped being able to ask. A board that
			     silently keeps showing an hour-old queue is exactly the wrong
			     information nobody is standing there to scroll away from — and
			     since #1496 the desk board is long-lived too, so it can reach this
			     state without anyone noticing the ↻ stopped landing. -->
			<span class="stale"><b>NO REFRESH</b> {stale}</span>
		{/if}
		{#if updated}
			<!-- Beside `asOf` and `NO REFRESH`, because all three are one claim
			     about how current the thing you are reading is. `NO REFRESH` says
			     the board could not ask; this says the board asked and got an
			     answer from a NEWER kfdc than the one drawing this pixel, so what
			     is on screen is the old bundle and is about to be replaced. -->
			<span class="updated"><b>BOARD UPDATED</b> reloading</span>
		{/if}
		{#if refresh}
			<!-- Not a MastheadControl: it opens nothing, it does one thing. It wears
			     the same button, because a second visual language for a second glyph
			     in one statline is how a masthead becomes a toolbar. -->
			<button
				class="mast-btn mast-refresh"
				type="button"
				title="refresh (Ctrl+R)"
				aria-label="refresh the board"
				aria-busy={busy}
				onclick={doRefresh}>↻</button
			>
		{/if}
		{#if !wall}
			<!-- Right of the time/date, where #1489 asked for it. Desk only: a
			     settings gear on an unattended screen is exactly the affordance
			     the wall's rule forbids. -->
			<MastheadControl label="⚙" title="board settings" name="board settings">
				<SettingsPopover {settings} {deckWidth} />
			</MastheadControl>
		{/if}
	</div>
</header>

<!-- The deck: the board, and beside it the korg pane when one is open (#1203).
     The pane is not a panel — it is real korg, so it sits OUTSIDE the board grid
     and takes its own share of the width. `.deck-main` is a container, and the
     board's column count keys off ITS width rather than the viewport's, so a
     narrowed board sheds a column instead of overflowing one (docs/design.md —
     nothing renders past its box). -->
<div class="deck" class:paned={pane.open} style={settings.deckStyle} bind:this={deck}>
	<div class="deck-main">
		<div class="board">
			<div class="col">
				<FireMissions active={shown.active} />
				<!-- Below Fire Missions and above Deconfliction (#1645), so the first
				     column reads: what is firing, what a standing order put in flight,
				     what collides. Scheduled work has no other host — it is in no
				     proposal and no queue, which is how it came to be invisible at all.

				     TAKES THE UNFILTERED BOARD, like Delayed Ops and for a sharper
				     reason. korg's predicate reads WI_UNFINISHED_STATUSES expressly so
				     a PARKED materialized item stays in the block, because dropping it
				     would re-hide the item somebody deliberately set aside. Routing
				     this through `shown` would put a kfdc filter in front of a korg
				     decision — see withoutParked() in board.ts, which records it as
				     one of the collections the setting must not reach. -->
				<StandingOrders rows={board.in_flight_schedules} generated={board.generated} />
				<Deconfliction board={shown} />
			</div>
			<div class="col">
				<!-- Operations holds the concept's second column; On Deck rides below. -->
				<Operations
					programs={shown.programs}
					omitted={shown.programs_omitted}
					parkedHidden={hidden.programs}
					soaking={delayed.length}
				/>
				<OnDeck
					queue={shown.queue}
					omitted={shown.proposals_omitted}
					depth={shown.depth}
					programs={shown.programs}
					parkedHidden={hidden.queue}
					{wall}
				/>
				<!-- Below On Deck, where #2155 asked for it: the second column reads
				     top to bottom as what is running, what is next, and what is only
				     waiting on time. -->
				<DelayedOps rows={delayed} generated={shown.generated} />
			</div>
			<div class="col">
				<!-- Rate of Fire leads the third column (#1841), and the reason is its
				     HEIGHT rather than its importance: it is the only panel on the
				     board whose height is fixed — a native-pixel svg of korg's flow
				     window, drawn 1:1 and never stretched. Everything else here grows
				     with the corpus. Ken measured the consequence of having it last:
				     with four rows in Commander's Call, a maximized board still had
				     to be scrolled to reach it, so the one panel that could never
				     have been the cause of the overflow was the one paying for it.
				     A constant-height panel placed first cannot be pushed off. -->
				<RateOfFire {flow} />
				<CommandersCall awaiting={shown.awaiting} generated={shown.generated} />
				<SensorNet
					reports={shown.reports}
					generated={shown.generated}
					reviewedHidden={hidden.reports}
				/>
			</div>
		</div>

		<!-- Two transition feeds, one board (#1186): the Net Log is what THIS board
		     observed, the Ticker is what korg recorded. Different forms on purpose. -->
		<NetLog lines={netlog} />
		<Ticker lines={ticker} />
	</div>

	<KorgPane />
</div>
