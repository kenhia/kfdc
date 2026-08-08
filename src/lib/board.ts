// Types and pure derivations for korg's board rollup (GET /api/board).
// Contract: korg docs/api.md §get_board. The board renders korg
// deterministically — everything here is arithmetic over one response.

export interface ProposalRow {
	node_id: number;
	title: string;
	summary: string;
	project: string;
	status: 'active' | 'proposed';
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
// Mirrors korg's terminal set for the kind — `closed` is a work-item status
// and has no proposal spelling.
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
