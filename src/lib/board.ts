// Types and pure derivations for korg's board rollup (GET /api/board).
// Contract: korg docs/api.md §get_board. The board renders korg
// deterministically — everything here is arithmetic over one response.

export interface ProposalRow {
	node_id: number;
	title: string;
	summary: string;
	project: string;
	// korg's PROPOSAL_LIVE_STATUSES (korg-core vocab.rs) — the whole domain a
	// board row can carry, because the terminal pair rides `proposals_omitted`
	// rather than a list. This declared two literals until #1536, and that was
	// a GP-14 sampled enum rather than a domain: korg grew `parked` in sprint
	// 072 and the narrower type would have endorsed an exhaustive `switch`
	// that could not see it. Taken from korg's set, not from a window.
	status: 'proposed' | 'active' | 'parked';
	rank: string;
	pinned: boolean;
	comment_count: number;
	covered_count: number;
	open: number;
	resolved: number;
	done: number;
	closed: number;
	updated: string;
	// The newest ⟦curator⟧-marked comment (korg #1003), or null until the
	// curator's first pass over this row. Format contract: curator/prompt.md;
	// parsed by $lib/curator.
	synopsis: { body: string; updated: string } | null;
}

// An edge between two live board rows (korg #1003) — Deconfliction's
// substrate. `origin`/`created` are korg's write-side edge provenance;
// origin "kfdc-curator" marks a mined edge.
export interface ProposalEdge {
	left: number;
	right: number;
	label: string;
	directed: boolean;
	origin: string | null;
	created: string;
}

export interface AwaitingRow {
	node_id: number;
	kind: string;
	wi_number: number | null;
	title: string;
	project: string | null;
	status: string;
	archived: boolean;
	awaiting_note: string | null;
	awaiting_since: string;
}

export interface DepthRow {
	project: string;
	status: string;
	proposals: number;
	wi_in_proposal: number;
	wi_total: number;
}

export interface ReportRow {
	node_id: number;
	source: string;
	model: string | null;
	status: string;
	escalated: boolean;
	summary: string;
	report_date: string;
	comment_count: number;
	updated: string;
}

// One proposal covered by a program, in rank order, carrying the same four
// status counts as a ProposalRow so #980's three-part progress derives the
// same way (korg sprint 045's D-5 — no extra read needed).
export interface ProgramSlice {
	node_id: number;
	title: string;
	project: string;
	status: string;
	rank: string;
	open: number;
	resolved: number;
	done: number;
	closed: number;
	covered_count: number;
}

// korg's program lifecycle, in the order it reads (korg-core vocab.rs
// PROGRAM_STATUSES, `queued` added by #1424). kfdc switches on the literal
// korg emits and never reconstructs one from the slices: `queued` means no
// slice has *started*, where started is active-or-done and explicitly not
// declined, and korg maintains it across three write paths no read-time
// derivation can see (GP-13's state half). This list is not a second
// definition of that fact — it is the record of which literals the board has
// chosen a treatment for, and palette.test.ts holds it to that.
//
// `parked` joined in korg sprint 072 (#1535): deferred until a condition
// fires, with no end date. GP-19 is the contract it arrives under — korg owns
// the distinction, emits the literal and sorts parked last in the collection
// it belongs to; kfdc chooses only whether to DRAW it. Inferring dormancy from
// a stale `updated`, an empty slice list or prose in a comment is the one
// thing the decision forbids outright.
export const PROGRAM_STATUSES = ['queued', 'active', 'holding', 'done', 'parked'] as const;

export interface ProgramRow {
	node_id: number;
	title: string;
	// The one-line intent; korg's field is `aim`, not `summary`.
	aim: string;
	status: string;
	// Projects the program spans — derived by korg from the slices.
	span: string[];
	slice_count: number;
	slices: ProgramSlice[];
}

// One unmet `depends_on` holding up a live row (korg #978). Deterministic —
// unfinished is derived per-kind from korg's vocabulary, one hop, archived
// blockers excluded.
export interface BlockedRow {
	// The active/queue row that cannot proceed.
	proposal: number;
	// `proposal` when the row itself carries the edge, `covered` when one of
	// its covered work items does.
	via: 'proposal' | 'covered';
	// The node carrying the edge — the row itself, or a covered work item.
	dependent: number;
	dependent_wi_number: number | null;
	blocker: number;
	blocker_kind: string;
	blocker_wi_number: number | null;
	blocker_title: string;
	blocker_project: string | null;
	blocker_status: string;
	// The live program whose ordered slices already express this dependency,
	// or null. kfdc #1070's answer: Operations already draws that as sequence,
	// so Deconfliction does not draw it a second time.
	sequenced_by: number | null;
}

