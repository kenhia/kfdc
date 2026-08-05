// The one path to korg. Server-only: the token (if korg ever grows auth)
// lives in .env and never reaches the client.
import { env } from '$env/dynamic/private';
import type { Board } from '$lib/board';

const DEFAULT_URL = 'https://kubsdb.encke-wahoo.ts.net:5674';

export async function fetchBoard(fetchFn: typeof fetch = fetch): Promise<Board> {
	const base = env.KORG_URL ?? DEFAULT_URL;
	const headers: HeadersInit = env.KORG_TOKEN ? { authorization: `Bearer ${env.KORG_TOKEN}` } : {};
	const res = await fetchFn(`${base}/api/board`, { headers });
	if (!res.ok) {
		throw new Error(`korg GET /api/board failed: ${res.status} ${res.statusText}`);
	}
	return res.json() as Promise<Board>;
}
