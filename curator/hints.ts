// Deterministic collision hints — the half of Deconfliction that does not
// depend on prose saying so (kfdc #1205).
//
// The curator mines `collides-with` edges by *reading*: an LLM over proposal
// prose, which can only find collisions somebody wrote down. This module
// finds the other half mechanically. It does not look for claims ("folds
// with X", "same contract as X"); it looks for two live proposals naming the
// same artifact — a file, an endpoint, a contract symbol — which is a much
// weaker and much more common thing for prose to do by accident.
//
// What it emits are CANDIDATES. Nothing here writes to korg, and nothing the
// board renders comes from here: the curator reads these hints, verifies each
// against the prose, and writes the edge with its own `origin` stamp (GP-1).
// Keeping the heuristic on this side of that line is what makes it
// swappable — if it turns out noisy, only the curator's input changes.
//
// Everything is pure. Same queue in, same hints out, byte for byte (GP-2) —
// which is why it can run on every pass rather than daily.

import { CURATOR_MARKER } from '../src/lib/curator.ts';

// A token named by more live proposals than this is vocabulary, not a
// collision — `docs/design.md` is cited by everything kfdc plans. An
// inverse-frequency cut is self-maintaining where a stoplist would rot.
export const AMBIENT_MAX = 3;

// The curator's own ground rules call a pass wanting more than ~10 edges a
// broken pass. A hint list that floods it is a hint list that gets ignored,
// so the cap is here and what it hides is reported, never dropped silently.
export const MAX_HINTS = 8;

export type TokenKind = 'file' | 'endpoint' | 'symbol';

// Weights by how much the shared token narrows things: a file path is the
// "same file" heuristic itself, an endpoint is a named contract, a symbol is
// the weakest — korg's vocabulary appears in prose that merely discusses it.
const WEIGHT: Record<TokenKind, number> = { file: 3, endpoint: 3, symbol: 1 };

// A repo-relative path names one file only inside one repo: kyac's
// `docs/usage.md` and klams' are different files, and every repo has a
// `package.json`. Measured over korg's 264-proposal corpus, the only two false
// positives in the top 8 were exactly this — cross-project file matches. A
// named contract does not have the problem, because being global is what makes
// it a contract, so only `file` is docked. Docked rather than dropped: korg's
// #1435 naming kfdc's `src/lib/flow.ts` is a real cross-project collision, and
// the block says which kind of match it is so the curator can reject one with a
// reason rather than a hunch.
const CROSS_PROJECT_FILE_WEIGHT = 1;

export interface ProposalProse {
	node_id: number;
	title: string;
	project: string;
	summary: string;
	notes: string | null;
	comments: { body: string }[];
}

// Structural on purpose: korg's real `Board` satisfies it, and so does a
// fixture naming only the fields suppression reads.
export interface BoardContext {
	proposal_edges: { left: number; right: number; label: string }[];
	blocked: { via: string; dependent: number; blocker: number; sequenced_by: number | null }[];
	programs: { node_id: number; slices: { node_id: number }[] }[];
}

export interface Mention {
	kind: TokenKind;
	token: string;
	// Which of summary / notes / comments named it, in that order.
	fields: string[];
}

export interface SharedToken {
	kind: TokenKind;
	token: string;
	// How many live proposals name it — the curator's cue for how much the
	// token actually narrows: 2 is specific, AMBIENT_MAX is nearly vocabulary.
	docs: number;
}

export interface CandidateSide {
	node_id: number;
	title: string;
	project: string;
	fields: string[];
}

export interface Candidate {
	// Undirected, like korg's `collides-with` label: lower node_id first, so
	// the pair has one spelling regardless of queue order.
	sides: [CandidateSide, CandidateSide];
	shared: SharedToken[];
	score: number;
	// The two proposals belong to different projects, which is what makes a
	// shared file path weak and a shared contract strong.
	crossProject: boolean;
}

export interface Suppressed {
	// Tokens dropped for being named by more than AMBIENT_MAX proposals.
	ambient: number;
	// Pairs korg already carries a depends_on / collides-with edge for.
	recorded: number;
	// Pairs korg reports as sequenced by a live program (kfdc #1070).
	sequenced: number;
	// Pairs that are two slices of one program — that program already ordered
	// them, and Operations draws it.
	sameProgram: number;
	// Candidates past MAX_HINTS.
	overCap: number;
}

export interface HintReport {
	candidates: Candidate[];
	suppressed: Suppressed;
	// Live proposals scanned, so an empty block can be told from an empty queue.
	live: number;
}

const FILE_EXT =
	'ts|tsx|js|mjs|cjs|svelte|rs|py|sh|sql|md|json|jsonc|toml|yaml|yml|css|html|rb|go|service|timer';

