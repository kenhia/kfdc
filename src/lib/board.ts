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

export interface Board {
	generated: string;
	active: ProposalRow[];
	queue: ProposalRow[];
	proposals_omitted: { done: number; declined: number; archived: number };
	proposal_edges: ProposalEdge[];
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
