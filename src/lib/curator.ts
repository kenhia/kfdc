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

export interface ConflictCard {
	kind: 'after' | 'collides-with';
	left: { node_id: number; title: string; project: string };
	right: { node_id: number; title: string; project: string };
	why: string | null;
	minedFrom: string | null;
	origin: string | null;
	created: string;
}

// The Deconfliction panel: depends_on / collides-with edges whose both ends
// are board rows, as cards. Prose comes from whichever endpoint's synopsis
// carries a matching deconfliction line (edge `depends_on` ↔ line `after`).
// Collisions sort before sequencing — they demand a decision, not just
// ordering — newest first within each.
export function deconfliction(b: Board): ConflictCard[] {
	const rows = new Map([...b.active, ...b.queue].map((r) => [r.node_id, r] as const));
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

	return b.proposal_edges
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
				left: chip(e.left),
				right: chip(e.right),
				why: line?.why ?? null,
				minedFrom: line?.minedFrom ?? null,
				origin: e.origin,
				created: e.created
			};
		})
		.sort(
			(a, b) =>
				Number(a.kind === 'after') - Number(b.kind === 'after') ||
				b.created.localeCompare(a.created)
		);
}
