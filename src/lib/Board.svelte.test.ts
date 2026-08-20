// One thing, and it is a rule rather than a feature: the settings gear is a
// workstation control and the wall is not a workstation (#1489, docs/design.md
// § Wall mode — *the wall draws no affordance it cannot honour*). One
// `Board.svelte` renders both routes, so the only place that can be true or
// false is here.
import { mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Board from './Board.svelte';
import type { Board as BoardData } from './board';

// An empty korg. Every panel renders its own nothing-here state, which is all
// this test needs — the claim is about the masthead, not the board.
const board: BoardData = {
	generated: '2026-08-20T12:00:00Z',
	active: [],
	queue: [],
	proposals_omitted: { done: 0, declined: 0, archived: 0 },
	proposal_edges: [],
	blocked: [],
	programs: [],
	programs_omitted: { done: 0, archived: 0 },
	awaiting: [],
	depth: [],
	reports: [],
	events: []
};

function render(wall: boolean) {
	const target = document.body.appendChild(document.createElement('div'));
	const app = mount(Board, {
		target,
		props: { board, flow: null, netlog: [], korgBase: 'https://korg.example', wall }
	});
	return { target, app, gear: () => target.querySelector('button.mast-btn') };
}

afterEach(() => {
	document.body.replaceChildren();
	// The desk board writes preferences to a real localStorage in jsdom; leaving
	// one behind would let a stored width leak into the next test file.
	localStorage.clear();
});

describe('Board masthead', () => {
	it('offers the settings gear on the desk board', () => {
		const v = render(false);
		expect(v.gear()).not.toBeNull();
		expect(v.gear()!.getAttribute('aria-label')).toBe('board settings');
		unmount(v.app);
	});

	it('draws no settings gear on the wall', () => {
		const v = render(true);
		expect(v.gear()).toBeNull();
		unmount(v.app);
	});
});
