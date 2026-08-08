import { describe, expect, it } from 'vitest';
import type { Board, BlockedRow, ProposalEdge, ProposalRow } from './board';
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

const blocked = (over: Partial<BlockedRow> = {}): BlockedRow => ({
	proposal: 1,
	via: 'proposal',
	dependent: 1,
	dependent_wi_number: null,
	blocker: 2,
	blocker_kind: 'sprint_proposal',
	blocker_wi_number: null,
	blocker_title: 'two',
	blocker_project: 'kfdc',
	blocker_status: 'proposed',
	sequenced_by: null,
	...over
});

const board = (over: Partial<Board> = {}): Board => ({
	generated: '2026-08-06T01:00:00Z',
	active: [],
	queue: [],
	proposals_omitted: { done: 0, declined: 0, archived: 0 },
	proposal_edges: [],
	blocked: [],
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
		const { cards } = deconfliction(b);
		expect(cards).toHaveLength(1);
		expect(cards[0].kind).toBe('after');
		// #1027: chips read left-to-right in execution order — 1 depends_on 2,
		// so the prerequisite (2) renders first and the arrow points with time.
		expect(cards[0].chips).toEqual([
			{ node_id: 2, title: 'two', project: 'kfdc' },
			{ node_id: 1, title: 'one', project: 'korg' }
		]);
	});

	it('keeps collision chips in edge order — collisions are unordered', () => {
		const b = board({
			active: [row({ node_id: 1, title: 'one' }), row({ node_id: 2, title: 'two' })],
			proposal_edges: [edge({ left: 1, right: 2, label: 'collides-with', directed: false })]
		});
		expect(deconfliction(b).cards[0].chips.map((c) => c.node_id)).toEqual([1, 2]);
	});

	it('attaches prose and provenance from either endpoint synopsis', () => {
		const synBody = `${MARK} s\n\ndeconfliction:\n- collides-with korg:2 — same contract, fold second (mined from comment on korg:1, 2026-08-05)`;
		const b = board({
			active: [row({ node_id: 1, synopsis: { body: synBody, updated: '2026-08-06T00:00:00Z' } })],
			queue: [row({ node_id: 2, status: 'proposed' })],
			proposal_edges: [edge({ left: 2, right: 1, label: 'collides-with', directed: false })]
		});
		const [card] = deconfliction(b).cards;
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
		expect(deconfliction(b).cards.map((c) => [c.kind, c.created])).toEqual([
			['collides-with', '2026-08-06T03:00:00Z'],
			['collides-with', '2026-08-06T01:00:00Z'],
			['after', '2026-08-06T02:00:00Z']
		]);
	});

	// kfdc #1070, answered by korg #978's `sequenced_by`: a program already
	// draws its declared order in Operations, so Deconfliction does not draw
	// the same fact a second time. kfdc cannot filter what korg did not label.
	describe('program-sequenced dependencies (#1070)', () => {
		const twoRows = { active: [row({ node_id: 1 })], queue: [row({ node_id: 2 })] };

		it('sets aside a dependency a live program already sequences', () => {
			const b = board({
				...twoRows,
				proposal_edges: [edge({ left: 1, right: 2, label: 'depends_on' })],
				blocked: [blocked({ dependent: 1, blocker: 2, sequenced_by: 900 })]
			});
			const view = deconfliction(b);
			expect(view.cards).toEqual([]);
			expect(view.sequenced.map((c) => c.sequencedBy)).toEqual([900]);
		});

		it('still draws an unsequenced blocker — that is a real collision', () => {
			const b = board({
				...twoRows,
				proposal_edges: [edge({ left: 1, right: 2, label: 'depends_on' })],
				blocked: [blocked({ dependent: 1, blocker: 2, sequenced_by: null })]
			});
			const view = deconfliction(b);
			expect(view.cards).toHaveLength(1);
			expect(view.cards[0].sequencedBy).toBeNull();
			expect(view.sequenced).toEqual([]);
		});

		// The key is the edge's own direction: dependent→blocker is left→right.
		// A reversed match would silently hide the wrong card.
		it('does not match a blocked entry pointing the other way', () => {
			const b = board({
				...twoRows,
				proposal_edges: [edge({ left: 1, right: 2, label: 'depends_on' })],
				blocked: [blocked({ dependent: 2, blocker: 1, sequenced_by: 900 })]
			});
			expect(deconfliction(b).cards).toHaveLength(1);
		});

		// A `covered` entry hangs off a work item inside the row, so its
		// `dependent` is a WI number that must never collide with a proposal id.
		it('ignores a covered-level entry when matching proposal edges', () => {
			const b = board({
				...twoRows,
				proposal_edges: [edge({ left: 1, right: 2, label: 'depends_on' })],
				blocked: [blocked({ via: 'covered', dependent: 1, blocker: 2, sequenced_by: 900 })]
			});
			expect(deconfliction(b).cards).toHaveLength(1);
		});

		// A collision is unordered; no program order can express one, so the
		// suppression must never reach it even if korg reported the same pair.
		it('never sets aside a collision', () => {
			const b = board({
				...twoRows,
				proposal_edges: [edge({ left: 1, right: 2, label: 'collides-with', directed: false })],
				blocked: [blocked({ dependent: 1, blocker: 2, sequenced_by: 900 })]
			});
			expect(deconfliction(b).cards).toHaveLength(1);
			expect(deconfliction(b).cards[0].sequencedBy).toBeNull();
		});
	});
});
