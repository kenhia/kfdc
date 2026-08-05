// The one path to korg. Server-only: the token (if korg ever grows auth)
// lives in .env and never reaches the client.
import { env } from '$env/dynamic/private';
import type { Board } from '$lib/board';
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
