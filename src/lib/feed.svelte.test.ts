// The feed's one piece of behaviour that is not a render (#1204, #1496): what a
// board does when it cannot reach korg. Named `.svelte.test.ts`
// because the module under test is `.svelte.ts` — it uses runes, so it needs
// the client project, same as a component test (see vite.config.ts).
import { describe, expect, it, vi } from 'vitest';
import { BoardFeed } from './feed.svelte';

// A stand-in for the board payload: the feed is deliberately generic, because
// what it guarantees is about REPLACEMENT, not about board shape.
type P = { n: number };

function feedOf(loads: Array<P | Error>) {
	let t = 0;
	const clock = () => t;
	let i = 0;
	const load = async (): Promise<P> => {
		const next = loads[Math.min(i++, loads.length - 1)];
		if (next instanceof Error) throw next;
		return next;
	};
	const f = new BoardFeed<P>({ n: 0 }, load, clock);
	// The wall's own cadence; the test advances by it so the ages it asserts are
	// the ones a real wall would print.
	const tick = async (minutes = 3) => {
		t += minutes * 60_000;
		await f.refresh();
	};
	return { f, tick, advance: (m: number) => (t += m * 60_000) };
}

describe('BoardFeed', () => {
	it('is current, and says nothing, while korg answers', async () => {
		const { f, tick } = feedOf([{ n: 1 }, { n: 2 }]);
		expect(f.stale).toBeNull();
		await tick();
		expect(f.payload).toEqual({ n: 1 });
		expect(f.stale).toBeNull();
		await tick();
		expect(f.payload).toEqual({ n: 2 });
		expect(f.stale).toBeNull();
	});

	// THE rule, learned on the wall and now the desk's too. A cold load with no
	// korg renders No Comms and that is right — there is nothing to render. Here
	// there is: the last thing korg actually said. Blanking it would replace real
	// information with none, on a screen nobody is standing at to reload — or, on
	// the desk, under a reader who was mid-row.
	it('keeps the last good board when the refresh fails, and marks it', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const { f, tick } = feedOf([{ n: 1 }, new Error('korg unreachable')]);
		await tick();
		expect(f.payload).toEqual({ n: 1 });

		await tick();
		// Untouched — this is the whole point.
		expect(f.payload).toEqual({ n: 1 });
		expect(f.misses).toBe(1);
		// Aged from the last load that WORKED, not from the first failure: what a
		// passer-by needs is the age of what they are reading.
		expect(f.stale).toBe('3m');

		await tick();
		expect(f.misses).toBe(2);
		expect(f.stale).toBe('6m');
		vi.restoreAllMocks();
	});

	it('clears the marker and resumes the moment korg answers again', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const { f, tick } = feedOf([new Error('down'), new Error('down'), { n: 7 }]);
		await tick();
		await tick();
		expect(f.stale).toBe('6m');

		await tick();
		expect(f.payload).toEqual({ n: 7 });
		expect(f.misses).toBe(0);
		expect(f.stale).toBeNull();
		vi.restoreAllMocks();
	});

	// A refresh that throws must not take the page with it — the error boundary
	// is the one outcome an unattended wall cannot recover from, because nothing
	// would be left running to try again, and on the desk it would throw away a
	// board (and an open korg pane) over one blip.
	it('never rejects, however the load fails', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const { f } = feedOf([new Error('boom')]);
		await expect(f.refresh()).resolves.toBeUndefined();
		vi.restoreAllMocks();
	});

	// The desk's ↻ reads this so a slow korg looks slow rather than dead (#1496).
	// It must clear on the failing path too, or one blip leaves the button stuck.
	it('reports a load in flight, and clears it however the load ends', async () => {
		let release!: (p: P) => void;
		const f = new BoardFeed<P>({ n: 0 }, () => new Promise<P>((r) => (release = r)));
		expect(f.busy).toBe(false);
		const inFlight = f.refresh();
		expect(f.busy).toBe(true);
		release({ n: 1 });
		await inFlight;
		expect(f.busy).toBe(false);

		vi.spyOn(console, 'error').mockImplementation(() => {});
		const failing = new BoardFeed<P>({ n: 0 }, async () => {
			throw new Error('down');
		});
		await failing.refresh();
		expect(failing.busy).toBe(false);
		vi.restoreAllMocks();
	});

	it('polls on the cadence it is given, and stops when told', async () => {
		vi.useFakeTimers();
		const loads: number[] = [];
		const f = new BoardFeed<P>({ n: 0 }, async () => ({ n: loads.push(1) }));
		const stop = f.start(3 * 60_000);
		await vi.advanceTimersByTimeAsync(9 * 60_000);
		expect(loads).toHaveLength(3);

		// The teardown is load-bearing: a wall left in dev HMR, or a page swapped
		// out, must not leave a second timer polling korg forever.
		stop();
		await vi.advanceTimersByTimeAsync(9 * 60_000);
		expect(loads).toHaveLength(3);
		vi.useRealTimers();
	});
});
