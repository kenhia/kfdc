// What one board render needs, named once. Two routes (`/` and `/wall`) and
// the wall's refresh endpoint all produce it, and a wall that reassigns its
// whole state from a fetch has no compiler help at all unless the shape has a
// name the three of them share.
import type { Board } from './board';
import type { WorkItemFlowSeries } from './flow';
import type { NetLogLine } from './netlog';

export interface BoardPayload {
	board: Board;
	// Allowed to be null: korg may predate the flow endpoint, and one panel
	// losing its feed must never take down the board.
	flow: WorkItemFlowSeries | null;
	netlog: NetLogLine[];
	korgBase: string;
	// Which kfdc served this payload (#2190), as the published version label
	// `0.5.0-<sha>`. The board compares it to the one it was served with and
	// reloads when it changes, because refreshing in place means a tab opened
	// before a deploy otherwise runs the OLD bundle against NEW data forever.
	//
	// Null where the server cannot say — `npm run dev` has no VERSION stamp. The
	// comparison treats null as "no answer" and never as a change, so a dev board
	// does not reload on every poll. See `$lib/server/build.ts`.
	build: string | null;
}

/**
 * How long a refresh may hang before it counts as a failure. `fetch` has no
 * default timeout, and a socket that never answers is the worst of the failure
 * modes rather than the mildest: on the wall it leaves `misses` at zero forever,
 * so the board goes stale with NO staleness marker — precisely the silence wall
 * mode exists to prevent — and on the desk it strands `busy`, which would leave
 * the ↻ dim and Ctrl+R swallowed with nothing left to un-stick them.
 *
 * Far longer than any healthy response (the board rollup is one korg query) and
 * far shorter than the 3-minute poll, so a hung refresh always resolves into a
 * visible `NO REFRESH` before the next one is due.
 */
export const REFRESH_TIMEOUT_MS = 30_000;

/**
 * One client-side fetch of a whole board render. Both routes refresh through
 * here, so exactly one place knows what the endpoint is called — the same
 * instinct as `korglink.nodeHref` (GP-16), applied to kfdc's own surface.
 * Rejects rather than returning null: `BoardFeed` is the thing that decides
 * what a failure means, and it decides the same thing for both routes.
 */
export async function fetchPayload(timeoutMs = REFRESH_TIMEOUT_MS): Promise<BoardPayload> {
	// The argument exists so a test can prove the abort actually becomes a
	// rejection: `AbortSignal.timeout` runs on a platform timer that vitest's fake
	// clock does not drive, so the only honest test of it is a real short one.
	const res = await fetch('/api/page', { signal: AbortSignal.timeout(timeoutMs) });
	if (!res.ok) throw new Error(`GET /api/page: ${res.status}`);
	return (await res.json()) as BoardPayload;
}
