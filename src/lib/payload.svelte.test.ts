// The board's one client-side data path (#1496). Its name is a contract — both
// routes refresh through it, so the endpoint is spelled once — and its timeout
// is the thing that makes a hung korg fail LOUDLY instead of quietly.
//
// `.svelte.test.ts` for the environment, not for runes: `fetchPayload` needs a
// browser `fetch` and `AbortSignal.timeout`, which is the jsdom project.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPayload, REFRESH_TIMEOUT_MS, type BoardPayload } from './payload';

const payload = {
	board: { generated: '2026-08-20T12:00:00Z' },
	flow: null,
	netlog: [],
	korgBase: 'https://korg.example'
} as unknown as BoardPayload;

afterEach(() => {
	vi.restoreAllMocks();
});

describe('fetchPayload', () => {
	// One place knows what the endpoint is called. It shipped as `/api/wall` and
	// was never wall-specific; if a second spelling ever appears, one of the two
	// routes stops refreshing and nothing else notices.
	it('asks the one page endpoint, and returns what it said', async () => {
		const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(payload));
		await expect(fetchPayload()).resolves.toEqual(payload);
		expect(f.mock.calls[0][0]).toBe('/api/page');
	});

	// BoardFeed is the thing that decides what a failure MEANS, and it decides
	// the same thing for both routes — so this only has to reject.
	it('rejects on a status the board cannot render', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 502 }));
		await expect(fetchPayload()).rejects.toThrow('502');
	});

	// The failure mode this exists for: a socket that never answers. Without a
	// timeout the wall goes stale with no staleness marker and the desk's ↻ stays
	// dim forever, because neither ever learns the refresh ended.
	it('gives up on a refresh that never answers', async () => {
		vi.spyOn(globalThis, 'fetch').mockImplementation(
			(_input, init) =>
				new Promise((_resolve, reject) => {
					init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
				})
		);
		// A real 10ms rather than a faked 30s: `AbortSignal.timeout` runs on a
		// platform timer that vitest's fake clock does not drive, so faking it
		// would prove only that the test can move a clock nothing is watching.
		await expect(fetchPayload(10)).rejects.toThrow(/abort|timeout/i);
	});

	// The default bound has to sit clear of the wall's 3-minute poll, or a hung
	// refresh is still in flight when the next one is due and they stack.
	it('bounds a refresh well inside the poll it must not overlap', () => {
		expect(REFRESH_TIMEOUT_MS).toBeGreaterThan(0);
		expect(REFRESH_TIMEOUT_MS).toBeLessThan(3 * 60_000);
	});
});
