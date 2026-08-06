import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Board, ProposalRow } from '../board';
import { formatLine } from '../netlog';
import { createNetLogStore } from './netlog-store';

const row = (over: Partial<ProposalRow> = {}): ProposalRow => ({
	node_id: 1,
	title: 't',
	summary: 's',
	project: 'kfdc',
	status: 'active',
	rank: '1',
	pinned: false,
	comment_count: 0,
	covered_count: 2,
	open: 2,
	resolved: 0,
	done: 0,
	closed: 0,
	updated: '2026-08-05T00:00:00Z',
	synopsis: null,
	...over
});

const board = (generated: string, over: Partial<Board> = {}): Board => ({
	generated,
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

let dir: string;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'kfdc-netlog-'));
});
afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

describe('createNetLogStore', () => {
	it('baselines silently on first observation, then logs diffs newest-first', () => {
		const store = createNetLogStore(dir);
		expect(store.observe(board('2026-08-05T12:00:00Z'))).toEqual([]);
		store.observe(board('2026-08-05T12:03:00Z', { active: [row({ node_id: 994 })] }));
		store.observe(board('2026-08-05T12:06:00Z'));
		expect(store.recent().map(formatLine)).toEqual([
			'FM: out kfdc 994 - left the board',
			'FM: firing kfdc 994 - t'
		]);
	});

	it('ignores re-reads and stale responses of an already-digested board', () => {
		const store = createNetLogStore(dir);
		store.observe(board('2026-08-05T12:00:00Z'));
		const fired = board('2026-08-05T11:00:00Z', { active: [row()] });
		expect(store.observe(fired)).toEqual([]);
		expect(store.observe(board('2026-08-05T12:00:00Z', { active: [row()] }))).toEqual([]);
		expect(store.recent()).toEqual([]);
	});

	it('survives a restart: digest and transcript come back from disk', () => {
		createNetLogStore(dir).observe(board('2026-08-05T12:00:00Z'));
		const reopened = createNetLogStore(dir);
		const lines = reopened.observe(
			board('2026-08-05T12:05:00Z', { active: [row({ node_id: 994 })] })
		);
		expect(lines.map(formatLine)).toEqual(['FM: firing kfdc 994 - t']);
		expect(createNetLogStore(dir).recent().map(formatLine)).toEqual(['FM: firing kfdc 994 - t']);
	});

	it('compact drops lines older than the retention window', () => {
		const store = createNetLogStore(dir);
		store.observe(board('2026-06-01T12:00:00Z'));
		store.observe(board('2026-06-01T12:05:00Z', { active: [row({ node_id: 1 })] }));
		store.observe(
			board('2026-08-05T12:00:00Z', { active: [row({ node_id: 1 }), row({ node_id: 2 })] })
		);
		expect(store.recent()).toHaveLength(2);
		store.compact(Date.parse('2026-08-06T00:00:00Z'));
		expect(store.recent().map(formatLine)).toEqual(['FM: firing kfdc 2 - t']);
	});

	it('caps recent at the requested count, newest first', () => {
		const store = createNetLogStore(dir);
		store.observe(board('2026-08-05T12:00:00Z'));
		for (let i = 1; i <= 5; i++) {
			store.observe(
				board(`2026-08-05T12:0${i}:00Z`, {
					active: Array.from({ length: i }, (_, k) => row({ node_id: k + 1 }))
				})
			);
		}
		const two = store.recent(2);
		expect(two.map((l) => l.node_id)).toEqual([5, 4]);
	});
});
