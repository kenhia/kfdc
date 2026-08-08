import { describe, expect, it } from 'vitest';
import {
	fireMissionOrder,
	formatAge,
	onDeckRows,
	progress,
	splashing,
	statline,
	type Board,
	type ProgramRow,
	type ProgramSlice,
	type ProposalRow
} from './board';

const row = (over: Partial<ProposalRow> = {}): ProposalRow => ({
	node_id: 1,
	title: 't',
	summary: 's',
	project: 'p',
	status: 'active',
	rank: '1',
	pinned: false,
	comment_count: 0,
	covered_count: 4,
	open: 4,
	resolved: 0,
	done: 0,
	closed: 0,
	updated: '2026-08-05T00:00:00Z',
	synopsis: null,
	...over
});

const board = (over: Partial<Board> = {}): Board => ({
	generated: '2026-08-05T12:00:00Z',
	active: [row(), row({ node_id: 2 })],
	queue: [row({ node_id: 3, status: 'proposed' })],
	proposals_omitted: { done: 114, declined: 4, archived: 6 },
	proposal_edges: [],
	blocked: [],
	programs: [],
	programs_omitted: { done: 1, archived: 0 },
	awaiting: [
		{
			node_id: 964,
			kind: 'workitem',
			wi_number: 964,
			title: 'khound pitch',
			project: 'agent-projects',
			status: 'open',
			archived: false,
			awaiting_note: 'proceed or kill',
			awaiting_since: '2026-08-05T06:45:10Z'
		}
	],
	depth: [
		{ project: 'korg', status: 'active', proposals: 3, wi_in_proposal: 5, wi_total: 9 },
		{ project: 'old', status: 'archived', proposals: 0, wi_in_proposal: 0, wi_total: 0 },
		{ project: 'kfdc', status: 'active', proposals: 1, wi_in_proposal: 4, wi_total: 4 }
	],
	reports: [],
	...over
});

describe('statline', () => {
	// D-3: every figure derives from the lists — no counters block to disagree with.
	it('derives live, shipped, awaiting, projects from the lists', () => {
		expect(statline(board())).toEqual({
			live: 3,
			active: 2,
			shipped: 114,
			awaiting: 1,
			projects: 2
		});
	});
});

describe('progress', () => {
	// korg #980 three-part semantics: work-complete / Ken-verified / total.
	it('counts resolved+done+closed as work-complete and closed alone as verified', () => {
		expect(progress(row({ open: 1, resolved: 1, done: 1, closed: 1, covered_count: 4 }))).toEqual({
			complete: 3,
			verified: 1,
			total: 4
		});
	});

	it('is all-zero-complete on a fresh proposal', () => {
		expect(progress(row())).toEqual({ complete: 0, verified: 0, total: 4 });
	});

	// #1029: a program slice carries the same four counts — one derivation,
	// not a fourth progress variant.
	it('derives the same three parts from a program slice', () => {
		expect(progress({ resolved: 0, done: 0, closed: 1, covered_count: 1 })).toEqual({
			complete: 1,
			verified: 1,
			total: 1
		});
	});
});

describe('splashing', () => {
	// #990: rounds complete, watch for impact — work-complete == total > 0.
	it('splashes exactly at work-complete == total, regardless of verification', () => {
		expect(splashing(row({ open: 0, resolved: 2, done: 1, closed: 1 }))).toBe(true);
		expect(splashing(row({ open: 1, resolved: 2, done: 0, closed: 1 }))).toBe(false);
	});

	it('never splashes an empty mission', () => {
		expect(splashing(row({ open: 0, covered_count: 0 }))).toBe(false);
	});
});

describe('fireMissionOrder', () => {
	it('sorts splashing missions to the top and otherwise preserves order', () => {
		const missions = [
			row({ node_id: 1 }),
			row({ node_id: 2, open: 0, resolved: 4 }),
			row({ node_id: 3 }),
			row({ node_id: 4, open: 0, resolved: 2, done: 2 })
		];
		expect(fireMissionOrder(missions).map((r) => r.node_id)).toEqual([2, 4, 1, 3]);
		// The input order itself is korg's — never mutated in place.
		expect(missions.map((r) => r.node_id)).toEqual([1, 2, 3, 4]);
	});
});

