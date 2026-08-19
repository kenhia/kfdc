// Interval poll (kfdc #992): observation continues when no tab is open.
// Modest cadence on purpose — the observer's job is continuity, not
// surveillance-grade resolution (korg:994). fetchBoard itself observes, so
// the poll just reads and discards.

import { building } from '$app/environment';
import { fetchBoard } from '$lib/server/korg';
import { netlog } from '$lib/server/netlog';
import type { ServerInit } from '@sveltejs/kit';

// Exported because it is the board's one poll cadence and other surfaces
// align to it rather than restating the number (korg:1454 / #1204's wall
// mode refreshes the client on this beat). Import it; do not copy it.
export const POLL_INTERVAL_MS = 3 * 60_000;

const COMPACT_EVERY_TICKS = (24 * 60 * 60 * 1000) / POLL_INTERVAL_MS;
const POLLER = Symbol.for('kfdc.netlog.poller');

export const init: ServerInit = () => {
	if (building) return;
	const g = globalThis as Record<symbol, unknown>;
	if (g[POLLER]) return; // dev HMR re-runs init; keep one poller
	netlog().compact(Date.now());
	let ticks = 0;
	const poller = setInterval(async () => {
		try {
			await fetchBoard();
		} catch {
			// korg unreachable — the next tick will try again.
		}
		if (++ticks % COMPACT_EVERY_TICKS === 0) netlog().compact(Date.now());
	}, POLL_INTERVAL_MS);

	// kfdc #1200. This is the only timer in the app, and a referenced one
	// keeps node's event loop alive on its own. adapter-node's SIGTERM
	// handler closes the HTTP server and then relies on the loop draining
	// to exit — it never calls process.exit — so a referenced interval
	// means the process simply never leaves, systemd waits out
	// TimeoutStopSec (90s) and SIGKILLs, and the unit lands `failed` after
	// a clean stop. unref() is what lets it exit; the listening socket is
	// what keeps the process up while it is actually serving, so the poll
	// still ticks on schedule.
	poller.unref();
	g[POLLER] = poller;

	// adapter-node emits this once the server has closed. Stop the poll
	// there too: a tick landing inside the drain window would open a fresh
	// korg fetch, and that socket *is* referenced.
	process.once('sveltekit:shutdown', () => {
		clearInterval(poller);
		g[POLLER] = undefined;
	});
};
