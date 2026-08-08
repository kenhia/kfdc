// kfdc's first component test (#1102). The roll-up's disclosure (#1064) is
// the board's only piece of client state, so it is the only thing here that a
// pure derivation test cannot reach — `onDeckRows` is covered in board.test.ts
// and is deliberately not re-asserted through the DOM.
import { flushSync, mount, unmount, type ComponentProps } from 'svelte';
import { describe, expect, it } from 'vitest';
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
		roll: () => target.querySelector('button.roll') as HTMLButtonElement
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

	// An unprogrammed queue must render no disclosure at all — the roll-up is
	// the exception, not the row type.
	it('renders no roll-up when no program contributes two queue rows', () => {
		const v = render({ queue: [row(5), row(10)], programs: [program()] });
		expect(v.target.querySelector('button.roll')).toBeNull();
		expect(v.titles()).toEqual(['title 5', 'title 10']);
		unmount(v.app);
	});
});
