// What the derivation test cannot reach: the DOM the flow series becomes.
// The substance pinned here is korg #1318's structural property rendered
// knowingly — inside the durability lag no added bar may claim a durable
// split — and the no-feed state, which is what production shows until korg
// deploys 059-backlog-flow.
import { mount, unmount } from 'svelte';
import { describe, expect, it } from 'vitest';
import type { WorkItemFlowDay, WorkItemFlowSeries } from '$lib/flow';
import RateOfFire from './RateOfFire.svelte';

const day = (d: number, over: Partial<WorkItemFlowDay> = {}): WorkItemFlowDay => ({
	day: `2026-08-${String(10 + d).padStart(2, '0')}`,
	added: 3,
	closed: 2,
	backlog: 160,
	added_durable: 0,
	closed_durable: 1,
	...over
});

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

function render(flow: WorkItemFlowSeries | null) {
	const target = document.body.appendChild(document.createElement('div'));
	const app = mount(RateOfFire, { target, props: { flow } });
	return { target, app };
}

describe('Rate of Fire', () => {
	it('names the missing feed instead of rendering an empty chart', () => {
		const v = render(null);
		expect(v.target.querySelector('svg')).toBeNull();
		expect(v.target.querySelector('.empty')?.textContent).toContain('no flow feed');
		unmount(v.app);
	});

	it('renders one day slot per response day — the length is korg`s, not a constant', () => {
		const v = render(series([1, 2, 3, 4, 5].map((d) => day(d))));
		expect(v.target.querySelectorAll('rect.hit')).toHaveLength(5);
		expect(v.target.querySelectorAll('table tbody tr')).toHaveLength(5);
		unmount(v.app);
	});

	it('claims no durable split on added bars inside the launch window', () => {
		const v = render(series([1, 2, 3, 4, 5, 6].map((d) => day(d))));
		// Every added bar is whole-bar faded ("not yet durable"), never solid.
		expect(v.target.querySelectorAll('.add-dur')).toHaveLength(0);
		expect(v.target.querySelectorAll('.add-churn')).toHaveLength(6);
		// closed_durable has no lag: solid green renders from day one.
		expect(v.target.querySelectorAll('.out-dur')).toHaveLength(6);
		// And the stats row offers no "durable in" figure it cannot know.
		expect(v.target.querySelector('.stats')?.textContent).not.toContain('durable in');
		expect(v.target.querySelector('.stats')?.textContent).toContain('durable out');
		unmount(v.app);
	});

	it('splits added bars for real once days are old enough (the widening)', () => {
		const v = render(
			series([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => day(d, { added_durable: 1 })))
		);
		// Ages 9, 8, 7 clear the lag: exactly three added bars go solid.
		expect(v.target.querySelectorAll('.add-dur')).toHaveLength(3);
		expect(v.target.querySelector('.stats')?.textContent).toContain('durable in');
		unmount(v.app);
	});
	// korg #1432: the delta now measures the same days the sums do, and says so.
	it('renders the delta against korg`s baseline, over the full window', () => {
		const v = render(
			series(
				[
					day(1, { added: 17, closed: 26, backlog: 165 }),
					day(2, { added: 13, closed: 7, backlog: 158 })
				],
				{ backlog_before: 174 }
			)
		);
		const stats = v.target.querySelector('.stats')?.textContent ?? '';
		expect(v.target.querySelector('.delta')?.textContent).toBe('-16/2d');
		expect(stats).toContain('backlog 158');
		unmount(v.app);
	});

	// An absent delta beats a wrong one (GP-13). Falling back to bars[0] is the
	// bug, so no number may appear at all.
	it('shows the backlog with no delta when korg supplies no baseline', () => {
		for (const flow of [
			series([day(1, { backlog: 165 }), day(2, { backlog: 158 })], { backlog_before: null }),
			series([day(1, { backlog: 165 }), day(2, { backlog: 158 })])
		]) {
			const v = render(flow);
			expect(v.target.querySelector('.delta')).toBeNull();
			expect(v.target.querySelector('.stats')?.textContent).toContain('backlog 158');
			expect(v.target.querySelector('.stats')?.textContent).not.toContain('/2d');
			unmount(v.app);
		}
	});

	// The regression guard for korg #1433's second consequence: a durable-in
	// covering the oldest 3 days may not sit beside a full-window durable-out
	// without saying which span it covers.
	it('labels the span a partial durable-in covers, beside a full-window durable out', () => {
		const v = render(
			series([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => day(d, { added_durable: 1 })))
		);
		const stats = v.target.querySelector('.stats')?.textContent?.replace(/\s+/g, ' ') ?? '';
		expect(stats).toContain('durable in');
		expect(stats).toContain('oldest 3d of 10');
		expect(v.target.querySelector('.stats .span')).not.toBeNull();
		unmount(v.app);
	});

	it('drops the span once durable-in covers the window it is read beside', () => {
		const v = render(
			series(
				[1, 2, 3].map((d) => day(d, { added_durable: 1 })),
				{ durable_after_days: 0 }
			)
		);
		const stats = v.target.querySelector('.stats')?.textContent?.replace(/\s+/g, ' ') ?? '';
		expect(stats).toContain('durable in');
		expect(stats).not.toContain('oldest');
		expect(v.target.querySelector('.stats .span')).toBeNull();
		unmount(v.app);
	});
});