const URL_RE = /https?:\/\/\S+/g;
const ENDPOINT_RE = /\b(GET|POST|PUT|PATCH|DELETE)\s+(\/[A-Za-z0-9/_{}.:-]*[A-Za-z0-9/_}])/g;
const FILE_RE = new RegExp(
	`(?<![\\w./-])((?:[A-Za-z0-9_@.-]+/)*[A-Za-z0-9_.-]+\\.(?:${FILE_EXT}))(?![A-Za-z0-9-])`,
	'g'
);
const BACKTICKED_RE = /`([^`\n]{1,60})`/g;
// snake_case or kebab-case, at least two parts: korg's own vocabulary shape
// (`sequenced_by`, `collides-with`, `get_board`). Requiring the backticks is
// the precision half — bare prose says "collides with" constantly.
const SYMBOL_RE = /^[a-z][a-z0-9]*(?:[_-][a-z0-9]+)+$/;

function scan(text: string): { kind: TokenKind; token: string }[] {
	// A URL's path is somebody else's file tree, not this repo's.
	const clean = text.replace(URL_RE, ' ');
	const found: { kind: TokenKind; token: string }[] = [];

	for (const m of clean.matchAll(ENDPOINT_RE)) {
		found.push({ kind: 'endpoint', token: `${m[1]} ${m[2]}` });
	}
	for (const m of clean.matchAll(FILE_RE)) {
		const token = m[1].replace(/^\.\//, '');
		// `kubsdb.encke-wahoo.ts.net` is a host, not a TypeScript file. Nothing
		// with two dots and no directory is a path anyone writes.
		if (!token.includes('/') && (token.match(/\./g) ?? []).length > 1) continue;
		found.push({ kind: 'file', token });
	}
	for (const m of clean.matchAll(BACKTICKED_RE)) {
		const token = m[1].trim();
		if (SYMBOL_RE.test(token)) found.push({ kind: 'symbol', token });
	}
	return found;
}

const key = (kind: TokenKind, token: string) => `${kind} ${token}`;

// Every artifact this proposal names, and which field named it. The curator's
// own marked synopsis is skipped: it quotes the artifacts it mined, so leaving
// it in would let a written edge re-propose itself forever.
export function tokens(p: ProposalProse): Mention[] {
	const byToken = new Map<string, Mention>();
	const add = (field: string, text: string | null) => {
		if (!text) return;
		for (const { kind, token } of scan(text)) {
			const k = key(kind, token);
			const m = byToken.get(k) ?? { kind, token, fields: [] };
			if (!m.fields.includes(field)) m.fields.push(field);
			byToken.set(k, m);
		}
	};
	add('summary', p.summary);
	add('notes', p.notes);
	for (const c of p.comments) {
		if (c.body.startsWith(CURATOR_MARKER)) continue;
		add('comments', c.body);
	}
	return [...byToken.values()];
}

const pairKey = (a: number, b: number) => `${Math.min(a, b)}:${Math.max(a, b)}`;

const weigh = (s: SharedToken, crossProject: boolean) =>
	(s.kind === 'file' && crossProject ? CROSS_PROJECT_FILE_WEIGHT : WEIGHT[s.kind]) *
	(AMBIENT_MAX + 1 - s.docs);

export function collisionHints(prose: ProposalProse[], ctx: BoardContext): HintReport {
	const suppressed: Suppressed = {
		ambient: 0,
		recorded: 0,
		sequenced: 0,
		sameProgram: 0,
		overCap: 0
	};
	const rows = new Map(prose.map((p) => [p.node_id, p] as const));

	// token -> the proposals naming it, and where.
	const corpus = new Map<
		string,
		{ kind: TokenKind; token: string; where: Map<number, string[]> }
	>();
	for (const p of prose) {
		for (const m of tokens(p)) {
			const k = key(m.kind, m.token);
			const entry = corpus.get(k) ?? { kind: m.kind, token: m.token, where: new Map() };
			entry.where.set(p.node_id, m.fields);
			corpus.set(k, entry);
		}
	}

	const pairs = new Map<string, { a: number; b: number; shared: SharedToken[] }>();
	for (const entry of corpus.values()) {
		const nodes = [...entry.where.keys()].sort((x, y) => x - y);
		if (nodes.length < 2) continue;
		if (nodes.length > AMBIENT_MAX) {
			suppressed.ambient++;
			continue;
		}
		for (let i = 0; i < nodes.length; i++) {
			for (let j = i + 1; j < nodes.length; j++) {
				const k = pairKey(nodes[i], nodes[j]);
				const p = pairs.get(k) ?? { a: nodes[i], b: nodes[j], shared: [] };
				p.shared.push({ kind: entry.kind, token: entry.token, docs: nodes.length });
				pairs.set(k, p);
			}
		}
	}

	// What korg already says about a pair. Deconfliction renders exactly two
	// labels, so only those two count as "already recorded" — a `related-to`
	// edge is not a statement that two proposals collide.
	const recorded = new Set(
		ctx.proposal_edges
			.filter((e) => e.label === 'depends_on' || e.label === 'collides-with')
			.map((e) => pairKey(e.left, e.right))
	);
	// kfdc #1070: korg is the only side that can say a dependency is
	// program-ordered, and Operations already draws that order. A deterministic
	// pass that ignores this re-surfaces what sprint 007 quieted — reliably,
	// which is worse than an LLM doing it occasionally.
	const sequenced = new Set(
		ctx.blocked
			.filter((x) => x.via === 'proposal' && x.sequenced_by !== null)
			.map((x) => pairKey(x.dependent, x.blocker))
	);
	// The same rule one step out: two slices of one program are already ordered
	// relative to each other, whether or not an edge spells it out.
	const sameProgram = new Set<string>();
	for (const prog of ctx.programs) {
		const ids = prog.slices.map((s) => s.node_id);
		for (let i = 0; i < ids.length; i++) {
			for (let j = i + 1; j < ids.length; j++) sameProgram.add(pairKey(ids[i], ids[j]));
		}
	}

	// Where a proposal names the tokens of one pair — summary / notes /
	// comments, merged across the shared tokens and kept in reading order.
	const fieldsFor = (shared: SharedToken[], node_id: number): string[] => {
		const seen = new Set<string>();
		for (const s of shared) {
			for (const f of corpus.get(key(s.kind, s.token))?.where.get(node_id) ?? []) seen.add(f);
		}
		return ['summary', 'notes', 'comments'].filter((f) => seen.has(f));
	};

	const kept: Candidate[] = [];
	for (const [k, p] of [...pairs.entries()].sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0))) {
		if (recorded.has(k)) {
			suppressed.recorded++;
			continue;
		}
		if (sequenced.has(k)) {
			suppressed.sequenced++;
			continue;
		}
		if (sameProgram.has(k)) {
			suppressed.sameProgram++;
			continue;
		}
		const crossProject = rows.get(p.a)!.project !== rows.get(p.b)!.project;
		const shared = [...p.shared].sort(
			(x, y) => weigh(y, crossProject) - weigh(x, crossProject) || (x.token < y.token ? -1 : 1)
		);
		const side = (id: number): CandidateSide => {
			const r = rows.get(id)!;
			return { node_id: id, title: r.title, project: r.project, fields: fieldsFor(shared, id) };
		};
		kept.push({
			sides: [side(p.a), side(p.b)],
			shared,
			score: shared.reduce((n, s) => n + weigh(s, crossProject), 0),
			crossProject
		});
	}

	kept.sort(
		(x, y) =>
			y.score - x.score ||
			x.sides[0].node_id - y.sides[0].node_id ||
			x.sides[1].node_id - y.sides[1].node_id
	);
	suppressed.overCap = Math.max(0, kept.length - MAX_HINTS);

	return { candidates: kept.slice(0, MAX_HINTS), suppressed, live: prose.length };
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

// The block appended to curator/prompt.md on stdin. Prose, not JSON: its
// reader is the curator, and every line has to carry enough for the curator to
// go and check it.
export function renderHints(r: HintReport, generated: string): string {
	const out: string[] = [
		'## Deterministic collision hints',
		'',
		`Produced by \`bin/collision-hints\` over the ${plural(r.live, 'live proposal')} on the` +
			` ${generated} board — mechanically, by looking for two proposals that name the same` +
			' file, endpoint or contract symbol. **These are candidates, not findings.** Nothing' +
			' here has read what the proposals mean, and a shared artifact is not a collision by' +
			' itself.',
		''
	];

	if (r.candidates.length === 0) {
		out.push('- none — no two live proposals name a common artifact this pass.');
	} else {
		for (const c of r.candidates) {
			const shared = c.shared
				.map((s) => `\`${s.token}\` (${s.kind}, named by ${s.docs})`)
				.join(', ');
			out.push(`- korg:${c.sides[0].node_id} ↔ korg:${c.sides[1].node_id} — shared ${shared}`);
			for (const s of c.sides) {
				out.push(
					`  - korg:${s.node_id} [${s.project}] ${s.title} — named in ${s.fields.join(', ')}`
				);
			}
			if (c.crossProject && c.shared.some((s) => s.kind === 'file')) {
				out.push(
					'  - weak: different projects, so a shared PATH is probably two different files' +
						' — take this pair on its shared contracts, if any, not on the path.'
				);
			}
		}
	}

	const s = r.suppressed;
	out.push(
		'',
		`Set aside, so the omissions are not silent: ${plural(s.recorded, 'pair')} korg already` +
			` carries an edge for, ${plural(s.sequenced, 'pair')} korg reports as sequenced by a live` +
			` program, ${plural(s.sameProgram, 'pair')} already ordered as slices of one program,` +
			` ${plural(s.ambient, 'token')} named by more than ${AMBIENT_MAX} proposals (vocabulary,` +
			` not collision), ${plural(s.overCap, 'candidate')} past the cap of ${MAX_HINTS}.`
	);
	return out.join('\n');
}
