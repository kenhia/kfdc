// Delayed Ops (#2155). The panel exists so Operations can stop demanding
// attention for a program nobody can advance, so the assertions here are mostly
// about what it does NOT draw and about the words it uses when the answer is
// "nothing" — both of which are the feature rather than incidental rendering.
import { mount, unmount, type ComponentProps } from 'svelte';
import { describe, expect, it } from 'vitest';
import { PaneState, paneContext } from '$lib/pane.svelte';
import { PROGRAM_STATUSES, type DelayedOpsRow, type ProgramSoak } from '$lib/board';
import DelayedOps from './DelayedOps.svelte';

const GENERATED = '2026-09-10T12:00:00Z';

const soak = (over: Partial<ProgramSoak> = {}): ProgramSoak => ({
	node_id: 2062,
	wi_number: 2062,
	title: 'wave 1: three consecutive nightlies across five hosts',
	project: 'kmon',
	wi_status: 'open',
	check_after: '2026-09-13',
	invalidated_if: "kai's baseline is regenerated outside the timer",
	rank: '0',
	...over
});

const opsRow = (over: Partial<DelayedOpsRow> = {}): DelayedOpsRow => ({
	program: {
		node_id: 2070,
		title: 'kmon fleet collection',
		aim: 'collect every host nightly',
		status: 'soaking',
		span: ['kmon'],
		slice_count: 2,
		slices: [
			{
				node_id: 2071,
				title: 'the slice nobody needs to see again',
				project: 'kmon',
				status: 'done',
				rank: '0',
				open: 0,
				resolved: 0,
				done: 1,
				closed: 0,
				covered_count: 1
			}
		],
		soaks: [soak()]
	},
	blocks: [],
	...over
});

function render(props: Partial<ComponentProps<typeof DelayedOps>> = {}) {
	const target = document.body.appendChild(document.createElement('div'));
	const app = mount(DelayedOps, {
		target,
		context: paneContext(new PaneState('https://korg.example')),
		props: { rows: [opsRow()], generated: GENERATED, ...props }
	});
	const text = () => target.textContent!;
	return {
		target,
		app,
		text,
		card: () => target.querySelector('.soak-card') as HTMLElement | null,
		chip: () => target.querySelector('span.status') as HTMLElement,
		soaks: () => [...target.querySelectorAll('.soak .soak-t')].map((n) => n.textContent!.trim()),
		clock: () => target.querySelector('.clock') as HTMLElement,
		blocks: () => target.querySelector('.blocks')!.textContent!.replace(/\s+/g, ' ').trim()
	};
}

describe('Delayed Ops', () => {
	// THE defining property (korg #2149): a soaking program's slices are all
	// terminal, so re-listing them would fill the panel with the one part nobody
	// can act on — Operations' failure mode moved one panel down.
	it('draws the soaks and never the completed slices', () => {
		const v = render();
		expect(v.soaks()).toEqual(['wave 1: three consecutive nightlies across five hosts']);
		expect(v.text()).not.toContain('the slice nobody needs to see again');
		expect(v.target.querySelector('.slice')).toBeNull();
		unmount(v.app);
	});

	// korg's literal, printed and worn — the same rule Operations follows
	// (#1444), so the two panels cannot grow two treatments for one word.
	it('prints korg`s status literal and carries it as a class', () => {
		const v = render();
		expect(v.chip().textContent).toBe('soaking');
		expect([...v.chip().classList]).toEqual(['status', 'soaking']);
		unmount(v.app);
	});

	// `soaking` is a real korg literal now, not a hypothetical — the #1536
	// lesson, asserted rather than assumed.
	it('renders a literal korg actually ships', () => {
		expect(PROGRAM_STATUSES as readonly string[]).toContain('soaking');
	});

	it.each([
		['2026-09-13', '3d', 'c-waiting'],
		['2026-09-10', 'due today', 'c-due'],
		['2026-09-08', '2d overdue', 'c-overdue']
	])('renders %s as `%s`', (checkAfter, label, cls) => {
		const r = opsRow();
		r.program.soaks = [soak({ check_after: checkAfter as string })];
		const v = render({ rows: [r] });
		expect(v.clock().textContent!.trim()).toBe(label);
		expect([...v.clock().classList]).toContain(cls);
		unmount(v.app);
	});

	// korg gates the soak fields on edge creation and never re-checks them, so a
	// soak with no date is reachable. Said in words rather than counted down from
	// nothing.
	it('says so when a soak has no check date', () => {
		const r = opsRow();
		r.program.soaks = [soak({ check_after: null })];
		const v = render({ rows: [r] });
		expect(v.clock().textContent!.trim()).toBe('no check date');
		expect([...v.clock().classList]).toContain('c-none');
		unmount(v.app);
	});

	// The kmon #2058 lesson: the reader this sentence is written for is the next
	// agent about to touch the state it names, so it has to be ON the row.
	it('shows what voids the test', () => {
		const v = render();
		expect(v.text()).toContain("kai's baseline is regenerated outside the timer");
		unmount(v.app);
	});

	// A soak that has been judged is the whole news; a column of `open` chips is
	// none, so the chip is drawn only when the status is not the expected one.
	it('marks a soak whose status has moved off open, and only then', () => {
		const open = render();
		expect(open.target.querySelector('.soak-st')).toBeNull();
		unmount(open.app);

		const r = opsRow();
		r.program.soaks = [soak({ wi_status: 'resolved' })];
		const judged = render({ rows: [r] });
		expect(judged.target.querySelector('.soak-st')!.textContent!.trim()).toBe('resolved');
		unmount(judged.app);
	});

	// "Blocks nothing" is an ANSWER — the fact that turns an anxious two-day wait
	// into a shrug. An absent line would read as "not computed".
	it('says `blocks nothing` in words rather than leaving the line out', () => {
		const v = render();
		expect(v.blocks()).toBe('blocks nothing — nothing is waiting on this');
		expect(v.target.querySelector('.blocks-none')).not.toBeNull();
		unmount(v.app);
	});

	it('names what it blocks when something is waiting', () => {
		const v = render({
			rows: [
				opsRow({
					blocks: [
						{ node_id: 3, title: 'downstream work', project: 'kfdc', blocker: 2062 },
						{ node_id: 4, title: 'more downstream work', project: 'korg', blocker: 2070 }
					]
				})
			]
		});
		expect(v.blocks()).toContain('downstream work');
		expect(v.blocks()).toContain('more downstream work');
		expect(v.target.querySelector('.blocks-none')).toBeNull();
		unmount(v.app);
	});

	it('renders an empty state in the FDC register', () => {
		const v = render({ rows: [] });
		expect(v.card()).toBeNull();
		expect(v.text()).toContain('no missions in soak');
		unmount(v.app);
	});

	// Reachable for the same reason the missing check date is: korg gates entry
	// to `soaking` on having a live soak and never re-checks it.
	it('does not pretend a program with no soaks left has any', () => {
		const r = opsRow();
		r.program.soaks = [];
		const v = render({ rows: [r] });
		expect(v.text()).toContain('no extended tests listed');
		unmount(v.app);
	});
});
