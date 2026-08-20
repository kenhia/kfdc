import { describe, expect, it } from 'vitest';
import { nodeHref } from './korglink';
import * as korglink from './korglink';

describe('nodeHref', () => {
	const base = 'https://korg.example';

	// The whole point of GP-16: kfdc asks korg to resolve the kind, because for
	// several kinds kfdc genuinely cannot. Every node id gets the same URL shape.
	it('addresses every node the same way, whatever kind it is', () => {
		expect(nodeHref(base, 1203)).toBe('https://korg.example/n/1203');
		// A work item — node_id and wi_number are the same number since korg
		// migration 0009, so there is no second spelling to get wrong.
		expect(nodeHref(base, 744)).toBe('https://korg.example/n/744');
		// A program, a report, a comment's owner: identical treatment.
		expect(nodeHref(base, 979)).toBe('https://korg.example/n/979');
	});

	// The negative test this module exists for. GP-16 names a consumer-side
	// kind → path map as the forbidden third answer, and `lineHref` — which
	// stood here until sprint 016 — was one. It also shipped `/work-items?wi=N`,
	// a URL korg never served. A map cannot come back by accident: it would have
	// to arrive as a `kind` parameter, and there is nowhere to put one.
	it('takes no kind, and exports nothing that could hold a kind → path map', () => {
		expect(nodeHref.length).toBe(2);
		expect(Object.keys(korglink)).toEqual(['nodeHref']);
	});
});
