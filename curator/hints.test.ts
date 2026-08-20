import { describe, expect, it } from 'vitest';
import {
	AMBIENT_MAX,
	MAX_HINTS,
	collisionHints,
	renderHints,
	tokens,
	type BoardContext,
	type ProposalProse
} from './hints.ts';

function prose(node_id: number, over: Partial<ProposalProse> = {}): ProposalProse {
	return {
		node_id,
		title: `proposal ${node_id}`,
		project: 'kfdc',
		summary: '',
		notes: null,
		comments: [],
		...over
	};
}

const EMPTY: BoardContext = { proposal_edges: [], blocked: [], programs: [] };

function names(ps: ProposalProse[], ctx: BoardContext = EMPTY) {
	return collisionHints(ps, ctx).candidates.map((c) => [c.sides[0].node_id, c.sides[1].node_id]);
}

describe('tokens', () => {
	it('finds file paths, backticked or bare', () => {
		const m = tokens(
			prose(1, { summary: 'touches `src/lib/board.ts`', notes: 'and docs/design.md' })
		);
		expect(m.map((x) => x.token).sort()).toEqual(['docs/design.md', 'src/lib/board.ts']);
		expect(m.every((x) => x.kind === 'file')).toBe(true);
	});

	it('records which field named the token', () => {
		const m = tokens(
			prose(1, {
				summary: '`src/lib/board.ts`',
				notes: '`src/lib/board.ts` again',
				comments: [{ body: 'also `src/lib/board.ts`' }]
			})
		);
		expect(m).toHaveLength(1);
		expect(m[0].fields).toEqual(['summary', 'notes', 'comments']);
	});

	it('does not mistake a tailnet hostname for a TypeScript file', () => {
		const m = tokens(prose(1, { summary: 'served at kubsdb.encke-wahoo.ts.net:8100' }));
		expect(m).toEqual([]);
	});

	it('does not mine paths out of URLs', () => {
		const m = tokens(prose(1, { summary: 'see https://example.invalid/docs/design.md for it' }));
		expect(m).toEqual([]);
	});

	it('finds method-and-path endpoints', () => {
		const m = tokens(prose(1, { summary: 'both consume `GET /api/board` today' }));
		expect(m).toEqual([{ kind: 'endpoint', token: 'GET /api/board', fields: ['summary'] }]);
	});

	it('finds contract symbols only inside backticks', () => {
		const m = tokens(
			prose(1, { summary: 'the `sequenced_by` field', notes: 'a collides-with edge' })
		);
		expect(m).toEqual([{ kind: 'symbol', token: 'sequenced_by', fields: ['summary'] }]);
	});

	it('ignores the curator its own synopsis comment', () => {
		const m = tokens(
			prose(1, {
				comments: [
					{
						body: '⟦curator⟧ blocked\n\ndeconfliction:\n- collides-with korg:9 — same `src/lib/board.ts`'
					},
					{ body: 'human: touches `src/lib/netlog.ts`' }
				]
			})
		);
		expect(m.map((x) => x.token)).toEqual(['src/lib/netlog.ts']);
	});
});

