import { describe, expect, it } from 'vitest';
import type { Board, ProposalRow } from './board';
import {
	diffDigests,
	digestBoard,
	formatLine,
	fragment,
	lineHref,
	type Digest,
	type NetLogLine
} from './netlog';

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
	active: [],
	queue: [],
	proposals_omitted: { done: 100, declined: 0, archived: 0 },
	proposal_edges: [],
	programs: [],
	programs_omitted: { done: 0, archived: 0 },
	awaiting: [],
	depth: [],
	reports: [],
	...over
});

const digest = (over: Partial<Digest> = {}): Digest => ({
	v: 1,
	generated: '2026-08-05T12:00:00Z',
	fm: {},
	od: {},
	cc: {},
	op: {},
	done: 100,
	...over
});

const fm = (complete: number, total: number, title = 't', project = 'kfdc') => ({
	title,
	project,
	complete,
	total
});

describe('digestBoard', () => {
	it('reduces each panel to its significant fields', () => {
		const d = digestBoard(
			board({
				active: [row({ node_id: 994, title: 'Net Log', resolved: 1, closed: 1 })],
				queue: [row({ node_id: 5, status: 'proposed', title: 'q' })],
				awaiting: [
					{
						node_id: 744,
						kind: 'workitem',
						wi_number: 744,
						title: 'kagent-harness',
						project: 'agent-skills',
						status: 'open',
						archived: false,
						awaiting_note: 'decide, then delete',
						awaiting_since: '2026-08-01T00:00:00Z'
					}
				],
				programs: [
					{
						node_id: 979,
						title: 'Phase 0',
						aim: '',
						status: 'active',
						span: ['korg'],
						slice_count: 1,
						slices: [
							{
								node_id: 973,
								title: 'Board rollup read',
								project: 'korg',
								status: 'done',
								rank: '0',
								open: 0,
								resolved: 0,
								done: 0,
								closed: 1,
								covered_count: 1
							}
						]
					}
				]
			})
		);
		expect(d).toEqual(
			digest({
				fm: { 994: fm(2, 4, 'Net Log', 'p') },
				od: { 5: { title: 'q', project: 'p' } },
				cc: {
					744: {
						title: 'kagent-harness',
						project: 'agent-skills',
						kind: 'workitem',
						wi_number: 744,
						note: 'decide, then delete'
					}
				},
				op: {
					979: {
						title: 'Phase 0',
						status: 'active',
						slices: { 973: { title: 'Board rollup read', project: 'korg', status: 'done' } }
					}
				}
			})
		);
	});
});

