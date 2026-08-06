import { describe, expect, it } from 'vitest';
import type { Board, ProposalEdge, ProposalRow } from './board';
import { deconfliction, parseSynopsis } from './curator';

const MARK = '⟦curator⟧';

const row = (over: Partial<ProposalRow> = {}): ProposalRow => ({
	node_id: 1,
	title: 't',
	summary: 's',
	project: 'korg',
	status: 'active',
	rank: '1',
	pinned: false,
	comment_count: 0,
	covered_count: 0,
	open: 0,
	resolved: 0,
	done: 0,
	closed: 0,
	updated: '2026-08-06T00:00:00Z',
	synopsis: null,
	...over
});

const edge = (over: Partial<ProposalEdge> = {}): ProposalEdge => ({
	left: 1,
	right: 2,
	label: 'depends_on',
	directed: true,
	origin: 'kfdc-curator',
	created: '2026-08-06T00:00:00Z',
	...over
});

const board = (over: Partial<Board> = {}): Board => ({
	generated: '2026-08-06T01:00:00Z',
	active: [],
	queue: [],
	proposals_omitted: { done: 0, declined: 0, archived: 0 },
	proposal_edges: [],
	programs: [],
	programs_omitted: { done: 0, archived: 0 },
	awaiting: [],
	depth: [],
	reports: [],
	...over
});

describe('parseSynopsis', () => {
	it('rejects bodies that do not open with the marker', () => {
		expect(parseSynopsis('a human comment')).toBeNull();
		expect(parseSynopsis(`prefix ${MARK} not first`)).toBeNull();
	});

	it('extracts the synopsis line, deconfliction lines, and trailer', () => {
		const body = [
			`${MARK} harness landed; mining pass in design`,
			'',
			'deconfliction:',
			'- after korg:1004 — needs the substrate slice deployed (mined from proposal korg:999 notes, 2026-08-06)',
			'- collides-with korg:825 — both rewrite WorkItemRow (mined from comment on korg:825, 2026-08-01)',
			'',
			'mined from: proposal korg:999 notes, observed 2026-08-06'
		].join('\n');
		const p = parseSynopsis(body);
		expect(p).not.toBeNull();
		expect(p!.line).toBe('harness landed; mining pass in design');
		expect(p!.deconfliction).toEqual([
			{
				kind: 'after',
				other: 1004,
				why: 'needs the substrate slice deployed',
				minedFrom: 'proposal korg:999 notes, 2026-08-06'
			},
			{
				kind: 'collides-with',
				other: 825,
				why: 'both rewrite WorkItemRow',
				minedFrom: 'comment on korg:825, 2026-08-01'
			}
		]);
		expect(p!.minedFrom).toBe('proposal korg:999 notes, observed 2026-08-06');
	});

	it('tolerates a marker-only synopsis with no sections', () => {
		const p = parseSynopsis(`${MARK} one line only`);
		expect(p!.line).toBe('one line only');
		expect(p!.deconfliction).toEqual([]);
		expect(p!.minedFrom).toBeNull();
	});

	it('keeps a deconfliction line without a mined-from parenthetical', () => {
		const p = parseSynopsis(`${MARK} s\n\ndeconfliction:\n- after korg:7 — reason only`);
		expect(p!.deconfliction).toEqual([
			{ kind: 'after', other: 7, why: 'reason only', minedFrom: null }
		]);
	});

	// Verbatim from the first production pass (2026-08-06, korg:749) — the
	// write side and this parser met for the first time on this body.
	it('parses the first real curator body byte-for-byte', () => {
		const body = [
			`${MARK} Blocked behind two prerequisites: the kprojects installer (#912) and the package-store unpin (#748) must land first.`,
			'',
			'deconfliction:',
			'- after korg:912 — migrating at scale before the installer is portable/stack-aware forces rework (mined from proposal korg:912 notes, 2026-08-06)',
			"- after korg:748 — the WI's own notes prefer #728 resolved first so each repo has one clone (mined from proposal korg:749 notes, 2026-08-06)",
			'',
			'mined from: proposal korg:749 notes and comments; proposal korg:912 and korg:748 notes, observed 2026-08-06'
		].join('\n');
		const p = parseSynopsis(body)!;
		expect(p.line).toMatch(/^Blocked behind two prerequisites/);
		expect(p.deconfliction.map((d) => d.other)).toEqual([912, 748]);
		expect(p.deconfliction[0].minedFrom).toBe('proposal korg:912 notes, 2026-08-06');
		expect(p.minedFrom).toMatch(/observed 2026-08-06$/);
	});
});

describe('deconfliction', () => {
	it('builds cards only from depends_on/collides-with edges between board rows', () => {
		const b = board({
			active: [row({ node_id: 1, title: 'one', project: 'korg' })],
			queue: [row({ node_id: 2, title: 'two', project: 'kfdc', status: 'proposed' })],
			proposal_edges: [
				edge({ left: 1, right: 2, label: 'depends_on' }),
				edge({ left: 1, right: 2, label: 'related-to', directed: false }),
				edge({ left: 1, right: 99, label: 'depends_on' }) // endpoint not on the board
			]
		});
		const cards = deconfliction(b);
		expect(cards).toHaveLength(1);
		expect(cards[0].kind).toBe('after');
		expect(cards[0].left).toEqual({ node_id: 1, title: 'one', project: 'korg' });
		expect(cards[0].right).toEqual({ node_id: 2, title: 'two', project: 'kfdc' });
	});

	it('attaches prose and provenance from either endpoint synopsis', () => {
		const synBody = `${MARK} s\n\ndeconfliction:\n- collides-with korg:2 — same contract, fold second (mined from comment on korg:1, 2026-08-05)`;
		const b = board({
			active: [row({ node_id: 1, synopsis: { body: synBody, updated: '2026-08-06T00:00:00Z' } })],
			queue: [row({ node_id: 2, status: 'proposed' })],
			proposal_edges: [edge({ left: 2, right: 1, label: 'collides-with', directed: false })]
		});
		const [card] = deconfliction(b);
		expect(card.why).toBe('same contract, fold second');
		expect(card.minedFrom).toBe('comment on korg:1, 2026-08-05');
	});

	it('orders collisions before sequencing, newest first within each', () => {
		const b = board({
			active: [row({ node_id: 1 }), row({ node_id: 2 }), row({ node_id: 3 })],
			proposal_edges: [
				edge({ left: 1, right: 2, label: 'depends_on', created: '2026-08-06T02:00:00Z' }),
				edge({ left: 2, right: 3, label: 'collides-with', created: '2026-08-06T01:00:00Z' }),
				edge({ left: 1, right: 3, label: 'collides-with', created: '2026-08-06T03:00:00Z' })
			]
		});
		expect(deconfliction(b).map((c) => [c.kind, c.created])).toEqual([
			['collides-with', '2026-08-06T03:00:00Z'],
			['collides-with', '2026-08-06T01:00:00Z'],
			['after', '2026-08-06T02:00:00Z']
		]);
	});
});
