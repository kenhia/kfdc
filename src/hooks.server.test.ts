// kfdc #1200. The Net Log poller is the only timer in the app, and a bare
// setInterval holds node's event loop open forever — so adapter-node's
// SIGTERM handler drains the HTTP server and then waits on a loop that can
// never empty. systemd gives up after TimeoutStopSec (90s) and SIGKILLs.
// These are the two properties that make the process exit on SIGTERM
// instead; the end-to-end proof is in sprints/013-deploy-via-knarr.md.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({ building: false, dev: false }));
vi.mock('$lib/server/korg', () => ({ fetchBoard: vi.fn().mockResolvedValue({}) }));
vi.mock('$lib/server/netlog', () => ({ netlog: () => ({ compact: vi.fn() }) }));

const POLLER = Symbol.for('kfdc.netlog.poller');

/** The live poller handle, read from the same global slot init() writes. */
function poller(): NodeJS.Timeout | undefined {
	return (globalThis as Record<symbol, unknown>)[POLLER] as NodeJS.Timeout | undefined;
}

function clearPoller() {
	const t = poller();
	if (t) clearInterval(t);
	(globalThis as Record<symbol, unknown>)[POLLER] = undefined;
}

describe('the Net Log poller', () => {
	beforeEach(clearPoller);
	afterEach(() => {
		clearPoller();
		process.removeAllListeners('sveltekit:shutdown');
	});

	it('does not hold the event loop open', async () => {
		const { init } = await import('./hooks.server');
		init?.();
		expect(poller()?.hasRef()).toBe(false);
	});

	it('stops polling once adapter-node reports the server closed', async () => {
		const { init } = await import('./hooks.server');
		init?.();
		expect(poller()).toBeDefined();
		process.emit('sveltekit:shutdown' as never, 'SIGTERM' as never);
		expect(poller()).toBeUndefined();
	});

	it('exports the cadence as a constant, so consumers import it', async () => {
		// The contract with korg:1454 / #1204 (wall mode aligns its client
		// refresh to this number): one knowable constant, importable.
		const { POLL_INTERVAL_MS } = await import('./hooks.server');
		expect(POLL_INTERVAL_MS).toBe(3 * 60_000);
	});
});