describe('diffDigests', () => {
	it('is silent when nothing changed', () => {
		const d = digest({ fm: { 1: fm(0, 4) }, od: { 2: { title: 'q', project: 'p' } } });
		expect(diffDigests(d, d)).toEqual([]);
	});

	it('reports a new fire mission as firing', () => {
		const out = diffDigests(digest(), digest({ fm: { 994: fm(0, 2, 'Net Log') } }));
		expect(out.map(formatLine)).toEqual(['FM: firing kfdc 994 - Net Log']);
	});

	it('reports the work-complete transition as splash, once', () => {
		const before = digest({ fm: { 983: fm(1, 2) } });
		const after = digest({ fm: { 983: fm(2, 2) } });
		expect(diffDigests(before, after).map(formatLine)).toEqual([
			'FM: splash kfdc 983 - work complete'
		]);
		expect(diffDigests(after, after)).toEqual([]);
	});

	it('reads an FM departure as completed when the shipped count rose', () => {
		const out = diffDigests(digest({ fm: { 984: fm(2, 2) } }), digest({ done: 101 }));
		expect(out.map(formatLine)).toEqual(['FM: complete kfdc 984 - proposal completed']);
	});

	it('reads an FM departure as out when the shipped count did not rise', () => {
		const out = diffDigests(digest({ fm: { 984: fm(1, 2) } }), digest());
		expect(out.map(formatLine)).toEqual(['FM: out kfdc 984 - left the board']);
	});

	it('collapses a demotion to one FM line and a promotion to one firing line', () => {
		const active = digest({ fm: { 7: fm(0, 3, 'x') } });
		const queued = digest({ od: { 7: { title: 'x', project: 'kfdc' } } });
		expect(diffDigests(active, queued).map(formatLine)).toEqual(['FM: out kfdc 7 - back on deck']);
		expect(diffDigests(queued, active).map(formatLine)).toEqual(['FM: firing kfdc 7 - x']);
	});

	it('reports queue entry and exit', () => {
		const q = digest({ od: { 5: { title: 'q', project: 'korg' } } });
		expect(diffDigests(digest(), q).map(formatLine)).toEqual(['OD: on deck korg 5 - q']);
		expect(diffDigests(q, digest()).map(formatLine)).toEqual(['OD: off deck korg 5 - q']);
	});

	it('reports a call made with the note, and a clearance without it', () => {
		const call = {
			title: 'kagent-harness',
			project: 'agent-skills',
			kind: 'workitem',
			wi_number: 744,
			note: 'decide, then delete'
		};
		const withCall = digest({ cc: { 744: call } });
		expect(diffDigests(digest(), withCall).map(formatLine)).toEqual([
			'CC: call made - agent-skills 744 kagent-harness - decide, then delete'
		]);
		expect(diffDigests(withCall, digest()).map(formatLine)).toEqual([
			'CC: cleared - agent-skills 744 kagent-harness'
		]);
	});

	it('reports a program status change and nothing else about programs', () => {
		const before = digest({ op: { 979: { title: 'Phase 0', status: 'active' } } });
		const after = digest({ op: { 979: { title: 'Phase 0', status: 'done' } } });
		expect(diffDigests(before, after).map(formatLine)).toEqual([
			'OP: status active→done 979 - Phase 0'
		]);
		// v1 vocabulary: appearance alone is not traffic.
		expect(diffDigests(digest(), before)).toEqual([]);
	});

	// #1029: a slice ticking IS the program moving.
	it('reports a slice status transition as OP traffic', () => {
		const slice = (status: string) => ({
			title: 'korg deploys via the registry',
			project: 'korg',
			status
		});
		const op = (status: string) => ({
			1026: { title: 'Deploy from the store', status: 'active', slices: { 1021: slice(status) } }
		});
		const out = diffDigests(digest({ op: op('proposed') }), digest({ op: op('active') }));
		expect(out.map(formatLine)).toEqual([
			'OP: slice proposed→active korg 1021 - korg deploys via the registry'
		]);
		// A slice is a proposal — the line deep-links like one.
		expect(lineHref(out[0], 'https://korg.example')).toBe('https://korg.example/planning');
	});

	it('is silent when a pre-slice digest is the baseline, and on slice appearance', () => {
		const withSlice = digest({
			op: {
				1026: {
					title: 'D',
					status: 'active',
					slices: { 1021: { title: 't', project: 'korg', status: 'active' } }
				}
			}
		});
		// The digest on disk predates #1029: no slices key at all.
		expect(
			diffDigests(digest({ op: { 1026: { title: 'D', status: 'active' } } }), withSlice)
		).toEqual([]);
		// Appearance alone is not traffic, matching the program rule.
		expect(
			diffDigests(digest({ op: { 1026: { title: 'D', status: 'active', slices: {} } } }), withSlice)
		).toEqual([]);
	});

	it('stamps every line with the observing digest generation time', () => {
		const out = diffDigests(
			digest(),
			digest({ generated: '2026-08-05T13:00:00Z', fm: { 1: fm(0, 1) } })
		);
		expect(out.every((l) => l.observed === '2026-08-05T13:00:00Z')).toBe(true);
	});
});

describe('fragment', () => {
	it('passes short titles through and ellipsizes long ones', () => {
		expect(fragment('short')).toBe('short');
		const long = 'x'.repeat(80);
		expect(fragment(long)).toBe('x'.repeat(59) + '…');
	});
});

describe('lineHref', () => {
	const line = (over: Partial<NetLogLine>): NetLogLine => ({
		observed: '2026-08-05T12:00:00Z',
		panel: 'CC',
		verb: 'call made',
		project: 'p',
		node_id: 1,
		wi_number: null,
		kind: 'other',
		text: 't',
		...over
	});
	const base = 'https://korg.example';

	// korg's own AwaitingLane scheme: WI by number, program page, Planning.
	it('links what korg has a page for and degrades the rest to null', () => {
		expect(lineHref(line({ kind: 'workitem', wi_number: 744 }), base)).toBe(
			'https://korg.example/work-items?wi=744'
		);
		expect(lineHref(line({ kind: 'program', node_id: 979 }), base)).toBe(
			'https://korg.example/programs/979'
		);
		expect(lineHref(line({ kind: 'sprint_proposal' }), base)).toBe('https://korg.example/planning');
		expect(lineHref(line({ kind: 'workitem', wi_number: null }), base)).toBeNull();
		expect(lineHref(line({}), base)).toBeNull();
	});
});
