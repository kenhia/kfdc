// One Net Log store per server process. The directory lives OUTSIDE the
// build tree so the transcript and last digest survive redeploys: prod uses
// KFDC_STATE_DIR or ~/.local/state/kfdc; dev uses the repo's git-ignored
// .scratch so a dev server never pollutes the real transcript prod is
// writing on the same host.

import { homedir } from 'node:os';
import { join } from 'node:path';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { createNetLogStore, type NetLogStore } from './netlog-store';

let store: NetLogStore | null = null;

export function netlog(): NetLogStore {
	if (!store) {
		const dir = dev
			? join(process.cwd(), '.scratch/netlog')
			: (env.KFDC_STATE_DIR ?? join(homedir(), '.local/state/kfdc'));
		store = createNetLogStore(dir);
	}
	return store;
}
