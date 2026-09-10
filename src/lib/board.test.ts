import { describe, expect, it } from 'vitest';
import {
	delayedOps,
	fireMissionOrder,
	formatAge,
	onDeckRows,
	progress,
	soakClock,
	splashing,
	statline,
	withoutParked,
	withoutReviewed,
	withoutSoaking,
	type Board,
	type BlockedRow,
	type ProgramRow,
	type ProgramSlice,
	type ProgramSoak,
	type ProposalRow,
	type ReportRow
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
	events: [],
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

// #1540. The setting is one filter in one place, so these tests are where every
// "which panels?" answer is written down — a panel-by-panel filter would have
// had this evidence scattered across six test files, which is how one of them
// gets forgotten.
describe('withoutParked', () => {
	const parked = (node_id: number) => row({ node_id, status: 'parked' });
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
		soaks: [],
		...over
	});

	it('takes parked proposals out of the queue, keeping korg`s order', () => {
		const b = board({
			queue: [
				row({ node_id: 3, status: 'proposed' }),
				parked(4),
				row({ node_id: 5, status: 'proposed' })
			]
		});
		expect(withoutParked(b).board.queue.map((r) => r.node_id)).toEqual([3, 5]);
	});

	it('takes parked programs out of Operations', () => {
		const b = board({ programs: [program(), program({ node_id: 901, status: 'parked' })] });
		expect(withoutParked(b).board.programs.map((p) => p.node_id)).toEqual([900]);
	});

	// The filter runs on every render of a board the feed replaces in place
	// (#1496), so mutating korg's payload would compound rather than show up once.
	it('leaves the input board untouched', () => {
		const b = board({ queue: [parked(4)], programs: [program({ status: 'parked' })] });
		const out = withoutParked(b);
		expect(out.board.queue).toHaveLength(0);
		expect(b.queue).toHaveLength(1);
		expect(b.programs).toHaveLength(1);
	});

	// korg guarantees a parked proposal rides `queue` whichever half it was
	// parked out of (#1534), precisely so Fire Missions never shows a row that
	// cannot move. kfdc does NOT filter `active` as a belt-and-braces measure:
	// if that guarantee ever broke, the row should be visible rather than
	// silently absorbed here.
	it('does not filter Fire Missions, so a breach of korg`s guarantee would show', () => {
		const b = board({ active: [row({ node_id: 1 }), parked(2)] });
		expect(withoutParked(b).board.active.map((r) => r.node_id)).toEqual([1, 2]);
	});

	// GP-19: parked is UNFINISHED. A program's slices are its declared plan and
	// they carry remaining/total, so dropping a parked step would shorten the
	// plan on screen and report progress that came from putting work on hold.
	it('does not filter a program`s slices, which are its plan and its counters', () => {
		const p = program({ slices: [slice(10, 'parked'), slice(11), slice(12)] });
		const out = withoutParked(board({ programs: [p] })).board;
		expect(out.programs[0].slices.map((s) => s.node_id)).toEqual([10, 11, 12]);
	});

	// The one that looks like a bug and is not. korg is emphatic that parking a
	// program does NOT touch its slices — a parked program may legitimately hold
	// live ones. So a live queue row whose program is parked is still a live
	// queue row, and hiding it would be kfdc deciding the slice is dormant
	// because something else is: exactly the derivation GP-19 forbids. It loses
	// its grouping and keeps its place.
	it('keeps the live slices of a parked program, ungrouped rather than gone', () => {
		const b = board({
			queue: [row({ node_id: 10, status: 'proposed' }), row({ node_id: 12, status: 'proposed' })],
			programs: [program({ status: 'parked' })]
		});
		const out = withoutParked(b).board;
		expect(out.programs).toEqual([]);
		expect(
			onDeckRows(out.queue, out.programs).map((r) => r.kind === 'proposal' && r.row.node_id)
		).toEqual([10, 12]);
	});

	// THE LEAK THE SEQUENCING NOTE NAMED. A program collapses into one On Deck
	// row once it contributes ROLLUP_MIN queue rows. Filter the queue and one of
	// those rows away, and a collapse computed over the UNFILTERED queue would
	// draw a program roll-up standing in for a single visible row — a roll-up
	// representing rows that are not on the board. Filtering once, upstream of
	// the derivation, is what makes this fall out rather than need handling.
	it('un-collapses a program roll-up left with one visible queue row', () => {
		const b = board({
			queue: [row({ node_id: 10, status: 'proposed' }), parked(12)],
			programs: [program()]
		});
		const before = onDeckRows(b.queue, b.programs);
		expect(before.map((r) => r.kind)).toEqual(['program']);

		const out = withoutParked(b).board;
		const after = onDeckRows(out.queue, out.programs);
		expect(after.map((r) => r.kind)).toEqual(['proposal']);
		expect(after[0].kind === 'proposal' && after[0].row.node_id).toBe(10);
	});

	it('drops a program`s On Deck row entirely when every queue row it had is parked', () => {
		const b = board({ queue: [parked(10), parked(12)], programs: [program()] });
		const out = withoutParked(b).board;
		expect(onDeckRows(out.queue, out.programs)).toEqual([]);
	});

	// Deconfliction, Commander's Call, per-project depth and the Ticker all keep
	// their whole corpus, each for a reason recorded on `withoutParked`. Asserted
	// together because the failure they share is one line of over-filtering.
	it('leaves blocked, awaiting, depth and events alone', () => {
		const b = board({ queue: [parked(4)] });
		const out = withoutParked(b).board;
		expect(out.blocked).toBe(b.blocked);
		expect(out.awaiting).toBe(b.awaiting);
		expect(out.depth).toBe(b.depth);
		expect(out.events).toBe(b.events);
		expect(out.proposals_omitted).toBe(b.proposals_omitted);
	});

	// docs/design.md's first rule — *nothing disappears silently; a panel that
	// hides rows names what it hid*. This filter is the largest piece of hiding
	// kfdc does, so it is the last place that rule may be skipped. The count is
	// kfdc's own, not korg's: korg's `*_omitted` says what KORG withheld, and
	// this says what the board chose not to draw, which only the board knows.
	it('reports what it hid, because nothing on this board disappears silently', () => {
		const b = board({
			queue: [row({ node_id: 3, status: 'proposed' }), parked(4), parked(5)],
			programs: [program(), program({ node_id: 901, status: 'parked' })]
		});
		expect(withoutParked(b).hidden).toEqual({ queue: 2, programs: 1 });
	});

	it('reports nothing hidden when korg has parked nothing', () => {
		expect(withoutParked(board()).hidden).toEqual({ queue: 0, programs: 0 });
	});

	// D-3: every statline figure derives from the lists it is printed beside, so
	// a `live` count that included rows On Deck is not drawing would have the
	// masthead contradicting the panel under it.
	it('brings the statline down with the queue it is printed beside', () => {
		const b = board({
			queue: [row({ node_id: 3, status: 'proposed' }), parked(4), parked(5)]
		});
		expect(statline(b).live).toBe(5);
		expect(statline(withoutParked(b).board).live).toBe(3);
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
		soaks: [],
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

	// The parked specimen, pinned permanently (#1536, GP-14's rule that the
	// rare value goes into the corpus so it cannot be lost the way a sample
	// was). It is the counterpart of the declined test above, and it is the
	// one korg's vocabulary makes easy to get backwards: `declined` and
	// `parked` both mean nobody is working on this, and only one of them means
	// the work is over. GP-19: parked is UNFINISHED — deferred, not dropped.
	//
	// Getting this wrong is not a cosmetic slip. Slice 10 parked would make
	// this program read 2-of-3 remaining while the plan still has three slices
	// to run, so the roll-up would report progress that came entirely from
	// putting work on hold.
	it('treats a parked slice as unfinished, unlike a declined one', () => {
		const p = program({ slices: [slice(10, 'parked'), slice(11), slice(12)] });
		const [roll] = onDeckRows([queued(11), queued(12)], [p]);
		expect(roll.kind === 'program' && roll.remaining).toBe(3);
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

// ---------------------------------------------------------------------------
// Delayed Ops (#2155) — korg's soaking programs, routed out of Operations.
// ---------------------------------------------------------------------------
describe('soaking', () => {
	const slice = (node_id: number, status = 'done'): ProgramSlice => ({
		node_id,
		title: `slice ${node_id}`,
		project: 'korg',
		status,
		rank: String(node_id),
		open: 0,
		resolved: 0,
		done: 1,
		closed: 0,
		covered_count: 1
	});

	const soak = (over: Partial<ProgramSoak> = {}): ProgramSoak => ({
		node_id: 2062,
		wi_number: 2062,
		title: 'wave 1: three consecutive nightlies across five hosts',
		project: 'kmon',
		wi_status: 'open',
		check_after: '2026-09-13',
		invalidated_if: "kai's baseline is regenerated outside the timer",
		rank: '0',
		...over
	});

	const prog = (over: Partial<ProgramRow> = {}): ProgramRow => ({
		node_id: 2070,
		title: 'kmon fleet collection',
		aim: 'a',
		status: 'soaking',
		span: ['kmon'],
		slice_count: 1,
		slices: [slice(2071)],
		soaks: [soak()],
		...over
	});

	const blockedBy = (blocker: number, proposal: number): BlockedRow => ({
		proposal,
		via: 'covered',
		dependent: proposal,
		dependent_wi_number: null,
		blocker,
		blocker_kind: 'workitem',
		blocker_wi_number: blocker,
		blocker_title: 'the blocker',
		blocker_project: 'kmon',
		blocker_status: 'open',
		sequenced_by: null
	});

	// The partition is the contract: `withoutSoaking` routes them OUT of the
	// general collection and `delayedOps` routes them IN to their own panel, and
	// the two read the same literal. Asserting the split is total is what stops
	// them ever disagreeing — a program dropped by one and not picked up by the
	// other would vanish from the board entirely.
	it('puts every program in exactly one of the two panels', () => {
		const programs = [
			prog({ node_id: 1, status: 'queued', soaks: [] }),
			prog({ node_id: 2, status: 'active', soaks: [] }),
			prog({ node_id: 3, status: 'holding', soaks: [] }),
			prog({ node_id: 4, status: 'soaking' }),
			prog({ node_id: 5, status: 'done', soaks: [] }),
			prog({ node_id: 6, status: 'parked', soaks: [] }),
			prog({ node_id: 7, status: 'soaking' })
		];
		const b = board({ programs });
		const ops = withoutSoaking(b).programs.map((p) => p.node_id);
		const delayed = delayedOps(b).map((r) => r.program.node_id);

		expect(delayed).toEqual([4, 7]);
		expect(ops).toEqual([1, 2, 3, 5, 6]);
		expect([...ops, ...delayed].sort((a, x) => a - x)).toEqual([1, 2, 3, 4, 5, 6, 7]);
	});

	it('leaves everything but `programs` untouched', () => {
		const b = board({ programs: [prog()], blocked: [blockedBy(2062, 3)] });
		const out = withoutSoaking(b);
		expect(out.programs).toEqual([]);
		expect(out.queue).toBe(b.queue);
		expect(out.blocked).toBe(b.blocked);
		expect(out.reports).toBe(b.reports);
	});

	// "What does this block?" — the sharpest thing in Ken's framing (korg #2149).
	// A dependency may name the program, one of its slices, or one of its soak
	// work items, and all three are the program holding the row up.
	it.each([
		['the program itself', 2070],
		['one of its slices', 2071],
		['one of its soak work items', 2062]
	])('counts a blocker that is %s', (_label, blocker) => {
		const b = board({
			queue: [row({ node_id: 3, status: 'proposed', title: 'downstream work' })],
			programs: [prog()],
			blocked: [blockedBy(blocker, 3)]
		});
		expect(delayedOps(b)[0].blocks).toEqual([
			{ node_id: 3, title: 'downstream work', project: 'p', blocker }
		]);
	});

	it('ignores a blocker belonging to some other program', () => {
		const b = board({
			queue: [row({ node_id: 3, status: 'proposed' })],
			programs: [prog()],
			blocked: [blockedBy(9999, 3)]
		});
		expect(delayedOps(b)[0].blocks).toEqual([]);
	});

	// The panel renders "blocks nothing" in words, so the empty array has to be
	// reachable and honest rather than a rendering accident.
	it('reports an empty block list when nothing depends on it', () => {
		const b = board({ programs: [prog()], blocked: [] });
		expect(delayedOps(b)[0].blocks).toEqual([]);
	});

	// korg emits one entry per (row, blocker) pair. The reader asked what is held
	// up, not how many edges say so.
	it('names a row held up by two of its soaks once', () => {
		const b = board({
			queue: [row({ node_id: 3, status: 'proposed' })],
			programs: [prog({ soaks: [soak(), soak({ node_id: 2064, wi_number: 2064 })] })],
			blocked: [blockedBy(2062, 3), blockedBy(2064, 3)]
		});
		expect(delayedOps(b)[0].blocks.map((x) => x.node_id)).toEqual([3]);
	});

	// The reason delayedOps takes the UNFILTERED board. A parked dependent is
	// still blocked (GP-19: parked is unfinished), so a reader who has hidden
	// parked rows must not be told this program "blocks nothing" — a false
	// all-clear is the one failure this question exists to prevent.
	it('still names a parked dependent, which is what the unfiltered board buys', () => {
		const b = board({
			queue: [row({ node_id: 3, status: 'parked', title: 'deferred but blocked' })],
			programs: [prog()],
			blocked: [blockedBy(2062, 3)]
		});
		expect(delayedOps(b)[0].blocks).toEqual([
			{ node_id: 3, title: 'deferred but blocked', project: 'p', blocker: 2062 }
		]);
		// And the parked filter, which Operations does apply, leaves `blocked`
		// alone — so the two agree.
		expect(withoutParked(b).board.blocked).toBe(b.blocked);
	});

	// An unresolvable title is a korg contract breach worth SEEING. Dropping the
	// row would shorten the one list the panel exists to count.
	it('falls back to the id rather than dropping a row it cannot name', () => {
		const b = board({ queue: [], active: [], programs: [prog()], blocked: [blockedBy(2062, 77)] });
		expect(delayedOps(b)[0].blocks).toEqual([
			{ node_id: 77, title: 'korg:77', project: null, blocker: 2062 }
		]);
	});
});

describe('soakClock', () => {
	const GEN = '2026-09-10T12:00:00Z';

	it.each([
		['2026-09-13', 3, 'waiting', '3d'],
		['2026-09-11', 1, 'waiting', '1d'],
		['2026-09-10', 0, 'due', 'due today'],
		['2026-09-09', -1, 'overdue', '1d overdue'],
		['2026-09-03', -7, 'overdue', '7d overdue']
	])('reads %s as %id (%s)', (checkAfter, days, state, label) => {
		expect(soakClock(GEN, checkAfter as string)).toEqual({ days, state, label });
	});

	// Counted against the board's `generated`, never Date.now() — the same rule
	// formatAge follows, and what keeps the wall and the desk agreeing.
	it('counts from the board`s clock, not the wall clock', () => {
		expect(soakClock('2026-09-01T00:00:00Z', '2026-09-13')!.days).toBe(12);
		expect(soakClock('2026-09-20T00:00:00Z', '2026-09-13')!.days).toBe(-7);
	});

	// A state korg genuinely permits: the `soaks` edge demands both fields to be
	// CREATED and never re-checks them, so an operator may clear check_after on a
	// soak already in the array.
	it('returns null when the soak carries no check date', () => {
		expect(soakClock(GEN, null)).toBeNull();
	});

	it('returns null rather than NaN on an unparseable date', () => {
		expect(soakClock(GEN, 'someday')).toBeNull();
	});

	// The time of day must not move the day count — otherwise the same soak reads
	// differently at 09:00 and at 23:00.
	it('ignores the time of day on the board`s timestamp', () => {
		const early = soakClock('2026-09-10T00:00:01Z', '2026-09-13')!;
		const late = soakClock('2026-09-10T23:59:59Z', '2026-09-13')!;
		expect(early).toEqual(late);
	});
});

// ---------------------------------------------------------------------------
// Sensor Net's reviewed filter (#2156).
// ---------------------------------------------------------------------------
describe('withoutReviewed', () => {
	const report = (node_id: number, reviewed: boolean): ReportRow => ({
		node_id,
		source: 'kfo-soak',
		model: 'ken',
		status: 'attention',
		escalated: false,
		summary: 's',
		report_date: '2026-09-10',
		comment_count: 0,
		reviewed,
		updated: '2026-09-10T00:00:00Z'
	});

	it('drops reviewed rows and counts what it dropped', () => {
		const b = board({ reports: [report(1, false), report(2, true), report(3, true)] });
		const out = withoutReviewed(b);
		expect(out.board.reports.map((r) => r.node_id)).toEqual([1]);
		expect(out.hidden).toBe(2);
	});

	it('hides nothing, and says so, when korg has reviewed nothing', () => {
		const b = board({ reports: [report(1, false)] });
		const out = withoutReviewed(b);
		expect(out.board.reports).toEqual(b.reports);
		expect(out.hidden).toBe(0);
	});

	// A display toggle must not rewrite a measurement. Reports are the only
	// collection this touches.
	it('touches nothing but `reports`', () => {
		const b = board({ reports: [report(1, true)] });
		const out = withoutReviewed(b).board;
		expect(out.queue).toBe(b.queue);
		expect(out.programs).toBe(b.programs);
		expect(out.events).toBe(b.events);
	});
});
