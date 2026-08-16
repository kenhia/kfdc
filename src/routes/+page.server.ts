import { fetchBoard, fetchFlow, korgBase } from '$lib/server/korg';
import { netlog } from '$lib/server/netlog';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	// fetchBoard observes before returning, so the strip below already
	// includes whatever this very refresh changed. The flow feed rides
	// alongside and is allowed to be null (korg may predate the endpoint).
	const [board, flow] = await Promise.all([fetchBoard(fetch), fetchFlow(fetch)]);
	return { board, flow, netlog: netlog().recent(20), korgBase: korgBase() };
};
