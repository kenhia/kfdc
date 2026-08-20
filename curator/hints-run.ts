// The I/O half of the deterministic collision pass: read the live queue from
// korg, hand it to the pure heuristic in ./hints.ts, print the block that
// `bin/update-fdc` appends to curator/prompt.md on stdin.
//
// This runs OUTSIDE the curator, and it has to: the curator runs with
// `--strict-mcp-config --allowed-tools mcp__korg` and Bash/Edit/Write
// disallowed, so it cannot invoke a script. The hints reach it as input.
//
// It reads korg and writes nothing — not to korg, not to disk. The curator
// remains the only writer (GP-1).
//
// Failure is silent by contract: anything that goes wrong prints a line to
// stderr and exits non-zero WITHOUT writing to stdout, so the wrapper appends
// nothing and the curator pass runs exactly as it did before this existed. An
// absent block means the hint pass did not run; a block saying "none" means it
// ran and found nothing. Those are different facts and must stay different.

import type { Board, ProposalRow } from '../src/lib/board.ts';
import { collisionHints, renderHints, type ProposalProse } from './hints.ts';

// Same korg the curator's mcp-config.json points at. KORG_URL overrides it for
// a dev korg, matching src/lib/server/korg.ts.
const DEFAULT_URL = 'https://kubsdb.encke-wahoo.ts.net:5674';

interface ProposalDetail {
	node_id: number;
	notes: string | null;
	comments: { body: string }[];
	comments_truncated: boolean;
}

function headers(): HeadersInit {
	const token = process.env.KORG_TOKEN;
	return token ? { authorization: `Bearer ${token}` } : {};
}

async function get<T>(base: string, path: string): Promise<T> {
	const res = await fetch(`${base}${path}`, { headers: headers() });
	if (!res.ok) throw new Error(`korg GET ${path} failed: ${res.status} ${res.statusText}`);
	return (await res.json()) as T;
}

async function main() {
	const base = process.env.KORG_URL ?? DEFAULT_URL;
	const board = await get<Board>(base, '/api/board');
	const live: ProposalRow[] = [...board.active, ...board.queue];

	const details = await Promise.all(
		live.map((r) => get<ProposalDetail>(base, `/api/proposals/${r.node_id}`))
	);
	const byId = new Map(details.map((d) => [d.node_id, d] as const));

	const prose: ProposalProse[] = live.map((r) => ({
		node_id: r.node_id,
		title: r.title,
		project: r.project,
		summary: r.summary,
		notes: byId.get(r.node_id)?.notes ?? null,
		comments: byId.get(r.node_id)?.comments ?? []
	}));

	const generated = board.generated.slice(0, 10);
	const out = [renderHints(collisionHints(prose, board), generated)];

	// korg inlines at most 10 comments per proposal. Say so where it bit,
	// rather than letting a partial read look like a whole one.
	const truncated = details.filter((d) => d.comments_truncated).map((d) => `korg:${d.node_id}`);
	if (truncated.length > 0) {
		out.push(
			`\nRead partially: korg inlines only the newest 10 comments, so the prose scanned for` +
				` ${truncated.join(', ')} is incomplete.`
		);
	}

	process.stdout.write(`${out.join('\n')}\n`);
}

main().catch((e: unknown) => {
	console.error(`collision-hints: ${e instanceof Error ? e.message : String(e)}`);
	process.exit(1);
});
