// Net Log — pure digest/diff/format derivations (kfdc #992/#993, korg:994).
// Viewer state, not work data: a digest records what THIS board showed; a
// diff between two digests yields transcript lines. A line carries its
// OBSERVATION time (the board's own `generated` clock) and never invents
// precision between observations.

import { progress, type Board } from './board';

export interface Digest {
	v: 1;
	generated: string;
	fm: Record<string, { title: string; project: string; complete: number; total: number }>;
	od: Record<string, { title: string; project: string }>;
	cc: Record<
		string,
		{
			title: string;
			project: string | null;
			kind: string;
			wi_number: number | null;
			note: string | null;
		}
	>;
	op: Record<string, { title: string; status: string }>;
	// proposals_omitted.done — lets an FM departure be read as a ship.
	done: number;
}

export interface NetLogLine {
	observed: string;
	panel: 'FM' | 'CC' | 'OD' | 'OP';
	verb: string;
	project: string | null;
	node_id: number;
	wi_number: number | null;
	kind: string;
	text: string;
}

// Reduce a board response to the few fields whose change is significant.
export function digestBoard(b: Board): Digest {
	const fm: Digest['fm'] = {};
	for (const r of b.active) {
		const p = progress(r);
		fm[r.node_id] = { title: r.title, project: r.project, complete: p.complete, total: p.total };
	}
	const od: Digest['od'] = {};
	for (const r of b.queue) od[r.node_id] = { title: r.title, project: r.project };
	const cc: Digest['cc'] = {};
	for (const r of b.awaiting)
		cc[r.node_id] = {
			title: r.title,
			project: r.project,
			kind: r.kind,
			wi_number: r.wi_number,
			note: r.awaiting_note
		};
	const op: Digest['op'] = {};
	for (const r of b.programs) op[r.node_id] = { title: r.title, status: r.status };
	return { v: 1, generated: b.generated, fm, od, cc, op, done: b.proposals_omitted.done };
}

// One line's worth of title.
export function fragment(title: string, max = 60): string {
	return title.length <= max ? title : title.slice(0, max - 1).trimEnd() + '…';
}

// Significant-change vocabulary v1 (kfdc #992) — explicit and small:
// FM firing / splash (work-complete) / complete-or-out; CC call made /
// cleared; OD on deck / off deck (rank shuffles are silent by construction —
// rank is not in the digest); OP status changed. Expand only deliberately.
export function diffDigests(prev: Digest, next: Digest): NetLogLine[] {
	const at = next.generated;
	const lines: NetLogLine[] = [];
	const shipped = next.done > prev.done;

	const fmLine = (verb: string, id: string, project: string, text: string): NetLogLine => ({
		observed: at,
		panel: 'FM',
		verb,
		project,
		node_id: Number(id),
		wi_number: null,
		kind: 'sprint_proposal',
		text
	});

	for (const [id, e] of Object.entries(next.fm)) {
		const was = prev.fm[id];
		if (!was) {
			lines.push(fmLine('firing', id, e.project, fragment(e.title)));
		} else if (e.total > 0 && e.complete >= e.total && was.complete < was.total) {
			lines.push(fmLine('splash', id, e.project, 'work complete'));
		}
	}
	for (const [id, e] of Object.entries(prev.fm)) {
		if (next.fm[id]) continue;
		if (next.od[id]) lines.push(fmLine('out', id, e.project, 'back on deck'));
		else if (shipped) lines.push(fmLine('complete', id, e.project, 'proposal completed'));
		else lines.push(fmLine('out', id, e.project, 'left the board'));
	}

	const ccLine = (verb: string, id: string, e: Digest['cc'][string], text: string): NetLogLine => ({
		observed: at,
		panel: 'CC',
		verb,
		project: e.project,
		node_id: Number(id),
		wi_number: e.wi_number,
		kind: e.kind,
		text
	});

	for (const [id, e] of Object.entries(next.cc)) {
		if (!prev.cc[id])
			lines.push(ccLine('call made', id, e, fragment(e.title) + (e.note ? ` - ${e.note}` : '')));
	}
	for (const [id, e] of Object.entries(prev.cc)) {
		if (!next.cc[id]) lines.push(ccLine('cleared', id, e, fragment(e.title)));
	}

	const odLine = (verb: string, id: string, e: Digest['od'][string]): NetLogLine => ({
		observed: at,
		panel: 'OD',
		verb,
		project: e.project,
		node_id: Number(id),
		wi_number: null,
		kind: 'sprint_proposal',
		text: fragment(e.title)
	});

	// Promotion/demotion is FM traffic; the OD side of the same move is noise.
	for (const [id, e] of Object.entries(next.od)) {
		if (!prev.od[id] && !prev.fm[id]) lines.push(odLine('on deck', id, e));
	}
	for (const [id, e] of Object.entries(prev.od)) {
		if (!next.od[id] && !next.fm[id]) lines.push(odLine('off deck', id, e));
	}

	for (const [id, e] of Object.entries(next.op)) {
		const was = prev.op[id];
		if (was && was.status !== e.status) {
			lines.push({
				observed: at,
				panel: 'OP',
				verb: `status ${was.status}→${e.status}`,
				project: null,
				node_id: Number(id),
				wi_number: null,
				kind: 'program',
				text: fragment(e.title)
			});
		}
	}

	return lines;
}

// Ken's line format, adopted verbatim (kfdc #993). CC reads
// `CC: <verb> - <proj> <ref> <text>`; the rest read
// `<panel>: <verb> <proj> <ref> - <text>`.
export function formatLine(l: NetLogLine): string {
	const ref = l.wi_number ?? l.node_id;
	const proj = l.project ? `${l.project} ` : '';
	if (l.panel === 'CC') return `CC: ${l.verb} - ${proj}${ref} ${l.text}`;
	return `${l.panel}: ${l.verb} ${proj}${ref} - ${l.text}`;
}

// Mirrors korg's own AwaitingLane hrefs: a WI is reachable by number, a
// program has its own page, proposals live on Planning; anything else renders
// unlinked rather than pointing at a 404 — the deep-link gap is korg's.
export function lineHref(l: NetLogLine, base: string): string | null {
	if (l.kind === 'workitem' && l.wi_number != null) return `${base}/work-items?wi=${l.wi_number}`;
	if (l.kind === 'program') return `${base}/programs/${l.node_id}`;
	if (l.kind === 'sprint_proposal') return `${base}/planning`;
	return null;
}
