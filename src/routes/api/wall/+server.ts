// The wall's refresh feed: everything one board render needs, in one round
// trip. `/api/board` is korg's rollup verbatim and stays that; this is the
// page payload, which also carries the Net Log strip and the flow series.
//
// It is a fetch rather than SvelteKit's `invalidateAll()` on purpose. A load
// that throws during invalidation takes the page to +error.svelte, which on an
// unattended wall means one korg blip replaces the board with No Comms and
// nothing is left running to bring it back. A fetch the page can catch keeps
// the last good board on screen and marks it (see wall/+page.svelte).
import { json } from '@sveltejs/kit';
import { boardPayload } from '$lib/server/page-data';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ fetch }) => json(await boardPayload(fetch));