// One recorded status transition from korg's own event log (korg #977) —
// newest 20, newest first. Deterministic and authoritative: a real timestamp
// and a real from/to, never `node.updated` standing in for a transition, which
// is the specific dishonesty #977 existed to end. The log begins at korg
// migration 0026 and was NOT backfilled, so an empty array means "nothing has
// moved since the migration", never "nothing ever moved" — see $lib/ticker.
export interface EventRow {
	at: string;
	// All THREE kinds korg emits (#1197). It declared two until sprint 014,
	// because the 20-event window this was typed against (2026-08-11) happened
	// to contain no program transition — a sampled enum is not an enum. The
	// omission never broke a render, which is the point: TS types do not
	// execute, so the cost was a compiler that would have endorsed an
	// exhaustive `switch` missing a live case.
	kind: 'sprint_proposal' | 'workitem' | 'program';
	node_id: number;
	// null for proposals; the number for work items.
	wi_number: number | null;
	// null for a program, by construction and not by accident: a program has no
	// project, its span is derived from the proposals it includes. Nothing to
	// file against korg — the consumer was wrong, not the emitter.
	project: string | null;
	title: string;
	from_status: string;
	to_status: string;
}

export interface Board {
	generated: string;
	active: ProposalRow[];
	queue: ProposalRow[];
	proposals_omitted: { done: number; declined: number; archived: number };
	proposal_edges: ProposalEdge[];
	blocked: BlockedRow[];
	programs: ProgramRow[];
	programs_omitted: { done: number; archived: number };
	awaiting: AwaitingRow[];
	depth: DepthRow[];
	reports: ReportRow[];
	events: EventRow[];
}

// Statline per korg's D-3 table: every figure derives from the lists it is
// printed beside, so it cannot disagree with them.
export function statline(b: Board) {
	return {
		live: b.active.length + b.queue.length,
		active: b.active.length,
		shipped: b.proposals_omitted.done,
		awaiting: b.awaiting.length,
		projects: b.depth.filter((d) => d.status === 'active').length
	};
}

// Three-part progress, semantics pinned on korg #980:
// work-complete (resolved+done+closed) / Ken-verified (closed) / total.
// Takes anything carrying the four counts — a proposal row or a program slice.
export function progress(r: {
	resolved: number;
	done: number;
	closed: number;
	covered_count: number;
}) {
	return {
		complete: r.resolved + r.done + r.closed,
		verified: r.closed,
		total: r.covered_count
	};
}

// SPLASH (kfdc #990, 11C semantics): rounds complete, watch for impact — an
// active mission whose rollup reached work-complete == total. Sprint-ship is
// imminent and Ken's verification is the next event.
export function splashing(r: ProposalRow): boolean {
	const p = progress(r);
	return p.total > 0 && p.complete >= p.total;
}

// Splashing missions sort to the top of Fire Missions; otherwise korg's order
// stands (Array.sort is stable).
export function fireMissionOrder(active: ProposalRow[]): ProposalRow[] {
	return [...active].sort((a, b) => Number(splashing(b)) - Number(splashing(a)));
}

// A proposal is finished when korg would stop counting it as remaining work.
// Mirrors korg's PROPOSAL_TERMINAL_STATUSES — `closed` is a work-item status
// and has no proposal spelling.
//
// `parked` is deliberately NOT in this set, which is GP-19's third property
// written in code: a parked slice is UNFINISHED — deferred, not dropped — so
// it still counts toward a program's `remaining`. Admitting it would have the
// On Deck roll-up report a program as nearly complete precisely because the
// rest of its work was put on hold, which is the opposite of what parking says.
const PROPOSAL_FINISHED = new Set(['done', 'declined']);

// A program collapses into one On Deck row once it contributes this many
// queue rows (kfdc #1064). Below it there is no row inflation to fix, and the
// slice's own title says more than the program's does.
const ROLLUP_MIN = 2;

// On Deck renders a queue row per proposal, except where a program already
// declares the order: those slices collapse into one row naming the program
// (kfdc #1064 — "up to 9 rows w/o really adding more information for me").
export type OnDeckRow =
	| { kind: 'proposal'; row: ProposalRow }
	| {
			kind: 'program';
			program: ProgramRow;
			// Borrowed from the first collapsed slice: the roll-up sits exactly
			// where korg put that slice, so no rank string is parsed or invented
			// and the panel cannot disagree with korg's order.
			rank: string;
			pinned: boolean;
			// The collapsed queue rows, in korg's order — what expanding reveals.
			slices: ProposalRow[];
			// Slices still to close, over the program's whole length: the counter
			// #1064 asked for. Counts active slices too, which are showing in Fire
			// Missions rather than here.
			remaining: number;
			total: number;
	  };

export function onDeckRows(queue: ProposalRow[], programs: ProgramRow[]): OnDeckRow[] {
	// A proposal belongs to at most one program (korg's `includes` edge).
	const owner = new Map<number, ProgramRow>();
	for (const p of programs) for (const s of p.slices) owner.set(s.node_id, p);

	const contributed = new Map<number, ProposalRow[]>();
	for (const r of queue) {
		const p = owner.get(r.node_id);
		if (p) contributed.set(p.node_id, [...(contributed.get(p.node_id) ?? []), r]);
	}

	const rows: OnDeckRow[] = [];
	const placed = new Set<number>();
	for (const r of queue) {
		const p = owner.get(r.node_id);
		const slices = p ? (contributed.get(p.node_id) ?? []) : [];
		if (!p || slices.length < ROLLUP_MIN) {
			rows.push({ kind: 'proposal', row: r });
			continue;
		}
		if (placed.has(p.node_id)) continue;
		placed.add(p.node_id);
		rows.push({
			kind: 'program',
			program: p,
			rank: r.rank,
			pinned: slices.some((s) => s.pinned),
			slices,
			remaining: p.slices.filter((s) => !PROPOSAL_FINISHED.has(s.status)).length,
			total: p.slice_count
		});
	}
	return rows;
}

