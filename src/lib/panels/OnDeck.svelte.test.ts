// kfdc's first component test (#1102). The roll-up's disclosure (#1064) is
// the board's only piece of client state, so it is the only thing here that a
// pure derivation test cannot reach — `onDeckRows` is covered in board.test.ts
// and is deliberately not re-asserted through the DOM.
import { flushSync, mount, unmount, type ComponentProps } from 'svelte';
import { describe, expect, it } from 'vitest';
import { PaneState, paneContext } from '$lib/pane.svelte';
import type { ProgramRow, ProgramSlice, ProposalRow } from '$lib/board';
import OnDeck from './OnDeck.svelte';

const row = (node_id: number, over: Partial<ProposalRow> = {}): ProposalRow => ({
	node_id,
	title: `title ${node_id}`,
	summary: 's',
	project: 'korg',
	status: 'proposed',
	rank: String(node_id),
	pinned: false,
	comment_count: 0,
	covered_count: 1,
	open: 1,
	resolved: 0,
	done: 0,
	closed: 0,
	updated: '2026-08-08T00:00:00Z',
	synopsis: null,
	...over
});

const slice = (node_id: number, status = 'proposed'): ProgramSlice => ({
	node_id,
	title: `slice ${node_id}`,
	project: 'korg',
	status,
	rank: String(node_id),
	open: 1,
	resolved: 0,
	done: 0,
	closed: 0,
	covered_count: 1
});

const program = (over: Partial<ProgramRow> = {}): ProgramRow => ({
	node_id: 900,
	title: 'sequencing on the board',
	aim: 'a',
	status: 'active',
	span: ['korg', 'kfdc'],
	slice_count: 3,
	slices: [slice(10), slice(12), slice(13, 'done')],
	...over
});

function render(props: Partial<ComponentProps<typeof OnDeck>> = {}) {
	const target = document.body.appendChild(document.createElement('div'));
	const app = mount(OnDeck, {
		target,
		context: paneContext(new PaneState('https://korg.example')),
		props: {
			queue: [row(5), row(10), row(12)],
			omitted: { done: 1, declined: 0, archived: 0 },
			depth: [],
			programs: [program()],
			...props
		}
	});
	return {
		target,
		app,
		// Whitespace-collapsed so an assertion pins what the row *says*, not how
		// the markup happens to be indented.
		titles: () =>
			[...target.querySelectorAll('td.qtitle')].map((td) =>
				td.textContent!.replace(/\s+/g, ' ').trim()
			),
		roll: () => target.querySelector('button.roll') as HTMLButtonElement,
		chips: () =>
			[...target.querySelectorAll('td.qproj')].map((td) =>
				[...td.querySelectorAll(':scope > .chips > .proj')].map((c) => c.textContent)
			)
	};
}

describe('On Deck program roll-up', () => {
	it('collapses the program`s slices behind one row by default', () => {
		const v = render();
		expect(v.roll().getAttribute('aria-expanded')).toBe('false');
		expect(v.titles()).toEqual(['title 5', '▸ program sequencing on the board 2 of 3 slices']);
		unmount(v.app);
	});

	it('reveals the collapsed slices on click, and hides them again', () => {
		const v = render();

		v.roll().click();
		flushSync();
		expect(v.roll().getAttribute('aria-expanded')).toBe('true');
		expect(v.titles()).toEqual([
			'title 5',
			'▾ program sequencing on the board 2 of 3 slices',
			'title 10',
			'title 12'
		]);

		v.roll().click();
		flushSync();
		expect(v.roll().getAttribute('aria-expanded')).toBe('false');
		expect(v.titles()).toHaveLength(2);
		unmount(v.app);
	});

	// Two roll-ups must not share one open flag — the state is a set of program
	// ids precisely so expanding one does not expand the other.
	it('expands each program independently', () => {
		const other = program({
			node_id: 901,
			title: 'deploy from the store',
			slice_count: 2,
			slices: [slice(20), slice(21)]
		});
		const v = render({
			queue: [row(10), row(20), row(12), row(21)],
			programs: [program(), other]
		});
		const rolls = () => [...v.target.querySelectorAll('button.roll')] as HTMLButtonElement[];
		expect(rolls()).toHaveLength(2);

		rolls()[1].click();
		flushSync();
		expect(rolls().map((b) => b.getAttribute('aria-expanded'))).toEqual(['false', 'true']);
		expect(v.titles().filter((t) => t.startsWith('slice') || t.startsWith('title'))).toEqual([
			'title 20',
			'title 21'
		]);
		unmount(v.app);
	});

	// #1284. Every project chip sits inside one `.chips` wrapper, whatever the
	// row type, because that wrapper is the only thing giving the line breaker
	// somewhere to break: four adjacent inline chips measured 349px of
	// unbreakable run and pushed the whole table 178px out of its panel. The
	// assertion is structural (`td.qproj > .chips > .proj`) because the CSS that
	// fixes the leak selects exactly that shape.
	it('wraps every row`s project chips in one breakable group', () => {
		const v = render({ queue: [row(5), row(10), row(12)], programs: [program()] });
		expect(v.chips()).toEqual([['korg'], ['korg', 'kfdc']]);

		v.roll().click();
		flushSync();
		// Revealed slices carry the same shape — a row type that skipped it would
		// leak the moment a program spanned more than a couple of projects.
		expect(v.chips()).toEqual([['korg'], ['korg', 'kfdc'], ['korg'], ['korg']]);
		unmount(v.app);
	});

	// An unprogrammed queue must render no disclosure at all — the roll-up is
	// the exception, not the row type.
	it('renders no roll-up when no program contributes two queue rows', () => {
		const v = render({ queue: [row(5), row(10)], programs: [program()] });
		expect(v.target.querySelector('button.roll')).toBeNull();
		expect(v.titles()).toEqual(['title 5', 'title 10']);
		unmount(v.app);
	});
});

