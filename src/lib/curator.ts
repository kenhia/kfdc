// Parsing and derivations for the curator's render contract.
//
// The format is defined in curator/prompt.md (the write side); this module is
// the read side. Both must move together — a format change is a contract
// change, not a tweak. Everything here is pure: malformed input degrades to
// "no curated content", never to a throw, because the board renders whatever
// korg holds.

import type { Board, ProposalEdge } from './board';

export const CURATOR_MARKER = '⟦curator⟧';

export interface DeconLine {
	kind: 'after' | 'collides-with';
	other: number;
	why: string;
	minedFrom: string | null;
}

export interface ParsedSynopsis {
	line: string;
	deconfliction: DeconLine[];
	minedFrom: string | null;
}

// `- after korg:7 — why (mined from src, date)` / `- collides-with korg:7 — why`
const DECON_LINE = /^- (after|collides-with) korg:(\d+) — (.+?)(?: \(mined from (.+)\))?$/;

export function parseSynopsis(body: string): ParsedSynopsis | null {
	if (!body.startsWith(CURATOR_MARKER)) return null;
	const lines = body.split('\n');
	const parsed: ParsedSynopsis = {
		line: lines[0].slice(CURATOR_MARKER.length).trim(),
		deconfliction: [],
		minedFrom: null
	};
	for (const l of lines.slice(1)) {
		const m = DECON_LINE.exec(l);
		if (m) {
			parsed.deconfliction.push({
				kind: m[1] as DeconLine['kind'],
				other: Number(m[2]),
				why: m[3],
				minedFrom: m[4] ?? null
			});
		} else if (l.startsWith('mined from: ')) {
			parsed.minedFrom = l.slice('mined from: '.length);
		}
	}
	return parsed;
}

export interface NodeChip {
	node_id: number;
	title: string;
	project: string;
}

export interface ConflictCard {
	kind: 'after' | 'collides-with';
	// In render order (kfdc #1027): reading order IS execution order. A
	// depends_on edge puts the prerequisite (the edge's right endpoint) first
	// and the dependent second; collisions are unordered and keep edge order.
	chips: [NodeChip, NodeChip];
	why: string | null;
	minedFrom: string | null;
	origin: string | null;
	created: string;
	// korg #978's `sequenced_by`: the live program already drawing this
	// dependency as an ordered sequence, or null. Never set on a collision —
	// a collision is unordered, so no program order can express it.
	sequencedBy: number | null;
}

export interface DeconflictionView {
	// What the panel draws.
	cards: ConflictCard[];
	// What it sets aside: dependencies a live program's ordered slices already
	// express (kfdc #1070 — "the same data twice, in Operations and
	// Deconfliction"). Reported as a count rather than dropped silently, or
	// the panel's "fires deconflicted" would be doing the hiding.
	sequenced: ConflictCard[];
}

// The Deconfliction panel: depends_on / collides-with edges whose both ends
// are board rows, as cards. Prose comes from whichever endpoint's synopsis
// carries a matching deconfliction line (edge `depends_on` ↔ line `after`).
// Collisions sort before sequencing — they demand a decision, not just
// ordering — newest first within each.
export function deconfliction(b: Board): DeconflictionView {
	const rows = new Map([...b.active, ...b.queue].map((r) => [r.node_id, r] as const));
	// korg is the only side that can say a dependency is program-ordered, so
	// it labels it and kfdc filters on the label (korg #978). Keyed
	// dependent→blocker, which is a depends_on edge's left→right; `covered`
	// entries hang off a work item and have no proposal edge to match.
	const sequencedBy = new Map(
		b.blocked
			.filter((x) => x.via === 'proposal' && x.sequenced_by !== null)
			.map((x) => [`${x.dependent}:${x.blocker}`, x.sequenced_by!] as const)
	);
	const chip = (id: number) => {
		const r = rows.get(id)!;
		return { node_id: r.node_id, title: r.title, project: r.project };
	};
	const prose = (e: ProposalEdge, kind: DeconLine['kind']) => {
		for (const [self, other] of [
			[e.left, e.right],
			[e.right, e.left]
		]) {
			const syn = rows.get(self)?.synopsis;
			const line = syn
				? parseSynopsis(syn.body)?.deconfliction.find((d) => d.kind === kind && d.other === other)
				: undefined;
			if (line) return line;
		}
		return null;
	};

	const all = b.proposal_edges
		.filter(
			(e) =>
				(e.label === 'depends_on' || e.label === 'collides-with') &&
				rows.has(e.left) &&
				rows.has(e.right)
		)
		.map((e): ConflictCard => {
			const kind = e.label === 'depends_on' ? 'after' : 'collides-with';
			const line = prose(e, kind);
			return {
				kind,
				chips: kind === 'after' ? [chip(e.right), chip(e.left)] : [chip(e.left), chip(e.right)],
				why: line?.why ?? null,
				minedFrom: line?.minedFrom ?? null,
				origin: e.origin,
				created: e.created,
				sequencedBy: kind === 'after' ? (sequencedBy.get(`${e.left}:${e.right}`) ?? null) : null
			};
		})
		.sort(
			(a, b) =>
				Number(a.kind === 'after') - Number(b.kind === 'after') ||
				b.created.localeCompare(a.created)
		);

	return {
		cards: all.filter((c) => c.sequencedBy === null),
		sequenced: all.filter((c) => c.sequencedBy !== null)
	};
}
