// The wall's refresh loop (#1204), kept out of the route component so the one
// behaviour that matters on an unattended screen can actually be tested: what
// happens when the refresh FAILS.
//
// The rule is that a failed refresh must not blank the board. `/` renders No
// Comms when korg is unreachable, and that is right for a cold load — there is
// nothing to render. The wall is the other case: it already has a board, and
// the last thing korg actually said is strictly more information than an error
// page. So it keeps it, and says out loud that it has stopped being able to
// ask (`stale`). Silence would be the failure mode this whole sprint is about
// — wrong information on a screen nobody is standing at.

export class WallFeed<T> {
	// The board on screen. Replaced only by a load that succeeded.
	payload: T = $state() as T;

	// Consecutive failed loads. Zero means the wall is current.
	misses = $state(0);

	// Client-clock stamps, and the only client clock on this board. Every AGE
	// kfdc prints is measured against korg's `generated` — that rule is about
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

	// Null while the wall is current; otherwise how old the board on screen is,
	// measured from the last load that worked — not from the first failure,
	// because what a passer-by needs to know is the age of what they are
	// reading, not how long the outage has run.
	get stale(): string | null {
		return this.misses === 0 ? null : `${Math.floor((this.now - this.lastOk) / 60_000)}m`;
	}

	async refresh(): Promise<void> {
		try {
			this.payload = await this.load();
			this.lastOk = this.clock();
			this.misses = 0;
		} catch (e) {
			// Deliberately swallowed. Rethrowing here would take the page to the
			// error boundary, which is the one outcome an unattended wall cannot
			// recover from: nothing would be left running to try again.
			console.error('wall: refresh failed', e);
			this.misses += 1;
		}
		this.now = this.clock();
	}

	// Returns the stop function, for an effect teardown.
	start(intervalMs: number): () => void {
		this.lastOk = this.now = this.clock();
		const id = setInterval(() => void this.refresh(), intervalMs);
		return () => clearInterval(id);
	}
}
