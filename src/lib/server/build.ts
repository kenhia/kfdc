// Which kfdc the server is running (#2190). The board refreshes in place and
// never reloads, so without this a tab opened before a deploy goes on executing
// the OLD client bundle against NEW data indefinitely — and the wall, the one
// display nobody ever reloads, is the worst case.
//
// The value is the version label the package store published, `0.5.0-<sha>`,
// read from the `VERSION` file the bundle ships beside `build/`. Deliberately
// the same stamp knarr verifies on its own local copy before touching the host
// and confirms afterwards, rather than a second identifier minted here: a build
// id that could disagree with the deployed version would be worse than none.
//
// Read from the process's CWD, which the unit pins
// (`WorkingDirectory=%h/.local/share/kfdc/current`) and a deploy repoints by
// rename(2) before restarting. Verified against the live service on kubsdb
// rather than inferred: `/proc/<pid>/cwd` is the unpacked version directory and
// `./VERSION` is in it.
//
// Cached, because it cannot change without a restart — a deploy IS a restart,
// and a process that re-read this would be asking a question whose answer it
// already is.
import { readFileSync } from 'node:fs';

/** The bundle's version stamp, or null where there is no bundle. */
export const VERSION_FILE = 'VERSION';

/**
 * Read the stamp. Null rather than a throw or a placeholder for every way it
 * can be absent — and absent is the ORDINARY case in development, where the
 * repo has no `VERSION` file and the board is being served by `vite dev`.
 *
 * Null must never be treated as a build that differs from another: "I cannot
 * say which build this is" is not a deploy, and a reload triggered by it would
 * be an infinite loop on a dev server. That rule lives in `BoardFeed`, which is
 * the thing that compares; this function's whole job is to make the absence
 * honest and representable, the same instinct korg+ GP-13's consumer half
 * applies to korg's nullable figures.
 */
export function readBuildId(file: string = VERSION_FILE): string | null {
	try {
		const raw = readFileSync(file, 'utf8').trim();
		// An empty or whitespace-only stamp is a broken bundle, not a version.
		return raw === '' ? null : raw;
	} catch {
		// Missing (dev), unreadable, a directory — all the same answer.
		return null;
	}
}

let cached: string | null | undefined;

/** `readBuildId`, once per process. */
export function buildId(): string | null {
	if (cached === undefined) cached = readBuildId();
	return cached;
}
