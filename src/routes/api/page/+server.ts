// The board's refresh feed: everything one board render needs, in one round
// trip. `/api/board` is korg's rollup verbatim and stays that; this is the
// page payload, which also carries the Net Log strip and the flow series.
//
// It shipped as `/api/wall` and was never wall-specific — it is `boardPayload`,
// the same thing `/`'s server load returns, and its header said so from day one.
// Since #1496 (sprint 018) the desk refreshes through it too, so the name has
// been corrected to the one it always described. Both consumers are in this
// repo and reach it through `payload.fetchPayload`.
//
// It is a fetch rather than SvelteKit's `invalidateAll()` on purpose. A load
// that throws during invalidation takes the page to +error.svelte, which on an
// unattended wall means one korg blip replaces the board with No Comms and
// nothing is left running to bring it back — and on the desk means the same
// blip closes the korg pane Ken was reading. A fetch the page can catch keeps
// the last good board on screen and marks it (see $lib/feed.svelte.ts).
import { json } from '@sveltejs/kit';
import { boardPayload } from '$lib/server/page-data';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ fetch }) => json(await boardPayload(fetch));