describe('collisionHints', () => {
	it('pairs two proposals naming the same file', () => {
		const r = collisionHints(
			[
				prose(10, { notes: '`src/lib/board.ts`' }),
				prose(20, { summary: 'rewrites src/lib/board.ts' })
			],
			EMPTY
		);
		expect(r.candidates).toHaveLength(1);
		expect(r.candidates[0].shared).toEqual([{ kind: 'file', token: 'src/lib/board.ts', docs: 2 }]);
		expect(r.candidates[0].sides.map((s) => s.fields)).toEqual([['notes'], ['summary']]);
	});

	it('emits an undirected pair once, low node id first', () => {
		expect(
			names([
				prose(90, { summary: '`src/lib/board.ts`' }),
				prose(20, { summary: '`src/lib/board.ts`' })
			])
		).toEqual([[20, 90]]);
	});

	it('says nothing about proposals sharing no artifact', () => {
		expect(
			names([
				prose(10, { summary: '`src/lib/board.ts`' }),
				prose(20, { summary: '`src/lib/ticker.ts`' })
			])
		).toEqual([]);
	});

	it('drops a token the whole queue names — vocabulary, not collision', () => {
		const ambient = Array.from({ length: AMBIENT_MAX + 1 }, (_, i) =>
			prose(10 + i, { summary: 'per `docs/design.md`' })
		);
		const r = collisionHints(ambient, EMPTY);
		expect(r.candidates).toEqual([]);
		expect(r.suppressed.ambient).toBe(1);
	});

	it('drops a pair korg already carries an edge for, either direction', () => {
		const ps = [
			prose(10, { summary: '`src/lib/board.ts`' }),
			prose(20, { summary: '`src/lib/board.ts`' })
		];
		const r = collisionHints(ps, {
			...EMPTY,
			proposal_edges: [{ left: 20, right: 10, label: 'collides-with' }]
		});
		expect(r.candidates).toEqual([]);
		expect(r.suppressed.recorded).toBe(1);
	});

	it('drops a pair a live program already sequences (kfdc #1070)', () => {
		const ps = [
			prose(10, { summary: '`src/lib/board.ts`' }),
			prose(20, { summary: '`src/lib/board.ts`' })
		];
		const r = collisionHints(ps, {
			...EMPTY,
			blocked: [{ via: 'proposal', dependent: 20, blocker: 10, sequenced_by: 77 }]
		});
		expect(r.candidates).toEqual([]);
		expect(r.suppressed.sequenced).toBe(1);
	});

	it('drops a pair one program already orders as slices', () => {
		const ps = [
			prose(10, { summary: '`src/lib/board.ts`' }),
			prose(20, { summary: '`src/lib/board.ts`' })
		];
		const r = collisionHints(ps, {
			...EMPTY,
			programs: [{ node_id: 77, slices: [{ node_id: 10 }, { node_id: 20 }] }]
		});
		expect(r.candidates).toEqual([]);
		expect(r.suppressed.sameProgram).toBe(1);
	});

	it('ranks a rare shared file above a common shared symbol', () => {
		const ps = [
			prose(10, { summary: '`src/lib/ticker.ts`' }),
			prose(20, { summary: '`src/lib/ticker.ts`' }),
			prose(30, { summary: '`sequenced_by`' }),
			prose(40, { summary: '`sequenced_by`' })
		];
		expect(names(ps)).toEqual([
			[10, 20],
			[30, 40]
		]);
	});

	it('docks a shared path across projects — it is two different files', () => {
		const same = collisionHints(
			[prose(10, { summary: '`docs/usage.md`' }), prose(20, { summary: '`docs/usage.md`' })],
			EMPTY
		);
		const cross = collisionHints(
			[
				prose(10, { summary: '`docs/usage.md`', project: 'kyac' }),
				prose(20, { summary: '`docs/usage.md`', project: 'klams' })
			],
			EMPTY
		);
		expect(cross.candidates[0].crossProject).toBe(true);
		expect(cross.candidates[0].score).toBeLessThan(same.candidates[0].score);
		expect(renderHints(cross, '2026-08-19')).toContain('weak: different projects');
	});

	it('does not dock a shared contract across projects — that is what a contract is', () => {
		const cross = collisionHints(
			[
				prose(10, { summary: 'both read `GET /api/board`', project: 'kfdc' }),
				prose(20, { summary: 'widen `GET /api/board`', project: 'korg' })
			],
			EMPTY
		);
		const same = collisionHints(
			[
				prose(10, { summary: 'both read `GET /api/board`' }),
				prose(20, { summary: 'widen `GET /api/board`' })
			],
			EMPTY
		);
		expect(cross.candidates[0].score).toBe(same.candidates[0].score);
		expect(renderHints(cross, '2026-08-19')).not.toContain('weak: different projects');
	});

	it('caps the list and reports what the cap hid', () => {
		// One shared file per pair: 2*(MAX_HINTS+2) proposals, no cross-talk.
		const ps = Array.from({ length: (MAX_HINTS + 2) * 2 }, (_, i) =>
			prose(100 + i, { summary: `\`src/lib/p${Math.floor(i / 2)}.ts\`` })
		);
		const r = collisionHints(ps, EMPTY);
		expect(r.candidates).toHaveLength(MAX_HINTS);
		expect(r.suppressed.overCap).toBe(2);
	});

	it('is a pure function of the queue — same input, identical block', () => {
		const build = () => [
			prose(10, { notes: '`src/lib/board.ts`' }),
			prose(20, { summary: '`src/lib/board.ts`' })
		];
		expect(renderHints(collisionHints(build(), EMPTY), '2026-08-19')).toEqual(
			renderHints(collisionHints(build(), EMPTY), '2026-08-19')
		);
	});
});

describe('renderHints', () => {
	it('says none out loud rather than rendering an empty block', () => {
		const block = renderHints(collisionHints([], EMPTY), '2026-08-19');
		expect(block).toMatch(/none/);
	});

	it('names both sides, the shared token and where each names it', () => {
		const r = collisionHints(
			[prose(10, { notes: '`src/lib/board.ts`' }), prose(20, { summary: '`src/lib/board.ts`' })],
			EMPTY
		);
		const block = renderHints(r, '2026-08-19');
		expect(block).toContain('korg:10');
		expect(block).toContain('korg:20');
		expect(block).toContain('src/lib/board.ts');
		expect(block).toContain('notes');
	});
});
