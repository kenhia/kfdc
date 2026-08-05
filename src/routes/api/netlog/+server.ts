import { json } from '@sveltejs/kit';
import { netlog } from '$lib/server/netlog';
import type { RequestHandler } from './$types';

// Reads the local Net Log store only — no korg call (kfdc #993).
export const GET: RequestHandler = ({ url }) => {
	const n = Math.min(Number(url.searchParams.get('n')) || 20, 200);
	return json(netlog().recent(n));
};
