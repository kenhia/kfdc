// Delayed Ops (#2155, compacted in #2193). The panel exists so Operations can
// stop demanding attention for a program nobody can advance, so the assertions
// here are mostly about what it does NOT draw and about the words it uses when
// the answer is "nothing" — both of which are the feature rather than
// incidental rendering. #2193 moved several facts from "drawn" to "one click
// away in korg", so the negative assertions are now the larger half.
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

/** A row carrying exactly these soaks, everything else the default. */
const withSoaks = (...soaks: ProgramSoak[]): DelayedOpsRow => {
	const r = opsRow();
	r.program.soaks = soaks;
	return r;
};

function render(props: Partial<ComponentProps<typeof DelayedOps>> = {}) {
	const target = document.body.appendChild(document.createElement('div'));
	const app = mount(DelayedOps, {
		target,
		context: paneContext(new PaneState('https://korg.example')),
		props: { rows: [opsRow()], generated: GENERATED, ...props }
	});
	const text = () => target.textContent!;
	const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
	return {
		target,
		app,
		text,
		card: () => target.querySelector('.soak-card') as HTMLElement | null,
		chip: () => target.querySelector('span.status') as HTMLElement,
		// The whole compact soak line, exactly as a reader sees it.
		refs: () => norm(target.querySelector('.soak-line')!.textContent!),
		refLinks: () => [...target.querySelectorAll('.soak-line a')] as HTMLAnchorElement[],
		clock: () => target.querySelector('.clock') as HTMLElement | null,
		clocks: () => target.querySelectorAll('.clock').length,
		blocks: () => {
			const p = target.querySelector('.blocks');
			return p && norm(p.textContent!);
		}
	};
}

