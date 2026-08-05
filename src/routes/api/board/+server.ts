import { json } from '@sveltejs/kit';
import { fetchBoard } from '$lib/server/korg';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ fetch }) => json(await fetchBoard(fetch));