// Wall mode (#1204): an unattended widescreen with nobody at the keyboard. The
// roll-up is the board's ONLY interactive control, so it is the only thing
// wall mode has to decide about — and the decision is that an affordance the
// wall cannot honour should not be drawn.
describe('On Deck on the wall', () => {
	it('renders the roll-up as text: collapsed, inert, and no caret', () => {
		const v = render({ wall: true });
		expect(v.target.querySelector('button')).toBeNull();
		expect(v.target.querySelector('span.roll')).not.toBeNull();
		// Same row, minus the caret. `2 of 3 slices` stays: that is the honest
		// half — it says there is more behind the row without offering to open
		// it — and #1064's argument is that the collapsed form is the
		// informative one anyway, not a compromise.
		expect(v.titles()).toEqual(['title 5', 'program sequencing on the board 2 of 3 slices']);
		unmount(v.app);
	});

	// Withdrawing the control must withdraw the disclosure with it — a wall
	// stuck open would be showing rows #1064 removed on purpose, forever.
	it('never reveals slices, because nothing can ask it to', () => {
		const v = render({ wall: true });
		expect([...v.target.querySelectorAll('tr.prog-slice')]).toHaveLength(0);
		unmount(v.app);
	});

	// The desk board keeps its control. Wall mode is a display MODE over one
	// board, and the mode is the only thing that decides this.
	it('leaves the desk board`s disclosure exactly as it was', () => {
		const v = render({ wall: false });
		expect(v.roll()).not.toBeNull();
		expect(v.titles()[1]).toBe('▸ program sequencing on the board 2 of 3 slices');
		unmount(v.app);
	});
});

// #1540. A parked queue row is only ever on screen because the reader ticked
// "include parked" — so it has to say which rows those are. This gap was found
// by looking at the rendered board and not by any test: the palette gate covers
// the PROGRAM literals and had nothing to say about a queue row, which carries
// no status chip at all in the ordinary case.
describe('the parked marker', () => {
	const parkedChips = (t: HTMLElement) =>
		[...t.querySelectorAll('td.qproj span.status.parked')].map((e) => e.textContent!.trim());

	it('marks a parked queue row', () => {
		const v = render({ queue: [row(5), row(7, { status: 'parked' })], programs: [] });
		expect(parkedChips(v.target)).toEqual(['parked']);
		unmount(v.app);
	});

	it('marks nothing when korg has parked nothing', () => {
		const v = render({ queue: [row(5), row(7)], programs: [] });
		expect(parkedChips(v.target)).toEqual([]);
		unmount(v.app);
	});

	// Beside the project chip and inside the same wrapper, so the two wrap
	// together — #1284 measured what an unbreakable inline run costs this panel.
	it('puts the marker in the chips wrapper with the project', () => {
		const v = render({ queue: [row(7, { status: 'parked' })], programs: [] });
		const chips = v.target.querySelector('td.qproj span.chips')!;
		expect(chips.querySelector('span.status.parked')).not.toBeNull();
		expect([...chips.children].map((c) => c.className)).toEqual(['proj', 'status parked']);
		unmount(v.app);
	});
});
