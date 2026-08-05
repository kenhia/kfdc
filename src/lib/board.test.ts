import { describe, expect, it } from 'vitest';
import { formatAge, progress, statline, type Board, type ProposalRow } from './board';

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
	...over
});

const board = (over: Partial<Board> = {}): Board => ({
	generated: '2026-08-05T12:00:00Z',
	active: [row(), row({ node_id: 2 })],
	queue: [row({ node_id: 3, status: 'proposed' })],
	proposals_omitted: { done: 114, declined: 4, archived: 6 },
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
