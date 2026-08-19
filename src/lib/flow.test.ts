import { describe, expect, it } from 'vitest';
import { rateOfFire, type WorkItemFlowDay, type WorkItemFlowSeries } from './flow';

// Fixture days count up from an anchor date; korg sends oldest first, ending
// today. Values are arbitrary but distinct so a swapped field shows.
const day = (d: number, over: Partial<WorkItemFlowDay> = {}): WorkItemFlowDay => ({
	day: `2026-08-${String(10 + d).padStart(2, '0')}`,
	added: 0,
	closed: 0,
	backlog: 100,
	added_durable: 0,
	closed_durable: 0,
	...over
});

// `backlog_before` is deliberately absent from the default: a test that wants
// a delta must supply the baseline, so the no-baseline path stays the one you
// get for free (korg #1432 — and korg predating the field renders the same).
const series = (
	days: WorkItemFlowDay[],
	over: Partial<WorkItemFlowSeries> = {}
): WorkItemFlowSeries => ({
	days,
	horizon: '2026-08-08',
	timezone: 'America/Los_Angeles',
	durable_after_days: 7,
	generated: '2026-08-16T12:00:00Z',
	...over
});

describe('rateOfFire', () => {
	it('returns null for a missing or empty feed — the panel renders the absence, not zeros', () => {
		expect(rateOfFire(null)).toBeNull();
		expect(rateOfFire(undefined)).toBeNull();
		expect(rateOfFire(series([]))).toBeNull();
	});

	it('derives one bar per day, in korg order, with day-of-month labels', () => {
		const r = rateOfFire(
			series([day(1, { added: 3, closed: 1 }), day(2, { added: 0, closed: 4, backlog: 96 })])
		)!;
		expect(r.bars.map((b) => b.label)).toEqual(['11', '12']);
		expect(r.bars.map((b) => b.added)).toEqual([3, 0]);
		expect(r.bars.map((b) => b.closed)).toEqual([1, 4]);
		expect(r.bars.map((b) => b.backlog)).toEqual([100, 96]);
	});

	// korg #1318's structural property, rendered knowingly: an arrival's
	// durability is unknowable until the day is durable_after_days old. At the
	// 6-day launch window every day is younger than that, so no added bar may
	// claim a durable/churn split.
	it('marks every day added-unknown inside the 6-day launch window', () => {
		const r = rateOfFire(series([1, 2, 3, 4, 5, 6].map((d) => day(d, { added_durable: 0 }))))!;
		expect(r.bars.map((b) => b.addedKnown)).toEqual([false, false, false, false, false, false]);
		expect(r.bars.map((b) => b.addedDurable)).toEqual([0, 0, 0, 0, 0, 0]);
		expect(r.totals.addedDurableKnown).toBeNull();
	});

	// The widening guard (korg #1319): nothing here hardcodes 6 — a 10-day
	// series flows through whole, and the oldest days (age >= durable_after_days)
	// adopt korg's added_durable for real.
	it('handles a 10-day series, splitting added only on days old enough to know', () => {
		const days = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) =>
			day(d, { added: 5, added_durable: 2, closed: 1 })
		);
		const r = rateOfFire(series(days))!;
		expect(r.bars).toHaveLength(10);
		// ages 9,8,7 (the first three) are >= durable_after_days 7.
		expect(r.bars.map((b) => b.addedKnown)).toEqual([
			true,
			true,
			true,
			false,
			false,
			false,
			false,
			false,
			false,
			false
		]);
		expect(r.bars.map((b) => b.addedDurable)).toEqual([2, 2, 2, 0, 0, 0, 0, 0, 0, 0]);
		expect(r.totals.addedDurableKnown).toBe(6);
	});

	// durable_after_days comes from the response, never a constant 7.
	it('takes the durability lag from the response', () => {
		const r = rateOfFire(
			series(
				[1, 2, 3, 4].map((d) => day(d, { added_durable: 1 })),
				{ durable_after_days: 2 }
			)
		)!;
		expect(r.bars.map((b) => b.addedKnown)).toEqual([true, true, false, false]);
	});

	it('scales both directions of the mirror to one shared max, floored at 1', () => {
		const r = rateOfFire(series([day(1, { added: 2, closed: 9 }), day(2, { added: 4 })]))!;
		expect(r.scaleMax).toBe(9);
		expect(rateOfFire(series([day(1), day(2)]))!.scaleMax).toBe(1);
	});

	it('totals the window and reads the backlog level off the last day', () => {
		const r = rateOfFire(
			series(
				[
					day(1, { added: 3, closed: 1, closed_durable: 1, backlog: 150 }),
					day(2, { added: 2, closed: 5, closed_durable: 3, backlog: 147 })
				],
				// end of the day before day one: 150 - 3 + 1.
				{ backlog_before: 148 }
			)
		)!;
		expect(r.totals).toEqual({
			added: 5,
			closed: 6,
			closedDurable: 4,
			addedDurableKnown: null,
			addedDurableDays: 0
		});
		expect(r.backlogNow).toBe(147);
		expect(r.backlogDelta).toBe(-1);
	});

	it('pads a flat backlog series so the sparkline draws mid-strip, not on an edge', () => {
		const flat = rateOfFire(series([day(1), day(2)]))!;
		expect(flat.backlogMin).toBeLessThan(100);
		expect(flat.backlogMax).toBeGreaterThan(100);
		const moving = rateOfFire(series([day(1, { backlog: 90 }), day(2, { backlog: 110 })]))!;
		expect(moving.backlogMin).toBe(90);
		expect(moving.backlogMax).toBe(110);
	});
	// korg #1432 / GP-13. The production case that filed this: window Aug 13-18,
	// where the header read -7 against a flow of 127 - 143 = -16. Every row
	// reconciles against the one before it; the missing input was simply the day
	// before the window, which no row inside it can be.
	const liveWindow = () =>
		series(
			[
				{ day: '2026-08-13', added: 17, closed: 26, closed_durable: 8, backlog: 165 },
				{ day: '2026-08-14', added: 12, closed: 2, closed_durable: 0, backlog: 175 },
				{ day: '2026-08-15', added: 39, closed: 44, closed_durable: 9, backlog: 170 },
				{ day: '2026-08-16', added: 34, closed: 38, closed_durable: 16, backlog: 166 },
				{ day: '2026-08-17', added: 12, closed: 26, closed_durable: 9, backlog: 152 },
				{ day: '2026-08-18', added: 13, closed: 7, closed_durable: 0, backlog: 158 }
			].map((d) => ({ added_durable: 0, ...d })),
			{ backlog_before: 174 }
		);

	it('measures the delta from `backlog_before`, over the days the sums cover', () => {
		const r = rateOfFire(liveWindow())!;
		expect(r.totals.added - r.totals.closed).toBe(-16);
		expect(r.backlogDelta).toBe(-16);
		// The bug: differencing the series ends swallows day one's own net (-9)
		// and yields -7 under the same "/6d" label.
		expect(r.backlogDelta).not.toBe(r.bars[r.bars.length - 1].backlog - r.bars[0].backlog);
	});

	// korg's own invariant, asserted from this side of the wire: the header's
	// delta and the bars beneath it are then arithmetically the same claim.
	it('keeps `backlog_before` + sum(added - closed) == the last backlog', () => {
		const r = rateOfFire(liveWindow())!;
		expect(174 + (r.totals.added - r.totals.closed)).toBe(r.backlogNow);
	});

	// The whole point of the fix: an absent delta beats a wrong one. Falling back
	// to bars[0] *is* the bug, so neither shape may produce a number.
	it('renders no delta when korg supplies no baseline — null at the horizon, or absent', () => {
		const atHorizon = rateOfFire(
			series([day(1, { backlog: 150 }), day(2, { backlog: 147 })], { backlog_before: null })
		)!;
		expect(atHorizon.backlogDelta).toBeNull();
		// korg predating #1432 omits the field entirely; same answer.
		const older = rateOfFire(series([day(1, { backlog: 150 }), day(2, { backlog: 147 })]))!;
		expect(older.backlogDelta).toBeNull();
	});

	it('does not mistake a zero baseline for a missing one', () => {
		const r = rateOfFire(series([day(1, { backlog: 4 })], { backlog_before: 0 }))!;
		expect(r.backlogDelta).toBe(4);
	});

	// korg #1433's consequence: at 10 days with a 7-day lag, durable-in covers
	// the oldest 3 days while durable-out covers all 10. The span is data, so the
	// panel can say so instead of implying a comparison it cannot support.
	it('reports how many days the durable-in total actually covers', () => {
		const r = rateOfFire(
			series([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => day(d, { added: 5, added_durable: 2 })))
		)!;
		expect(r.totals.addedDurableKnown).toBe(6);
		expect(r.totals.addedDurableDays).toBe(3);
		expect(r.totals.addedDurableDays).toBeLessThan(r.bars.length);
	});

	it('covers the whole window only once every day has cleared the lag', () => {
		const r = rateOfFire(
			series(
				[1, 2, 3].map((d) => day(d, { added: 5, added_durable: 2 })),
				{
					durable_after_days: 0
				}
			)
		)!;
		expect(r.totals.addedDurableDays).toBe(r.bars.length);
		expect(r.totals.addedDurableKnown).toBe(6);
	});

	it('reports a zero span while the whole window sits inside the lag', () => {
		const r = rateOfFire(series([1, 2, 3, 4, 5, 6].map((d) => day(d, { added: 5 }))))!;
		expect(r.totals.addedDurableKnown).toBeNull();
		expect(r.totals.addedDurableDays).toBe(0);
	});
});
