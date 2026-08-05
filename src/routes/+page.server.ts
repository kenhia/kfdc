import { fetchBoard, korgBase } from '$lib/server/korg';
import { netlog } from '$lib/server/netlog';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	// fetchBoard observes before returning, so the strip below already
	// includes whatever this very refresh changed.
	const board = await fetchBoard(fetch);
	return { board, netlog: netlog().recent(20), korgBase: korgBase() };
};
