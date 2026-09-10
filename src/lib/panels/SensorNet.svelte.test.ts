// Sensor Net's half of korg's `reviewed` flag (#2156, korg #2154). The panel's
// first component test — every fixture in the repo had `reports: []`, so
// nothing had ever rendered a report row.
import { mount, unmount, type ComponentProps } from 'svelte';
import { describe, expect, it } from 'vitest';
import { PaneState, paneContext } from '$lib/pane.svelte';
import type { ReportRow } from '$lib/board';
import SensorNet from './SensorNet.svelte';

const GENERATED = '2026-09-10T12:00:00Z';

const report = (over: Partial<ReportRow> = {}): ReportRow => ({
	node_id: 2098,
	source: 'kfo-soak',
	model: 'ken',
	status: 'attention',
	escalated: false,
	summary: 'wave 1 ready to judge',
	report_date: '2026-09-10',
	comment_count: 0,
	reviewed: false,
	updated: '2026-09-10T00:00:00Z',
	...over
});

function render(props: Partial<ComponentProps<typeof SensorNet>> = {}) {
	const target = document.body.appendChild(document.createElement('div'));
	const app = mount(SensorNet, {
		target,
		context: paneContext(new PaneState('https://korg.example')),
		props: { reports: [report()], generated: GENERATED, ...props }
	});
	return {
		target,
		app,
		text: () => target.textContent!,
		marks: () => target.querySelectorAll('.rev').length,
		foot: () => target.querySelector('.queue-foot')
	};
}

describe('Sensor Net reviewed', () => {
	it('marks a report korg has reviewed, and leaves the rest unmarked', () => {
		const v = render({
			reports: [report({ node_id: 1, reviewed: true }), report({ node_id: 2, reviewed: false })]
		});
		expect(v.marks()).toBe(1);
		expect(v.text()).toContain('reviewed');
		unmount(v.app);
	});

	it('marks nothing when korg has reviewed nothing', () => {
		const v = render();
		expect(v.marks()).toBe(0);
		unmount(v.app);
	});

	// Nothing disappears silently (docs/design.md). The count is kfdc's own —
	// korg cannot describe what a consumer chose not to draw.
	it('names what a board setting hid', () => {
		const v = render({ reviewedHidden: 3 });
		expect(v.foot()!.textContent).toContain('3 reviewed, hidden by a board setting');
		unmount(v.app);
	});

	// Sensor Net carries no korg-side omitted counts, so an always-present foot
	// would be a permanently empty line in the densest column on the board.
	it('draws no foot when nothing was hidden', () => {
		const v = render({ reviewedHidden: 0 });
		expect(v.foot()).toBeNull();
		unmount(v.app);
	});

	// The panel's own nothing-here state has to survive the filter emptying it —
	// and this is exactly why `includeReviewed` defaults to ON: a diligent
	// morning must not be able to make a healthy net read as a fault.
	it('still says `net silent` when the list is empty', () => {
		const v = render({ reports: [] });
		expect(v.text()).toContain('net silent');
		unmount(v.app);
	});
});
