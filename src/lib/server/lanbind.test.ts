// korg:4436. kfdc binds loopback for tailscale serve, and LAN_HOST adds one
// more named address so a LAN client (kwebi's container) can reach the same
// process. These pin the two halves: the address is validated before
// anything binds, and the listener forwards to the loopback server.

import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { lanHost, startLanBind, type LanBind } from './lanbind';

describe('lanHost', () => {
	it('is null when unset or blank — loopback only, as before', () => {
		expect(lanHost(undefined, '127.0.0.1')).toBeNull();
		expect(lanHost('  ', '127.0.0.1')).toBeNull();
	});

	it('takes one literal address', () => {
		expect(lanHost(' 192.168.1.60 ', '127.0.0.1')).toBe('192.168.1.60');
	});

	// A wildcard would cover the tailnet address tailscaled already holds,
	// which is the EADDRINUSE crash-loop the unit's HOST pin exists to stop.
	it.each(['0.0.0.0', '::', '[::]'])('refuses the wildcard %s', (w) => {
		expect(() => lanHost(w, '127.0.0.1')).toThrow(/wildcard/);
	});

	it('refuses a hostname — the bind must name an address', () => {
		expect(() => lanHost('kubsdb', '127.0.0.1')).toThrow(/address/);
	});

	it('refuses a list — one extra address, not a bind policy', () => {
		expect(() => lanHost('192.168.1.60,10.0.0.1', '127.0.0.1')).toThrow(/address/);
	});

	it('refuses the address the server already binds', () => {
		expect(() => lanHost('127.0.0.1', '127.0.0.1')).toThrow(/already/);
	});
});

describe('startLanBind', () => {
	let upstream: Server | undefined;
	let lan: LanBind | undefined;

	afterEach(async () => {
		lan?.close();
		lan = undefined;
		if (upstream) await new Promise((r) => upstream!.close(r));
		upstream = undefined;
	});

	/** The stand-in for adapter-node's server: loopback, ephemeral port. */
	async function serveLoopback(): Promise<number> {
		upstream = createServer((req, res) => res.end(`board ${req.url}`));
		await new Promise<void>((r) => upstream!.listen(0, '127.0.0.1', r));
		return (upstream.address() as AddressInfo).port;
	}

	it('answers on the extra address with the loopback server', async () => {
		const port = await serveLoopback();
		lan = startLanBind({ host: '127.0.0.2', port, target: '127.0.0.1', log: vi.fn() });
		await lan.listening;
		const res = await fetch(`http://127.0.0.2:${port}/wall`);
		expect(await res.text()).toBe('board /wall');
	});

	it('stops answering once closed', async () => {
		const port = await serveLoopback();
		lan = startLanBind({ host: '127.0.0.2', port, target: '127.0.0.1', log: vi.fn() });
		await lan.listening;
		lan.close();
		await expect(fetch(`http://127.0.0.2:${port}/`)).rejects.toThrow();
	});

	// At boot the LAN address may not be up yet. The board must keep serving
	// on loopback (and so on its ts.net URL) and keep trying, not crash.
	it('logs a bind failure and retries rather than throwing', async () => {
		const port = await serveLoopback();
		const log = vi.fn();
		// TEST-NET-1: never assigned to this host, so the bind fails.
		lan = startLanBind({ host: '192.0.2.1', port, target: '127.0.0.1', log, retryMs: 20 });
		await vi.waitFor(() => expect(log.mock.calls.length).toBeGreaterThanOrEqual(2));
		expect(String(log.mock.calls[0][0])).toMatch(/192\.0\.2\.1.*retrying/);
	});
});
