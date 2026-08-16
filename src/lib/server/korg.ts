// The one path to korg. Server-only: the token (if korg ever grows auth)
// lives in .env and never reaches the client.
import { env } from '$env/dynamic/private';
import type { Board } from '$lib/board';
import type { WorkItemFlowSeries } from '$lib/flow';
import { netlog } from './netlog';

const DEFAULT_URL = 'https://kubsdb.encke-wahoo.ts.net:5674';

// Also the korg web UI origin — Net Log lines deep-link into it.
export function korgBase(): string {
	return env.KORG_URL ?? DEFAULT_URL;
}

export async function fetchBoard(fetchFn: typeof fetch = fetch): Promise<Board> {
	const headers: HeadersInit = env.KORG_TOKEN ? { authorization: `Bearer ${env.KORG_TOKEN}` } : {};
	const res = await fetchFn(`${korgBase()}/api/board`, { headers });
	if (!res.ok) {
		throw new Error(`korg GET /api/board failed: ${res.status} ${res.statusText}`);
	}
	const board = (await res.json()) as Board;
	try {
		// Every board read is an observation (kfdc #992).
		netlog().observe(board);
	} catch (e) {
		// Observation must never take down the render.
		console.error('netlog: observe failed', e);
	}
	return board;
}

// korg #1318's flow series, the Rate of Fire panel's feed. No `days`
// parameter on purpose: the window is korg's call (6 at launch, 10 after
// 2026-08-18), and not naming it here is what lets the widening land with no
// kfdc edit. Returns null on ANY failure rather than throwing — production
// korg predates the endpoint until 059-backlog-flow deploys, and one panel
// losing its feed must never take down the board (netlog.observe doctrine).
export async function fetchFlow(fetchFn: typeof fetch = fetch): Promise<WorkItemFlowSeries | null> {
	const headers: HeadersInit = env.KORG_TOKEN ? { authorization: `Bearer ${env.KORG_TOKEN}` } : {};
	try {
		const res = await fetchFn(`${korgBase()}/api/work-items/flow`, { headers });
		if (!res.ok) {
			console.error(`korg GET /api/work-items/flow failed: ${res.status} ${res.statusText}`);
			return null;
		}
		return (await res.json()) as WorkItemFlowSeries;
	} catch (e) {
		console.error('korg GET /api/work-items/flow failed', e);
		return null;
	}
}
