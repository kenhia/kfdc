// kfdc #1200. The Net Log poller is the only timer in the app, and a bare
// setInterval holds node's event loop open forever — so adapter-node's
// SIGTERM handler drains the HTTP server and then waits on a loop that can
// never empty. systemd gives up after TimeoutStopSec (90s) and SIGKILLs.
// These are the two properties that make the process exit on SIGTERM
// instead; the end-to-end proof is in sprints/013-deploy-via-knarr.md.

import type { AddressInfo } from 'node:net';
import { createServer } from 'node:http';
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

// korg:4436. The second listener is started by init and must close with the
// server, or SIGTERM leaves a referenced socket holding the process up.
describe('the LAN listener', () => {
	const LAN = Symbol.for('kfdc.lanbind');
	const saved = { ...process.env };

	beforeEach(clearPoller);
	afterEach(() => {
		clearPoller();
		process.emit('sveltekit:shutdown' as never, 'SIGTERM' as never);
		process.removeAllListeners('sveltekit:shutdown');
		process.env = { ...saved };
	});

	it('is not started without LAN_HOST', async () => {
		delete process.env.LAN_HOST;
		process.env.PORT = '8100';
		const { init } = await import('./hooks.server');
		init?.();
		expect((globalThis as Record<symbol, unknown>)[LAN]).toBeUndefined();
	});

	it('serves the board on LAN_HOST and closes on shutdown', async () => {
		const upstream = createServer((_req, res) => res.end('board'));
		await new Promise<void>((r) => upstream.listen(0, '127.0.0.1', r));
		const port = (upstream.address() as AddressInfo).port;
		Object.assign(process.env, { HOST: '127.0.0.1', PORT: String(port), LAN_HOST: '127.0.0.2' });
		try {
			const { init } = await import('./hooks.server');
			init?.();
			const lan = (globalThis as Record<symbol, unknown>)[LAN] as { listening: Promise<void> };
			await lan.listening;
			expect(await (await fetch(`http://127.0.0.2:${port}/`)).text()).toBe('board');
			process.emit('sveltekit:shutdown' as never, 'SIGTERM' as never);
			expect((globalThis as Record<symbol, unknown>)[LAN]).toBeUndefined();
			await expect(fetch(`http://127.0.0.2:${port}/`)).rejects.toThrow();
		} finally {
			await new Promise((r) => upstream.close(r));
		}
	});
});
