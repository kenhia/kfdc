// Standing Orders (#1645, korg #1644) — the panel for work a schedule put in
// flight. The failure it renders against is an INVISIBILITY, so the tests are
// mostly about things being drawn at all, and about the two ids on a row not
// being swapped.
import { mount, type ComponentProps } from 'svelte';
import { describe, expect, it } from 'vitest';
import { PaneState, paneContext } from '$lib/pane.svelte';
import { SCHEDULED_WI_STATUSES, type InFlightSchedule } from '$lib/board';
import StandingOrders from './StandingOrders.svelte';

const KORG = 'https://korg.example';

const order = (over: Partial<InFlightSchedule> = {}): InFlightSchedule => ({
	node_id: 1112,
	title: 'Live kaed fleet rotation through krot — {DATE}',
	project: 'krot',
	wi_number: 1635,
	wi_title: 'Live kaed fleet rotation through krot — 2026-08-26',
	wi_status: 'open',
	materialized_at: '2026-08-26T04:00:00Z',
	...over
});

function render(props: Partial<ComponentProps<typeof StandingOrders>> = {}) {
	const target = document.body.appendChild(document.createElement('div'));
	mount(StandingOrders, {
		target,
		context: paneContext(new PaneState(KORG)),
		props: { rows: [order()], generated: '2026-08-26T10:00:00Z', ...props }
	});
	const row = () => target.querySelector('div.order') as HTMLElement;
	return {
		target,
		row,
		rows: () => [...target.querySelectorAll('div.order')],
		hrefs: () => [...target.querySelectorAll('div.order a')].map((a) => a.getAttribute('href')),
		chip: () => target.querySelector('div.order span.status') as HTMLElement,
		text: () => target.textContent ?? ''
	};
}

describe('Standing Orders', () => {
	it('draws the work item the schedule produced — the thing that was invisible', () => {
		const v = render();
		// The SUBSTITUTED title, not the template. `wi_title` is what the firing
		// actually made; `title` still carries `{DATE}`, and putting a literal
		// `{DATE}` on the board would be the panel quoting a form instead of
		// naming the work.
		expect(v.text()).toContain('Live kaed fleet rotation through krot — 2026-08-26');
		expect(v.text()).not.toContain('{DATE}');
		expect(v.text()).toContain('#1635');
		expect(v.text()).toContain('krot');
	});

	// THE TRAP THIS PANEL CARRIES ALONE: the row holds two korg ids that are
	// both plausible for either ref — `node_id` is the SCHEDULE's and
	// `wi_number` is the item's. Swapped, both links still resolve and both
	// land on the wrong node, which no type and no render can catch.
	it('links the item by wi_number and the standing order by node_id', () => {
		const hrefs = render().hrefs();
		expect(hrefs).toContain(`${KORG}/n/1635`);
		expect(hrefs).toContain(`${KORG}/n/1112`);
	});

	// korg carries the schedule's id "so a consumer can link the schedule as
	// well as the item", so drawing only one of the two would discard a
	// deliberate affordance. korg's work-item page does reach the schedule
	// through its Related section, but that is a second hop from a panel whose
	// whole subject is the standing order.
	it('draws both refs, not one', () => {
		expect(render().hrefs()).toHaveLength(2);
	});

	it('ages the firing against the board, never against the wall clock', () => {
		// 6h after materialization by the BOARD's clock. `Date.now()` in this
		// suite is years away from either, so a panel reading it would not
		// produce this string by accident.
		expect(render().text()).toContain('6h');
	});

	it.each(SCHEDULED_WI_STATUSES)('paints the `%s` item status', (wi_status) => {
		const v = render({ rows: [order({ wi_status })] });
		expect(v.chip().textContent?.trim()).toBe(wi_status);
		expect([...v.chip().classList]).toContain(wi_status);
	});

	// korg's predicate reads WI_UNFINISHED_STATUSES on purpose so that a parked
	// materialized item STAYS in the block (#810) — dropping it would re-hide
	// the item somebody deliberately set aside, which is #1644's own bug. kfdc
	// must not undo that on its side either: no filter, and the row draws.
	it('draws a parked item rather than suppressing it', () => {
		const v = render({ rows: [order({ wi_status: 'parked' })] });
		expect(v.rows()).toHaveLength(1);
		expect(v.text()).toContain('#1635');
	});

	// #1444's runtime half, and the specimen ASSERTS ITS OWN FICTIONALITY —
	// Operations' test shipped with `parked` as its hypothetical unknown, korg
	// then shipped `parked` for real, and the test went on passing while
	// asserting the opposite of its name. A hypothetical borrowed from korg's
	// plausible future has an expiry date, so this one is a word korg has no
	// use for.
	const UNKNOWN = 'mothballed';
	it('lands an unknown item status on the neutral base', () => {
		expect(SCHEDULED_WI_STATUSES as readonly string[]).not.toContain(UNKNOWN);
		const v = render({ rows: [order({ wi_status: UNKNOWN })] });
		expect([...v.chip().classList]).toEqual(['status', UNKNOWN]);
		for (const known of SCHEDULED_WI_STATUSES) {
			expect(v.chip().className).not.toMatch(new RegExp(`\\b${known}\\b`));
		}
	});

	// korg types `project` as optional and every other kfdc panel renders the
	// absence rather than a blank chip.
	it('omits the project chip where korg carries no project', () => {
		const v = render({ rows: [order({ project: null })] });
		expect(v.target.querySelector('div.order span.proj')).toBeNull();
		expect(v.text()).toContain('#1635');
	});

	it('says the empty case rather than drawing nothing', () => {
		const v = render({ rows: [] });
		expect(v.rows()).toHaveLength(0);
		expect(v.target.querySelector('p.empty')?.textContent).toMatch(/no scheduled work in flight/i);
	});

	// Uncapped and bounded by construction (korg #1644) — a schedule leaves the
	// block when its item finishes. The panel must not invent a cap korg
	// declined to impose; with one, the row a cap dropped is the drill that has
	// been in flight longest.
	it('draws every row korg sends', () => {
		const rows = Array.from({ length: 12 }, (_, i) =>
			order({ node_id: 2000 + i, wi_number: 3000 + i })
		);
		expect(render({ rows }).rows()).toHaveLength(12);
	});

	// korg orders the block newest firing first. The panel is a renderer, not a
	// sorter: re-ordering here would be a second opinion about a sequence korg
	// already decided (GP-1).
	it("keeps korg's order", () => {
		const rows = [
			order({ node_id: 10, wi_number: 100, wi_title: 'newest' }),
			order({ node_id: 11, wi_number: 101, wi_title: 'oldest' })
		];
		const titles = [...render({ rows }).rows()].map((r) => r.querySelector('h3')?.textContent);
		expect(titles).toEqual(['newest', 'oldest']);
	});
});
