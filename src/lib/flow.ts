// Types and pure derivation for korg's work-item flow series
// (GET /api/work-items/flow?days=N, korg #1318) — the Rate of Fire panel's
// substrate. Contract: korg docs/api.md; the series length is korg's call
// (6 at launch, widening to 10 after 2026-08-18) and everything here derives
// from `days.length` so the widening needs no edit on this side (#1319).

export interface WorkItemFlowDay {
	// YYYY-MM-DD in the series' own timezone.
	day: string;
	added: number;
	closed: number;
	// Open (non-closed) count at end of day.
	backlog: number;
	added_durable: number;
	closed_durable: number;
}

export interface WorkItemFlowSeries {
	// Oldest first, ending today.
	days: WorkItemFlowDay[];
	// Where korg's transition log begins; a window reaching past it is clamped
	// by korg, never zero-filled.
	horizon: string;
	timezone: string;
	// An item is durable once it has lived longer than this many days.
	durable_after_days: number;
	generated: string;
}

export interface FlowBar {
	day: string;
	// Day-of-month, the only axis label a slot this narrow can carry; the
	// full date rides the tooltip and the table.
	label: string;
	added: number;
	closed: number;
	// The solid (durable) portion of each direction's bar. For `added`,
	// korg's figure is only adopted once the day is old enough for durability
	// to be knowable (#1318: added_durable is structurally zero inside the
	// lag) — younger days keep 0 here and render whole-bar faded, claiming
	// "not yet durable" rather than "measured all-churn".
	addedDurable: number;
	addedKnown: boolean;
	closedDurable: number;
	backlog: number;
}

export interface RateOfFire {
	bars: FlowBar[];
	// One shared magnitude scale for both directions of the mirror — the two
	// sides must be comparable by eye. Floored at 1 so an all-zero window
	// still has a scale.
	scaleMax: number;
	// Backlog strip scale; a flat series is padded so it draws mid-strip
	// instead of hugging an edge.
	backlogMin: number;
	backlogMax: number;
	totals: {
		added: number;
		closed: number;
		// The drawdown signal — no durability lag on the closed side.
		closedDurable: number;
		// Durable arrivals summed over the days old enough to know, or null
		// while the whole window sits inside the lag (the 6-day launch state).
		addedDurableKnown: number | null;
	};
	backlogNow: number;
	// Over the window: last day minus first day.
	backlogDelta: number;
}

export function rateOfFire(s: WorkItemFlowSeries | null | undefined): RateOfFire | null {
	if (!s || s.days.length === 0) return null;
	const n = s.days.length;

	// Age by position: the series is contiguous daily and ends today, so the
	// last day is age 0. Cheaper and timezone-proof versus re-parsing dates.
	const bars: FlowBar[] = s.days.map((d, i) => {
		const known = n - 1 - i >= s.durable_after_days;
		return {
			day: d.day,
			label: d.day.slice(8),
			added: d.added,
			closed: d.closed,
			addedDurable: known ? d.added_durable : 0,
			addedKnown: known,
			closedDurable: d.closed_durable,
			backlog: d.backlog
		};
	});

	const known = bars.filter((b) => b.addedKnown);
	const backlogs = bars.map((b) => b.backlog);
	let backlogMin = Math.min(...backlogs);
	let backlogMax = Math.max(...backlogs);
	if (backlogMin === backlogMax) {
		backlogMin -= 1;
		backlogMax += 1;
	}

	return {
		bars,
		scaleMax: Math.max(1, ...bars.map((b) => Math.max(b.added, b.closed))),
		backlogMin,
		backlogMax,
		totals: {
			added: bars.reduce((t, b) => t + b.added, 0),
			closed: bars.reduce((t, b) => t + b.closed, 0),
			closedDurable: bars.reduce((t, b) => t + b.closedDurable, 0),
			addedDurableKnown: known.length ? known.reduce((t, b) => t + b.addedDurable, 0) : null
		},
		backlogNow: bars[n - 1].backlog,
		backlogDelta: bars[n - 1].backlog - bars[0].backlog
	};
}
