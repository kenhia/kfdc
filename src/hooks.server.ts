// Interval poll (kfdc #992): observation continues when no tab is open.
// Modest cadence on purpose — the observer's job is continuity, not
// surveillance-grade resolution (korg:994). fetchBoard itself observes, so
// the poll just reads and discards.

import { building } from '$app/environment';
import { fetchBoard } from '$lib/server/korg';
import { netlog } from '$lib/server/netlog';
import type { ServerInit } from '@sveltejs/kit';

const POLL_MS = 3 * 60_000;
const COMPACT_EVERY_TICKS = (24 * 60 * 60 * 1000) / POLL_MS;
const POLLER = Symbol.for('kfdc.netlog.poller');

export const init: ServerInit = () => {
	if (building) return;
	const g = globalThis as Record<symbol, unknown>;
	if (g[POLLER]) return; // dev HMR re-runs init; keep one poller
	netlog().compact(Date.now());
	let ticks = 0;
	g[POLLER] = setInterval(async () => {
		try {
			await fetchBoard();
		} catch {
			// korg unreachable — the next tick will try again.
		}
		if (++ticks % COMPACT_EVERY_TICKS === 0) netlog().compact(Date.now());
	}, POLL_MS);
};
