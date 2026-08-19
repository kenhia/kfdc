import { describe, expect, it } from 'vitest';
import type { Board, EventRow } from './board';
import { tickerLines } from './ticker';

const event = (over: Partial<EventRow> = {}): EventRow => ({
	at: '2026-08-11T03:00:00Z',
	kind: 'workitem',
	node_id: 1187,
	wi_number: 1187,
	project: 'kfdc',
	title: "Ticker: type board.events end-to-end and render korg's transition log",
	from_status: 'open',
	to_status: 'resolved',
	...over
});

// Only `generated` and `events` are real here: the Ticker reads nothing else
// off the board by construction, and a fuller fixture would imply otherwise.
const board = (over: Partial<Board> = {}): Board =>
	({
		generated: '2026-08-11T04:00:00Z',
		events: [],
		...over
	}) as Board;

describe('tickerLines', () => {
	it("quotes korg's own transition verbatim rather than translating it to FDC", () => {
		const [l] = tickerLines(board({ events: [event()] }));
		// kfdc #1186: the Net Log speaks FDC (firing / splash / on deck); the
		// Ticker speaks korg, because its whole identity is korg-authoritative
		// record. Paraphrasing here would be the panel restating a claim it is
		// supposed to be quoting.
		expect(l.transition).toBe('open→resolved');
		expect(l.text).toBe('Ticker: type board.events end-to-en…');
	});

	it("ages against the board's generated, and keeps korg's exact instant beside it", () => {
		const [l] = tickerLines(board({ events: [event({ at: '2026-08-11T01:30:00Z' })] }));
		// formatAge's own rule, shared with every other panel — coarse past an
		// hour on purpose. The Ticker does not get a finer clock than the board;
		// it carries `at` for the exact instant instead.
		expect(l.age).toBe('2h');
		// The exact recorded instant survives the derivation: it is the one thing
		// the Net Log's observation time structurally cannot offer.
		expect(l.at).toBe('2026-08-11T01:30:00Z');
	});

	it('refs a work item by wi_number and a proposal by node_id', () => {
		const lines = tickerLines(
			board({
				events: [
					event({ kind: 'workitem', node_id: 1187, wi_number: 1187 }),
					event({ kind: 'sprint_proposal', node_id: 1190, wi_number: null })
				]
			})
		);
		expect(lines.map((l) => l.ref)).toEqual([1187, 1190]);
	});

	// korg orders the window newest-first and caps it at 20. The board renders
	// korg: no re-sort, no re-cap, no filtering by project. Wanting any of those
	// is a korg work item, not a derivation here.
	it("preserves korg's order and window exactly", () => {
		const events = [
			event({ at: '2026-08-11T03:00:00Z', node_id: 3 }),
			event({ at: '2026-08-11T01:00:00Z', node_id: 1 }),
			event({ at: '2026-08-11T02:00:00Z', node_id: 2 })
		];
		expect(tickerLines(board({ events })).map((l) => l.node_id)).toEqual([3, 1, 2]);
	});

	// THE honesty rule (#1187, roadmap Phase 3). korg's event log starts at
	// migration 0026 and was NOT backfilled, so an empty window means "nothing
	// has moved since the migration" — never "nothing ever moved". The
	// derivation yields nothing, and Ticker.svelte renders no footer at all,
	// because any empty state reads as a claim about history the board cannot
	// support.
	it('yields nothing on an empty window rather than an empty state', () => {
		expect(tickerLines(board({ events: [] }))).toEqual([]);
	});

	// A korg predating #977 carries no `events` key at all. That is strictly
	// less information than an empty window, so it can only render less:
	// nothing. The board must not fall over because a footer lost its feed.
	it('treats an absent events key the same as an empty one', () => {
		expect(tickerLines(board({ events: undefined as unknown as EventRow[] }))).toEqual([]);
	});

	// The third kind, pinned permanently (#1197). The event below is quoted
	// verbatim from korg's own record as #1197 filed it — the 2026-08-12T04:24Z
	// window, the first `program` transition the feed ever carried. Only the
	// event is verbatim: `generated` is chosen here, because the window's board
	// stamp was never captured and inventing one as measured would be a lie.
	//
	// This test exists so the corpus cannot lose the third kind again. The
	// omission got in because the sample it was typed against had only two, and
	// a sample can go back to having only two at any time; a pinned row cannot.
	it('carries a program transition, which has no project at all', () => {
		const b = board({
			generated: '2026-08-12T04:27:03.649972Z',
			events: [
				{
					at: '2026-08-12T04:24:03.649972Z',
					kind: 'program',
					node_id: 1192,
					project: null,
					title: 'kfdc Phase 3 — switch over, and manage kfdc in kfdc',
					from_status: 'active',
					to_status: 'holding',
					wi_number: null
				}
			]
		});
		expect(tickerLines(b)).toEqual([
			{
				age: '3m',
				at: '2026-08-12T04:24:03.649972Z',
				// Carried through as null rather than coerced to '' — the panel needs
				// to be able to tell "no project" from "a project named nothing".
				project: null,
				kind: 'program',
				node_id: 1192,
				wi_number: null,
				// A program is refd by node_id: korg numbers only work items.
				ref: 1192,
				transition: 'active→holding',
				to_status: 'holding',
				text: 'kfdc Phase 3 — switch over, and man…'
			}
		]);
	});

	// Verbatim from the production board read of 2026-08-11T03:25:23Z — the
	// first real `events` body this derivation ever met, pinned the way #997
	// pinned the first real curator body. Its head is this very sprint's own
	// proposal going active.
	it('derives the first real events body byte-for-byte', () => {
		const b = board({
			generated: '2026-08-11T03:25:23.068463Z',
			events: [
				{
					at: '2026-08-11T03:21:30.025966Z',
					kind: 'sprint_proposal',
					node_id: 1190,
					wi_number: null,
					project: 'kfdc',
					title:
						"Ticker: render korg's transition log, decide what the Net Log keeps, and put the Brave Rifles on the board",
					from_status: 'proposed',
					to_status: 'active'
				},
				{
					at: '2026-08-11T02:03:41.192186Z',
					kind: 'sprint_proposal',
					node_id: 1182,
					wi_number: null,
					project: 'agent-skills',
					title:
						'sprint-ship correctness pass: CI-safe squash body, program awareness, per-repo defaults',
					from_status: 'active',
					to_status: 'done'
				},
				{
					at: '2026-08-11T02:03:39.102567Z',
					kind: 'workitem',
					node_id: 1164,
					wi_number: 1164,
					project: 'agent-skills',
					title: 'sprint-ship default options for repo',
					from_status: 'open',
					to_status: 'resolved'
				}
			]
		});
		expect(tickerLines(b)).toEqual([
			{
				age: '3m',
				at: '2026-08-11T03:21:30.025966Z',
				project: 'kfdc',
				kind: 'sprint_proposal',
				node_id: 1190,
				wi_number: null,
				ref: 1190,
				transition: 'proposed→active',
				to_status: 'active',
				text: "Ticker: render korg's transition lo…"
			},
			{
				age: '1h',
				at: '2026-08-11T02:03:41.192186Z',
				project: 'agent-skills',
				kind: 'sprint_proposal',
				node_id: 1182,
				wi_number: null,
				ref: 1182,
				transition: 'active→done',
				to_status: 'done',
				text: 'sprint-ship correctness pass: CI-sa…'
			},
			{
				age: '1h',
				at: '2026-08-11T02:03:39.102567Z',
				project: 'agent-skills',
				kind: 'workitem',
				node_id: 1164,
				wi_number: 1164,
				ref: 1164,
				transition: 'open→resolved',
				to_status: 'resolved',
				text: 'sprint-ship default options for repo'
			}
		]);
	});
});
