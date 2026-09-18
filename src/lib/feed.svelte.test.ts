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

// #2190. The board refreshes in place and never reloads, which is what lets the
// korg pane survive — and what let a tab opened before a deploy go on executing
// the OLD client bundle against NEW data indefinitely. Measured on 2026-09-11:
// after sprint 020 deployed, Ken's board kept drawing the pre-020 layout while
// the server had been correct for two hours, and only a relaunch fixed it.
describe('BoardFeed taking a new bundle (#2190)', () => {
	type B = { build: string | null };

	/** A feed whose successive loads report the builds given. */
	function buildFeed(seed: string | null, served: Array<string | null>, delayMs?: number) {
		let i = 0;
		const reload = vi.fn();
		const f = new BoardFeed<B>(
			{ build: seed },
			async () => ({ build: served[Math.min(i++, served.length - 1)] }),
			() => 0,
			{ of: (p) => p.build, reload, delayMs }
		);
		return { f, reload };
	}

	it('reloads when the served build changes', async () => {
		const { f, reload } = buildFeed('0.5.0-aaaaaaa', ['0.5.0-bbbbbbb']);
		expect(f.servedBuild).toBe('0.5.0-aaaaaaa');
		expect(f.newBuild).toBeNull();

		await f.refresh();

		expect(f.newBuild).toBe('0.5.0-bbbbbbb');
		expect(reload).toHaveBeenCalledTimes(1);
	});

	// THE negative control, and the reason this is a gate rather than a
	// demonstration: the common case is many polls and no deploy, and a feed
	// that reloaded on those would be worse than the bug it replaces. The wall
	// polls every three minutes, all day, unattended.
	it('reloads never while the build holds, however many polls land', async () => {
		const { f, reload } = buildFeed('0.5.0-aaaaaaa', ['0.5.0-aaaaaaa']);
		for (let i = 0; i < 25; i++) await f.refresh();
		expect(f.newBuild).toBeNull();
		expect(reload).not.toHaveBeenCalled();
	});

	// Latched. A deploy is one event; the wall may poll again before the notice
	// has finished showing, and a second reload scheduled off the same deploy
	// would be a board that reloads twice for one reason.
	it('reloads exactly once, even as later polls report the same new build', async () => {
		const { f, reload } = buildFeed('0.5.0-aaaaaaa', ['0.5.0-bbbbbbb']);
		await f.refresh();
		await f.refresh();
		await f.refresh();
		expect(reload).toHaveBeenCalledTimes(1);
	});

	// "I cannot say which build this is" is not a deploy. `npm run dev` ships no
	// VERSION stamp, so both sides are null there — and a feed that read null as
	// a change would reload on its first poll, then on its first poll again, for
	// as long as the dev server ran. korg+ GP-13's consumer half, in kfdc's own
	// register: where the answer is absent, do nothing rather than substitute.
	it.each([
		['the page was served with no build', null, '0.5.0-bbbbbbb'],
		['the refresh reported no build', '0.5.0-aaaaaaa', null],
		['neither side has one (npm run dev)', null, null]
	])('reloads never when %s', async (_label, seed, next) => {
		const { f, reload } = buildFeed(seed, [next]);
		await f.refresh();
		await f.refresh();
		expect(f.newBuild).toBeNull();
		expect(reload).not.toHaveBeenCalled();
	});

	// A failed refresh is not a build change. `refresh()` swallows the error and
	// keeps the last good board, so nothing about which bundle is running has
	// been learned — and a korg outage must not reload the board it is keeping.
	it('reloads never on a refresh that failed', async () => {
		const reload = vi.fn();
		const f = new BoardFeed<B>(
			{ build: '0.5.0-aaaaaaa' },
			async () => {
				throw new Error('korg down');
			},
			() => 0,
			{ of: (p) => p.build, reload }
		);
		await f.refresh();
		expect(f.misses).toBe(1);
		expect(f.newBuild).toBeNull();
		expect(reload).not.toHaveBeenCalled();
	});

	// The desk waits so the notice can be read; the wall passes 0 and goes at
	// once. Both are the same detection with a different policy, which is why
	// the reload is injected rather than called from in here.
	it('holds the reload for the notice when a delay is given', async () => {
		vi.useFakeTimers();
		try {
			const { f, reload } = buildFeed('0.5.0-aaaaaaa', ['0.5.0-bbbbbbb'], 1_200);
			await f.refresh();
			// The board already says so, and has not jumped.
			expect(f.newBuild).toBe('0.5.0-bbbbbbb');
			expect(reload).not.toHaveBeenCalled();

			vi.advanceTimersByTime(1_199);
			expect(reload).not.toHaveBeenCalled();

			vi.advanceTimersByTime(1);
			expect(reload).toHaveBeenCalledTimes(1);
		} finally {
			vi.useRealTimers();
		}
	});

	// A feed built with no watch is the old feed exactly. The wall's refresh
	// survived three sprints without one and nothing that does not opt in should
	// acquire a reload path.
	it('does nothing at all without a watch', async () => {
		const f = new BoardFeed<B>({ build: '0.5.0-aaaaaaa' }, async () => ({
			build: '0.5.0-bbbbbbb'
		}));
		await f.refresh();
		expect(f.servedBuild).toBeNull();
		expect(f.newBuild).toBeNull();
	});
});