describe('Delayed Ops', () => {
	// THE defining property (korg #2149): a soaking program's slices are all
	// terminal, so re-listing them would fill the panel with the one part nobody
	// can act on — Operations' failure mode moved one panel down.
	it('draws the soaks and never the completed slices', () => {
		const v = render();
		expect(v.refs()).toBe('kmon #2062');
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

	describe('the compact line (#2193)', () => {
		// Ken's spec, verbatim: `abc #1234; def #5678, #5679`. The project is said
		// once per run of refs, not once per ref.
		it('groups refs by project, `,` within a project and `;` between', () => {
			const v = render({
				rows: [
					withSoaks(
						soak({ node_id: 2180, wi_number: 2180, project: 'kmon', rank: '0' }),
						soak({ node_id: 2181, wi_number: 2181, project: 'kmon', rank: '1' }),
						soak({ node_id: 2185, wi_number: 2185, project: 'kfo', rank: '2' })
					)
				]
			});
			expect(v.refs()).toBe('kmon #2180, #2181; kfo #2185');
			unmount(v.app);
		});

		// korg ranks the soaks array and the panel must not re-sort it. Grouping
		// gathers a project's refs; it does not reorder the projects, so a program
		// whose soaks interleave still reads in the order korg chose.
		it('keeps first-appearance order when projects interleave', () => {
			const v = render({
				rows: [
					withSoaks(
						soak({ node_id: 2180, wi_number: 2180, project: 'kmon', rank: '0' }),
						soak({ node_id: 2185, wi_number: 2185, project: 'kfo', rank: '1' }),
						soak({ node_id: 2181, wi_number: 2181, project: 'kmon', rank: '2' })
					)
				]
			});
			expect(v.refs()).toBe('kmon #2180, #2181; kfo #2185');
			unmount(v.app);
		});

		// A work item need not carry a project, everywhere else in korg and here.
		it('says `—` for a soak with no project rather than dropping the group', () => {
			const v = render({ rows: [withSoaks(soak({ node_id: 9, wi_number: 9, project: null }))] });
			expect(v.refs()).toBe('— #9');
			unmount(v.app);
		});

		// The wi_number IS the link — that is the whole trade the compact line
		// makes, so it has to actually resolve into korg (GP-16: korg emits the
		// per-node URL; kfdc never builds a path from a kind).
		it('makes every ref a real link to korg`s node', () => {
			const v = render({ rows: [withSoaks(soak({ node_id: 2185, wi_number: 2185 }))] });
			const [a] = v.refLinks();
			expect(a.textContent!.trim()).toBe('#2185');
			expect(a.getAttribute('href')).toBe('https://korg.example/n/2185');
			unmount(v.app);
		});

		// Everything the line stopped drawing, asserted as absent — these are the
		// footprint, so a regression that quietly puts one back is a regression.
		it('draws no title, no invalidation clause and no per-soak status chip', () => {
			const v = render({ rows: [withSoaks(soak({ wi_status: 'resolved' }))] });
			expect(v.text()).not.toContain('wave 1: three consecutive nightlies');
			expect(v.text()).not.toContain("kai's baseline is regenerated outside the timer");
			expect(v.text()).not.toContain('voids if');
			expect(v.target.querySelector('.soak-st')).toBeNull();
			unmount(v.app);
		});

		// The aim was the widest line on the card and is one click away on the
		// title (Ken's red line through it).
		it('draws no aim line', () => {
			const v = render();
			expect(v.text()).not.toContain('collect every host nightly');
			expect(v.target.querySelector('.aim')).toBeNull();
			unmount(v.app);
		});

		// The facts the line stopped PRINTING are still reachable without a trip
		// to korg — a bare `#2185` is not legible on its own.
		it('carries the title, and a judged status, in the ref`s tooltip', () => {
			const open = render();
			expect(open.refLinks()[0].getAttribute('title')).toBe(
				'wave 1: three consecutive nightlies across five hosts'
			);
			unmount(open.app);

			const judged = render({ rows: [withSoaks(soak({ wi_status: 'resolved' }))] });
			expect(judged.refLinks()[0].getAttribute('title')).toContain('resolved');
			unmount(judged.app);
		});
	});

	describe('the one clock (#2193)', () => {
		it.each([
			['2026-09-13', '3d', 'c-waiting'],
			['2026-09-10', 'due today', 'c-due'],
			['2026-09-08', '2d overdue', 'c-overdue']
		])('renders %s as `%s`', (checkAfter, label, cls) => {
			const v = render({ rows: [withSoaks(soak({ check_after: checkAfter as string }))] });
			expect(v.clock()!.textContent!.trim()).toBe(label);
			expect([...v.clock()!.classList]).toContain(cls);
			unmount(v.app);
		});

		// One chip per card, and it is the SOONEST — the date the program next
		// becomes judgeable, which is what "waiting on the clock" promises.
		it('shows the soonest date across the program`s soaks, once', () => {
			const v = render({
				rows: [
					withSoaks(
						soak({ node_id: 1, wi_number: 1, check_after: '2026-09-15' }),
						soak({ node_id: 2, wi_number: 2, check_after: '2026-09-13' }),
						soak({ node_id: 3, wi_number: 3, check_after: '2026-09-20' })
					)
				]
			});
			expect(v.clocks()).toBe(1);
			expect(v.clock()!.textContent!.trim()).toBe('3d');
			unmount(v.app);
		});

		// korg gates the soak fields on edge creation and never re-checks them, so
		// a soak with no date is reachable — and must not drag the whole card's
		// clock away from the dates korg DID give.
		it('ignores a dateless soak when others have dates', () => {
			const v = render({
				rows: [
					withSoaks(
						soak({ node_id: 1, wi_number: 1, check_after: null }),
						soak({ node_id: 2, wi_number: 2, check_after: '2026-09-13' })
					)
				]
			});
			expect(v.clock()!.textContent!.trim()).toBe('3d');
			unmount(v.app);
		});

		// GP-13 in the numeric register: render nothing where korg cannot say.
		// A countdown from nothing would be worse than an absent chip.
		it('draws no clock at all when no soak has a date', () => {
			const v = render({ rows: [withSoaks(soak({ check_after: null }))] });
			expect(v.clock()).toBeNull();
			expect(v.refs()).toBe('kmon #2062');
			unmount(v.app);
		});
	});

	// #2155 wrote "blocks nothing" in words because an absent line on THAT card
	// would have read as "not computed". #2193 shrank the card to three lines and
	// Ken has since watched the panel answer the question, so the absent line now
	// reads as the answer. The derivation is untouched — only the rendering.
	it('leaves the blocks line out entirely when nothing is waiting', () => {
		const v = render();
		expect(v.blocks()).toBeNull();
		expect(v.target.querySelector('.blocks-none')).toBeNull();
		expect(v.text()).not.toContain('blocks nothing');
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
		unmount(v.app);
	});

	it('renders an empty state in the FDC register', () => {
		const v = render({ rows: [] });
		expect(v.card()).toBeNull();
		expect(v.text()).toContain('no missions in soak');
		unmount(v.app);
	});

	// Reachable for the same reason a missing check date is: korg gates entry to
	// `soaking` on having a live soak and never re-checks it.
	it('does not pretend a program with no soaks left has any', () => {
		const v = render({ rows: [withSoaks()] });
		expect(v.text()).toContain('no extended tests listed');
		expect(v.target.querySelector('.soak-line')).toBeNull();
		unmount(v.app);
	});
});
