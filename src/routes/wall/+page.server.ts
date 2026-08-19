import { POLL_INTERVAL_MS } from '../../hooks.server';
import { boardPayload } from '$lib/server/page-data';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => ({
	...(await boardPayload(fetch)),
	// The wall refreshes on the board's one poll cadence rather than inventing a
	// second (#1204). It is imported, never copied: two clocks disagreeing about
	// how fresh the board is would show up in the statline, which ages
	// everything against `generated`. Server-side import, because
	// `hooks.server.ts` pulls in the whole korg path — the number reaches the
	// client as data.
	pollIntervalMs: POLL_INTERVAL_MS
});
