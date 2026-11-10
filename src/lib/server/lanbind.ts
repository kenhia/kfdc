// korg:4436 — the second bind. The unit pins HOST=127.0.0.1 because
// tailscaled holds <ts-ip>:<port> for `tailscale serve`, so a wildcard bind
// crash-loops on EADDRINUSE. That left the board unreachable from the LAN,
// and so from kwebi's container, whose kFDC tile read Down while the board
// served. Ken's decision (2026-11-09): also bind the host's LAN address —
// two named addresses, never 0.0.0.0, the loopback-plus-LAN pattern the
// docker services on kubsdb use.
//
// adapter-node takes one HOST and allows one socket-activation fd, so the
// second address is a TCP forwarder into the loopback server, started from
// the init hook. That keeps ExecStart on build/index.js — which is what
// knarr's --expect-file and every rollback assume — and leaves a version
// that predates this one simply ignoring LAN_HOST.

import { createServer, connect, isIP, type Server, type Socket } from 'node:net';

const WILDCARDS = new Set(['0.0.0.0', '::', '[::]']);

/**
 * The validated extra address, or null when none is configured. Throws on a
 * value that must not be bound: a misconfigured placement should stop the
 * service where the deploy's readiness probe sees it, not degrade quietly.
 */
export function lanHost(raw: string | undefined, host: string | undefined): string | null {
	const v = raw?.trim();
	if (!v) return null;
	if (WILDCARDS.has(v)) {
		throw new Error(
			`LAN_HOST=${v} is a wildcard; it would take the tailnet address from tailscaled`
		);
	}
	if (isIP(v) === 0) throw new Error(`LAN_HOST=${v} is not a single IP address`);
	if (v === host) throw new Error(`LAN_HOST=${v} is the address the server already binds`);
	return v;
}

export interface LanBind {
	/** Resolves on the first successful bind (never rejects; failures retry). */
	listening: Promise<void>;
	close(): void;
}

export function startLanBind(opts: {
	host: string;
	port: number;
	target: string;
	log: (msg: string) => void;
	retryMs?: number;
}): LanBind {
	const { host, port, target, log, retryMs = 10_000 } = opts;
	const sockets = new Set<Socket>();
	let closed = false;
	let retry: NodeJS.Timeout | undefined;
	let resolveListening!: () => void;
	const listening = new Promise<void>((r) => (resolveListening = r));

	const track = (s: Socket) => {
		sockets.add(s);
		s.once('close', () => sockets.delete(s));
	};

	const server: Server = createServer((client) => {
		const upstream = connect(port, target);
		track(client);
		track(upstream);
		client.on('error', () => upstream.destroy());
		upstream.on('error', () => client.destroy());
		client.pipe(upstream).pipe(client);
	});

	server.on('error', (err: NodeJS.ErrnoException) => {
		if (closed) return;
		log(`kfdc: cannot bind ${host}:${port} (${err.code ?? err.message}); retrying in ${retryMs}ms`);
		retry = setTimeout(bind, retryMs);
		// The retry alone must not hold the process up: once adapter-node has
		// closed its server the process should exit (kfdc #1200).
		retry.unref();
	});

	server.on('listening', () => {
		log(`kfdc: also listening on ${host}:${port}`);
		resolveListening();
	});

	function bind() {
		if (!closed) server.listen(port, host);
	}
	bind();

	return {
		listening,
		close() {
			closed = true;
			clearTimeout(retry);
			server.close();
			for (const s of sockets) s.destroy();
		}
	};
}
