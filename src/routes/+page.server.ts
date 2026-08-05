import { fetchBoard } from '$lib/server/korg';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => ({ board: await fetchBoard(fetch) });
