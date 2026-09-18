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

/**
 * How a board takes a new bundle (#2190). Injected rather than reached for, for
 * two reasons: jsdom has no `location.reload` to call, and the desk and the wall
 * want different answers — so the policy belongs with the routes that differ and
 * the DETECTION belongs here, where every successful load already passes.
 */
export interface BuildWatch<T> {
	/** Which build served a payload, or null where the server cannot say. */
	of: (payload: T) => string | null;
	/** Take it. `location.reload()` in both routes; a spy in the tests. */
	reload: () => void;
	/**
	 * How long to leave the notice up first. The desk waits, because a board
	 * that vanished under Ken the moment he pressed ↻ would be a jump with no
	 * explanation; the wall passes 0, because the only reader there is the screen
	 * itself and every extra second is a second of stale code.
	 */
	delayMs?: number;
}

/**
 * The desk's pause between "board updated" and the reload. Long enough to read
 * six words, short enough that nobody wonders whether the board has hung. A
 * build change happens once per deploy, so this is not a cost anyone pays
 * twice.
 */
export const RELOAD_NOTICE_MS = 1_200;

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

	// The build that served the page this board is running. Captured from the
	// SEED — the payload the server rendered with — because that, and not the
	// latest fetch, is the bundle the browser is actually executing.
	readonly servedBuild: string | null;

	// The build a refresh found, once it differs from `servedBuild`. Null until
	// then, and LATCHED afterwards: the reload is scheduled exactly once however
	// many polls land in the meantime, and the board can say so while it waits.
	newBuild = $state<string | null>(null);

	private readonly load: () => Promise<T>;
	private readonly clock: () => number;
	private readonly watch: BuildWatch<T> | null;

	constructor(
		seed: T,
		load: () => Promise<T>,
		clock: () => number = Date.now,
		watch: BuildWatch<T> | null = null
	) {
		this.payload = seed;
		this.load = load;
		this.clock = clock;
		this.watch = watch;
		this.servedBuild = watch ? watch.of(seed) : null;
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
			this.checkBuild();
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

	// Did that load come from a different kfdc than the one this page is running
	// (#2190)? Since #1496 the board refreshes in place and never reloads, so a
	// tab opened before a deploy keeps executing the OLD client bundle against
	// NEW data indefinitely. Measured, not hypothetical: after sprint 020
	// deployed, Ken's board went on drawing the pre-020 layout while the server
	// was already correct, and only a relaunch fixed it.
	//
	// TWO NULLS ARE NOT A CHANGE, and this is the half worth being careful about.
	// `null` means "the server cannot say which build this is" — the ordinary
	// answer under `npm run dev`, which ships no VERSION stamp. Treating it as a
	// value would make every poll on a dev board a reload, which is a reload
	// loop and not a feature. So a change requires BOTH sides to be real and to
	// differ, which is korg+ GP-13's consumer half applied to kfdc's own field:
	// where the answer is "I cannot say", do nothing rather than substitute.
	private checkBuild(): void {
		const w = this.watch;
		// Latched — one deploy, one reload, however many polls land while the
		// notice is up.
		if (!w || this.newBuild !== null) return;
		const found = w.of(this.payload);
		if (this.servedBuild === null || found === null || found === this.servedBuild) return;
		this.newBuild = found;
		const delay = w.delayMs ?? 0;
		if (delay <= 0) w.reload();
		else setTimeout(() => w.reload(), delay);
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
