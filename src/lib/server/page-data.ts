// The board payload, assembled once. `/`, `/wall` and the wall's refresh
// endpoint all go through here so none of them can quietly render from a
// different set of reads than the others.
//
// It THROWS when korg is unreachable, and that is the contract: a cold load
// with no korg has nothing to render, and +error.svelte says so (No Comms).
// Only the wall's refresh treats a failure as survivable, because only the
// wall already has a board on screen to keep.
import type { BoardPayload } from '$lib/payload';
import { netlog } from './netlog';
import { fetchBoard, fetchFlow, korgBase } from './korg';

export async function boardPayload(fetchFn?: typeof fetch): Promise<BoardPayload> {
	// fetchBoard observes before returning, so the Net Log strip already
	// includes whatever this very read changed.
	const [board, flow] = await Promise.all([fetchBoard(fetchFn), fetchFlow(fetchFn)]);
	return { board, flow, netlog: netlog().recent(20), korgBase: korgBase() };
}