describe('onDeckRows', () => {
	const slice = (node_id: number, status = 'proposed'): ProgramSlice => ({
		node_id,
		title: `slice ${node_id}`,
		project: 'korg',
		status,
		rank: '0',
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
		slices: [slice(10), slice(11), slice(12)],
		...over
	});
	const queued = (node_id: number, over: Partial<ProposalRow> = {}) =>
		row({ node_id, status: 'proposed', ...over });

	// #1064: a program is already a declared sequence — repeating it row by row
	// adds rows without adding information.
	it('collapses a program`s queue rows into one, where korg put the first', () => {
		const rows = onDeckRows(
			[queued(5, { rank: '2' }), queued(10, { rank: '4' }), queued(12, { rank: '9' })],
			[program()]
		);
		expect(
			rows.map((r) => (r.kind === 'program' ? `prog:${r.program.node_id}` : r.row.node_id))
		).toEqual([5, 'prog:900']);
		const roll = rows[1];
		expect(roll.kind === 'program' && roll.rank).toBe('4');
		expect(roll.kind === 'program' && roll.slices.map((s) => s.node_id)).toEqual([10, 12]);
	});

	// The counter Ken asked for spans the whole program, not just the queue:
	// slice 10 is done, 11 is active and showing in Fire Missions, 12 is here.
	it('counts remaining over every unfinished slice, not the collapsed ones', () => {
		const p = program({ slices: [slice(10, 'done'), slice(11, 'active'), slice(12)] });
		const [roll] = onDeckRows([queued(11), queued(12)], [p]);
		expect(roll.kind === 'program' && [roll.remaining, roll.total]).toEqual([2, 3]);
	});

	it('treats a declined slice as finished', () => {
		const p = program({ slices: [slice(10, 'declined'), slice(11), slice(12)] });
		const [roll] = onDeckRows([queued(11), queued(12)], [p]);
		expect(roll.kind === 'program' && roll.remaining).toBe(2);
	});

	// One row is not row inflation, and the slice title says more than the
	// program title does.
	it('leaves a program contributing a single queue row uncollapsed', () => {
		const rows = onDeckRows([queued(5), queued(11)], [program()]);
		expect(rows.every((r) => r.kind === 'proposal')).toBe(true);
	});

	it('passes an unprogrammed queue through in korg`s order', () => {
		const rows = onDeckRows([queued(5), queued(6), queued(7)], []);
		expect(rows.map((r) => r.kind === 'proposal' && r.row.node_id)).toEqual([5, 6, 7]);
	});

	// korg sorts pinned first, so the roll-up lands on the pinned slice's rank
	// already; the flag has to survive the collapse or the ⚑ vanishes.
	it('keeps the pin when any collapsed slice carries it', () => {
		const [roll] = onDeckRows([queued(10, { pinned: true }), queued(12)], [program()]);
		expect(roll.kind === 'program' && roll.pinned).toBe(true);
	});

	it('collapses each program independently', () => {
		const other = program({
			node_id: 901,
			slice_count: 2,
			slices: [slice(20), slice(21)]
		});
		const rows = onDeckRows([queued(10), queued(20), queued(12), queued(21)], [program(), other]);
		expect(rows.map((r) => r.kind === 'program' && r.program.node_id)).toEqual([900, 901]);
	});
});

describe('formatAge', () => {
	const gen = '2026-08-05T12:00:00Z';
	it('renders minutes under an hour', () => {
		expect(formatAge(gen, '2026-08-05T11:19:00Z')).toBe('41m');
	});
	it('renders hours under two days', () => {
		expect(formatAge(gen, '2026-08-05T03:00:00Z')).toBe('9h');
	});
	it('renders days from two days up', () => {
		expect(formatAge(gen, '2026-07-22T12:00:00Z')).toBe('14d');
	});
	it('never goes negative on clock skew', () => {
		expect(formatAge(gen, '2026-08-05T12:00:05Z')).toBe('0m');
	});
});