/** korg's literal for deferred-with-no-end-date (GP-19), on every node kind. */
export const PARKED = 'parked';

/**
 * The board with korg's parked rows taken out of it (#1540) — the desk's
 * "Include parked" setting off, and the wall's fixed answer always.
 *
 * ONE FILTER, ONE PLACE. Parked rows reach the board through several doors —
 * On Deck and its program-collapse path, Operations, the statline, per-project
 * depth — and a filter written at each door leaks at the one nobody listed.
 * So the collection is filtered once, here, and every panel downstream renders
 * what it is given without knowing this setting exists.
 *
 * WHAT IS FILTERED, and it is only two things:
 *   - `queue` — where korg puts every parked proposal, whichever half it was
 *     parked out of (#1534). This is the door the feature was asked for.
 *   - `programs` — parked programs, riding last in the same collection (#1535).
 *
 * WHAT IS NOT, each for a reason rather than by omission:
 *   - `active` — korg guarantees no parked row lands here, precisely so Fire
 *     Missions can never show a row that cannot move. Filtering it too would
 *     cost nothing today and would silently absorb the breach if that ever
 *     stopped being true; leaving it alone means a parked mission would be
 *     VISIBLE, which is what you want from a contract violation.
 *   - `programs[].slices` — a program's slices are its declared plan, and they
 *     carry `remaining`/`total`. Dropping a parked step would shorten the plan
 *     on screen and make a program read as nearer done because part of it was
 *     put on hold. GP-19: parked is unfinished.
 *   - `blocked` — a parked blocker is still an unmet blocker (GP-19, and korg
 *     confirmed it on its own side in #1534). Hiding it would have
 *     Deconfliction report work as ready to start when it is not, which is the
 *     one thing that panel exists to prevent.
 *   - `awaiting` — korg keeps awaiting markers on parked rows deliberately, and
 *     the reason to render them is sharper than the reason to keep them: a
 *     decision pending on a parked row is very often the decision that would
 *     UNPARK it. Hiding it makes the setting self-sealing.
 *   - `depth`, and every `*_omitted` count — korg computes these, and kfdc
 *     cannot subtract parked rows from a number it did not derive. GP-13 in its
 *     original register: a figure the consumer cannot compute is korg's.
 *   - `events` — the Ticker quotes korg verbatim, and `→ parked` is exactly the
 *     transition worth quoting. A board that hid parking would go silent about
 *     the act of parking.
 *
 * AND IT REPORTS WHAT IT HID, because the board's first rule is that nothing
 * disappears silently (docs/design.md): a panel that hides rows names what it
 * hid and where it went. This filter is the largest piece of hiding kfdc does,
 * so it is the last place that rule may be skipped — the counts ride back with
 * the board and the panels print them beside korg's own omitted line.
 *
 * TWO THINGS THE SETTING CANNOT REACH AT ALL, which is the answer to "a display
 * toggle must not silently rewrite a measurement". Rate of Fire reads korg's
 * work-item flow series, and the Net Log digest is assembled server-side from
 * the raw rollup. Neither is derived from this Board value, so neither moves
 * when the checkbox does — by construction, not by discipline. That also means
 * toggling the setting can never be mistaken by the Net Log for korg activity.
 */
export interface ParkedFiltered {
	board: Board;
	/**
	 * What was taken out, so the panels can say so. kfdc counts these itself
	 * rather than reading them off korg, and that is not a side derivation of
	 * korg's data (GP-1): korg's `*_omitted` counts describe what KORG withheld,
	 * and these describe what this board chose not to draw. The board is the
	 * only thing that knows the second number, because it is the only thing that
	 * made the choice.
	 */
	hidden: { queue: number; programs: number };
}

export function withoutParked(b: Board): ParkedFiltered {
	const queue = b.queue.filter((r) => r.status !== PARKED);
	const programs = b.programs.filter((p) => p.status !== PARKED);
	return {
		board: { ...b, queue, programs },
		hidden: { queue: b.queue.length - queue.length, programs: b.programs.length - programs.length }
	};
}

// Ages are computed against the board's `generated` (Postgres's clock, the
// same clock every timestamp in the response came from) — never Date.now().
export function formatAge(generated: string, since: string): string {
	const ms = Math.max(0, Date.parse(generated) - Date.parse(since));
	const minutes = Math.floor(ms / 60_000);
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	if (hours < 48) return `${hours}h`;
	return `${Math.floor(hours / 24)}d`;
}
