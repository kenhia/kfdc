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
	// This report has been acted on (korg #2154, sprint 079). korg resets it to
	// false when a same-day re-run replaces the content, so it always marks a
	// review of THIS text and never carries forward to text nobody has read.
	reviewed: boolean;
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

/**
 * One extended test a program is soaking on (korg #2152, sprint 079) — a
 * RESOLVED work-item row rather than a bare edge ref, so a consumer never
 * crawls (GP-1, GP-13).
 *
 * Both soak fields are nullable here even though korg REFUSES to create a
 * `soaks` edge without them. That is not defensive typing: korg's refusal
 * fires on entry and is deliberately never re-checked, so clearing
 * `check_after` on a soak already in the array is a normal operator act and
 * the two fields are independently clearable. GP-14 — the type states korg's
 * value domain, not the domain of the rows that happen to exist today.
 */
export interface ProgramSoak {
	node_id: number;
	wi_number: number;
	title: string;
	// Null for an unassigned work item, as everywhere else korg carries a
	// project on a row that need not have one.
	project: string | null;
	wi_status: string;
	/** `YYYY-MM-DD` — the earliest this test's evidence can be judged. */
	check_after: string | null;
	/**
	 * What state, if it changes, VOIDS the test. A column rather than prose
	 * because of kmon #2058: a soak lives inside a live fleet, and the reader it
	 * is written for is the next agent about to touch that state.
	 */
	invalidated_if: string | null;
	rank: string;
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
//
// `soaking` joined in korg sprint 079 (#2151): all slice work is done and only
// extended tests that span days remain. GP-19's 2026-09-10 amendment is its
// contract — declared like `parked` (korg never sets it), gated by korg on
// ENTRY (every slice terminal, at least one live soak), and lifted by korg on
// EXIT like the derived `queued` when a new slice starts under it. kfdc reads
// the literal and chooses only whether to draw it; deriving "waiting on time"
// from a slice list or a comment is the thing GP-19 forbids outright.
export const PROGRAM_STATUSES = [
	'queued',
	'active',
	'holding',
	'soaking',
	'done',
	'parked'
] as const;

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
	// The program's terminal extended tests, in rank order (korg #2152). Empty
	// on almost every program, and the WHOLE remaining content of a soaking one:
	// by the time korg lets a program enter `soaking`, every slice is terminal,
	// so the soaks are the only part left that anyone can still act on.
	soaks: ProgramSoak[];
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

// The work-item literals STANDING ORDERS paints (#1645), and the same kind of
// list as PROGRAM_STATUSES above: NOT a second definition of korg's vocabulary,
// but the record of which literals this board has chosen a treatment for.
// palette.test.ts holds it to that, and `InFlightSchedule.wi_status` stays
// `string` so nothing here can be mistaken for korg's domain (GP-14).
//
// It is korg's `WI_UNFINISHED_STATUSES` as of korg sprint 076, because that is
// the set korg's own predicate filters this block on — `parked` included, which
// is the one korg wrote a comment to protect (#810). A literal korg adds later
// arrives with no rule and lands on the neutral base, which is #1444's runtime
// half; this list is the compile-time half and cannot see that coming.
export const SCHEDULED_WI_STATUSES = ['open', 'resolved', 'parked'] as const;

/**
 * One IN-FLIGHT SCHEDULE (korg #1644, kfdc #1645): a standing order that has
 * fired, and the unfinished work it produced. Newest firing first, uncapped,
 * and bounded by construction — a schedule leaves the block the moment its
 * item is finished.
 *
 * The block exists because this work was invisible BETWEEN two surfaces. The
 * instant a schedule materializes it stops being *due* — korg's
 * outstanding-item clause, stopping a schedule competing with the item it just
 * produced — and the open item it left behind landed in no board panel at all:
 * in no proposal, not blocked, not awaiting, and `events` carries status
 * CHANGES, so being created was never one. Measured on korg WI #1635 (schedule
 * 1112): the first-ever materialization made its own work invisible.
 */
export interface InFlightSchedule {
	/**
	 * The SCHEDULE's node id — not the work item's. korg carries it explicitly
	 * "so a consumer can link the schedule as well as the item" (its own
	 * `InFlightSchedule` doc), which is why this is the one compact line on the
	 * board that draws two refs.
	 */
	node_id: number;
	/**
	 * The schedule's template title, verbatim and UNSUBSTITUTED — `{DATE}` and
	 * its siblings still in it, exactly as korg's `ScheduleRow.title` carries
	 * them. What the firing actually produced is `wi_title`, already
	 * substituted, which is why there is no `preview_title` here and none is
	 * wanted.
	 */
	title: string;
	/** Null for an unassigned item, as everywhere else korg carries a project. */
	project: string | null;
	wi_number: number;
	wi_title: string;
	/**
	 * korg's literal for the ITEM's state, and `string` on purpose (GP-14).
	 * Every row is one of korg's `WI_UNFINISHED_STATUSES` by construction —
	 * `open`, `resolved`, `parked` today — but that is a SAMPLE of korg's
	 * vocabulary at one deploy, not a domain kfdc may switch exhaustively on.
	 * Standing Orders paints a rule per literal it knows and lands the rest on
	 * the neutral base (#1444).
	 */
	wi_status: string;
	/**
	 * When the schedule fired, read from the work item's own `created` rather
	 * than the `materializes` edge's nullable one (korg 0016 §4) — so it is
	 * always a real timestamp and the panel never renders an optional age.
	 */
	materialized_at: string;
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
	/**
	 * korg's `in_flight_schedules` (#1644). `due_schedules` rides beside it on
	 * the wire and is deliberately NOT declared here: this interface states the
	 * contract the board reads, and kfdc renders no due-schedules surface.
	 */
	in_flight_schedules: InFlightSchedule[];
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

// A program's own count (#3322): its slices' three parts, added up. korg
// inlines every slice on the board rollup, uncapped, so the sum is exact —
// not a figure korg must return for us (GP-13). Parked items sit in
// `covered_count` and in no numerator term, so they count in the total only.
export function programProgress(slices: ProgramSlice[]) {
	const sum = { complete: 0, verified: 0, total: 0 };
	for (const s of slices) {
		const p = progress(s);
		sum.complete += p.complete;
		sum.verified += p.verified;
		sum.total += p.total;
	}
	return sum;
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
 *   - `in_flight_schedules` — and this is the one where filtering would undo
 *     work korg did on purpose. korg's predicate reads `WI_UNFINISHED_STATUSES`
 *     precisely so a parked materialized item stays in the block (#810,
 *     korg #1644): "parked scheduled work is deferred, not finished, and
 *     dropping it would re-hide exactly the item a person deliberately set
 *     aside". A parked row here is also not the thing the setting is about —
 *     Ken's ask (#1540) was a queue he could not see past, and this block is
 *     bounded by construction. Suppressing it would re-create #1644's bug for
 *     the one status korg wrote a comment to protect.
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

/** korg's literal for a program waiting only on extended tests (GP-19, #2151). */
export const SOAKING = 'soaking';

/**
 * The board with korg's soaking programs taken out of `programs` (#2155).
 *
 * ROUTED, NOT HIDDEN — and the distinction is the panel. A parked row is
 * suppressed and its absence has to be confessed in a foot; a soaking program
 * is drawn in full, in Delayed Ops, one panel lower. So this function has no
 * `hidden` count to return: nothing is withheld from the reader, and a count
 * saying otherwise would be the board apologising for a move it did not make.
 * Operations still names how many left and where they went, because a program
 * vanishing from the panel it was in yesterday is a question either way.
 *
 * Why Operations must stop drawing them is the whole slice: Operations means
 * "wants your attention", and a program whose engineering is finished and whose
 * acceptance is a calendar generates demand nobody can satisfy (korg #2149).
 *
 * THE GP-19 COROLLARY DOES NOT BITE HERE, and it is worth saying why rather
 * than being quietly right. Filtering a parked PROGRAM must not take its still
 * live slices with it — a parked program may legitimately hold active ones. A
 * soaking program cannot: korg refuses `soaking` unless every slice is already
 * terminal, and promotes the program back to `active` the moment a slice starts
 * under it. So there is no live slice to orphan — by korg's invariant, not by
 * kfdc's care. If korg ever relaxes that entry rule, this comment is the thing
 * that should stop being true first.
 */
export function withoutSoaking(b: Board): Board {
	return { ...b, programs: b.programs.filter((p) => p.status !== SOAKING) };
}

/** One live row a soaking program is holding up — Delayed Ops' second line. */
export interface SoakBlock {
	/** The blocked proposal. */
	node_id: number;
	title: string;
	project: string | null;
	/** Which node of the program blocks it — the program, a slice, or a soak WI. */
	blocker: number;
}

export interface DelayedOpsRow {
	program: ProgramRow;
	/**
	 * What this program blocks, deduplicated by blocked row. EMPTY IS THE
	 * ANSWER, not the absence of one: "blocks nothing" is the fact that turns an
	 * anxious two-day wait into a shrug, and the panel renders it in words.
	 */
	blocks: SoakBlock[];
}

/**
 * Delayed Ops (#2155): korg's soaking programs, with their soaks and what they
 * block. One derivation over one rollup — no second fetch (GP-1, GP-13).
 *
 * TAKES THE UNFILTERED BOARD, deliberately, and this is the one subtle thing
 * here. "What does this block?" is a fact about korg, not about what the reader
 * has asked to see, and the reader's parked setting must not be able to turn a
 * real blocked row into "blocks nothing" — a false all-clear is exactly the
 * failure the question exists to prevent, and it is the same reasoning that
 * keeps `blocked` out of `withoutParked`'s filter list. The soaking rows
 * themselves are unaffected by the choice: `parked` and `soaking` are one
 * `status` field, so no program can be both and the two filters are disjoint.
 *
 * Titles are resolved from `active` + `queue`, which korg guarantees contain
 * every row `blocked` can name. A row that is somehow missing falls back to its
 * id rather than being dropped: an unresolvable title is a korg contract breach
 * worth SEEING, and silently shortening the list would be the board hiding the
 * one thing it was asked to count.
 */
export function delayedOps(b: Board): DelayedOpsRow[] {
	const live = new Map<number, ProposalRow>();
	for (const r of b.active) live.set(r.node_id, r);
	for (const r of b.queue) live.set(r.node_id, r);

	return b.programs
		.filter((p) => p.status === SOAKING)
		.map((program) => {
			// Every node of the program a dependency could name.
			const mine = new Set<number>([
				program.node_id,
				...program.slices.map((s) => s.node_id),
				...program.soaks.map((s) => s.node_id)
			]);
			const blocks: SoakBlock[] = [];
			const seen = new Set<number>();
			for (const row of b.blocked) {
				// korg emits one entry per (row, blocker) pair, so a proposal held up
				// by two of this program's soaks arrives twice. The reader asked what
				// is held up, not how many edges say so.
				if (!mine.has(row.blocker) || seen.has(row.proposal)) continue;
				seen.add(row.proposal);
				const p = live.get(row.proposal);
				blocks.push({
					node_id: row.proposal,
					title: p?.title ?? `korg:${row.proposal}`,
					project: p?.project ?? null,
					blocker: row.blocker
				});
			}
			return { program, blocks };
		});
}

/** Where a soak's check date sits relative to the board's own clock. */
export interface SoakClock {
	/** Whole days from the board's date to `check_after`; negative once past. */
	days: number;
	state: 'waiting' | 'due' | 'overdue';
	label: string;
}

const DAY_MS = 86_400_000;

/** UTC midnight of an ISO timestamp or a bare `YYYY-MM-DD`. */
function utcDay(iso: string): number {
	const t = Date.parse(iso);
	if (Number.isNaN(t)) return NaN;
	const d = new Date(t);
	return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * How long a soak has left, against the board's `generated` — Postgres's clock,
 * the same rule `formatAge` follows and for the same reason: never Date.now(),
 * so every age on the page shares one reference and the wall cannot drift from
 * the desk.
 *
 * NULL WHEN THERE IS NO DATE, which is a state korg genuinely permits: the
 * `soaks` edge demands both fields to be CREATED and never re-checks them, so
 * an operator may clear `check_after` afterwards. The panel says so in words
 * rather than rendering a countdown from nothing.
 *
 * Counted in whole UTC days on both sides. The alternative — the viewer's local
 * midnight — would have the wall and the desk disagree about the same soak
 * across a timezone, and would make a rendered countdown depend on who is
 * looking at it. The cost is that an evening in PDT reads as the next UTC day:
 * at most one boundary, always toward "ready", and kfdc only draws this clock —
 * the judging is the soak scan's (kfo, or Ken standing in for it).
 */
export function soakClock(generated: string, checkAfter: string | null): SoakClock | null {
	if (!checkAfter) return null;
	const from = utcDay(generated);
	const to = utcDay(checkAfter);
	if (Number.isNaN(from) || Number.isNaN(to)) return null;
	const days = Math.round((to - from) / DAY_MS);
	if (days > 0) return { days, state: 'waiting', label: `${days}d` };
	if (days === 0) return { days, state: 'due', label: 'due today' };
	return { days, state: 'overdue', label: `${-days}d overdue` };
}

/**
 * The board with korg's reviewed reports taken out (#2156) — the desk's
 * "include reviewed" setting off. Sensor Net's rows are the only thing it
 * touches, and the count rides back so the panel can name what it hid, the same
 * receipt `withoutParked` leaves.
 *
 * `reviewed` is korg's fact and korg's alone (GP-18): kfdc never writes it.
 * Marking a report read happens in real korg — in the pane, one click away from
 * the row — which is exactly the delegation that keeps this board edit-free.
 */
export interface ReviewedFiltered {
	board: Board;
	hidden: number;
}

export function withoutReviewed(b: Board): ReviewedFiltered {
	const reports = b.reports.filter((r) => !r.reviewed);
	return { board: { ...b, reports }, hidden: b.reports.length - reports.length };
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
