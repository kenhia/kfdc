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
});
