// The board's refresh loop, kept out of the route components so the one
// behaviour that matters can actually be tested: what happens when the refresh
// FAILS.
//
// The rule is that a failed refresh must not blank the board. A cold load with
// no korg renders No Comms, and that is right — there is nothing to render.
// A board already on screen is the other case: the last thing korg actually
// said is strictly more information than an error page. So it keeps it, and
// says out loud that it has stopped being able to ask (`stale`).
//
// Learned on the wall (#1204, sprint 014), where silence was the failure mode —
// wrong information on a screen nobody is standing at. It serves the desk for
// the same reason since #1496 (sprint 018): once the desk board refreshes in
// place instead of reloading, it too can be a board that has stopped being able
// to ask, and the answer is the same one. That is why this is `BoardFeed` in
// `feed.svelte.ts` rather than the `WallFeed` it shipped as — a name that says
// "wall" on the desk board's only data path is a name that has stopped being
// true.

export class BoardFeed<T> {
	// The board on screen. Replaced only by a load that succeeded.
	payload: T = $state() as T;

	// Consecutive failed loads. Zero means the board is current.
	misses = $state(0);

	// A load is in flight. The wall never reads this — nobody is there to see it
	// — but the desk's ↻ does, so a slow korg looks like a slow korg rather than
	// a dead button (#1496).
	busy = $state(false);

	// Client-clock stamps, and the only client clock on this board. Every AGE
	// kfdc prints is measured against korg's `generated`. That rule is about
	// korg's data and it is untouched here. This measures something no korg
	// timestamp can: how long THIS browser has been unable to fetch one.
	private lastOk = $state(0);
	private now = $state(0);

	private readonly load: () => Promise<T>;
	private readonly clock: () => number;

	constructor(seed: T, load: () => Promise<T>, clock: () => number = Date.now) {
		this.payload = seed;
		this.load = load;
		this.clock = clock;
		this.lastOk = this.now = clock();
	}

	// Null while the board is current; otherwise how old the board on screen is,
	// measured from the last load that worked — not from the first failure,
	// because what a reader needs to know is the age of what they are reading,
	// not how long the outage has run.
	get stale(): string | null {
		return this.misses === 0 ? null : `${Math.floor((this.now - this.lastOk) / 60_000)}m`;
	}

	async refresh(): Promise<void> {
		this.busy = true;
		try {
			this.payload = await this.load();
			this.lastOk = this.clock();
			this.misses = 0;
		} catch (e) {
			// Deliberately swallowed. Rethrowing here would take the page to the
			// error boundary, which is the one outcome an unattended wall cannot
			// recover from: nothing would be left running to try again. On the desk
			// it would be merely rude — a korg blip replacing a board Ken was
			// reading — which is the same answer for a weaker reason.
			console.error('board: refresh failed', e);
			this.misses += 1;
		} finally {
			this.busy = false;
		}
		this.now = this.clock();
	}

	// Returns the stop function, for an effect teardown. The wall's cadence; the
	// desk does not call this — it refreshes when Ken asks, because a board that
	// re-sorted itself under his cursor while he was reading a row would be the
	// desk's version of the wall's silence problem.
	start(intervalMs: number): () => void {
		this.lastOk = this.now = this.clock();
		const id = setInterval(() => void this.refresh(), intervalMs);
		return () => clearInterval(id);
	}
}
