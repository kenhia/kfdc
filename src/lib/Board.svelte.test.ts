// Rules rather than features, and all of them share one shape: `Board.svelte`
// renders BOTH routes, so the desk/wall split is only ever true or false here.
//
// - the settings gear is a workstation control and the wall is not a
//   workstation (#1489, docs/design.md § Wall mode — *the wall draws no
//   affordance it cannot honour*);
// - so is the ↻, and so are the refresh hotkeys (#1496);
// - and the pane the desk restores from sessionStorage must never appear on an
//   unattended screen that has no way to close it.
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Board from './Board.svelte';
import type { Board as BoardData, ProposalRow } from './board';
import { PANE_STORAGE_KEY } from './pane.svelte';
import { STORAGE_KEY as SETTINGS_KEY } from './settings.svelte';

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

function render(wall: boolean, extra: Record<string, unknown> = {}) {
	const target = document.body.appendChild(document.createElement('div'));
	const app = mount(Board, {
		target,
		props: { board, flow: null, netlog: [], korgBase: 'https://korg.example', wall, ...extra }
	});
	// The pane restores in an `$effect`, which is scheduled rather than run
	// inline — see PaneState.restore() for why it cannot be done in the
	// constructor.
	flushSync();
	return {
		target,
		app,
		gear: () => target.querySelector('button[aria-label="board settings"]'),
		refreshBtn: () =>
			target.querySelector('button[aria-label="refresh the board"]') as HTMLButtonElement | null,
		pane: () => target.querySelector('aside.korg-pane')
	};
}

/** A keystroke as the window sees it; returns whether the board claimed it. */
function key(init: KeyboardEventInit): boolean {
	const e = new KeyboardEvent('keydown', { ...init, cancelable: true, bubbles: true });
	window.dispatchEvent(e);
	return e.defaultPrevented;
}

afterEach(() => {
	document.body.replaceChildren();
	// The desk board writes preferences to a real localStorage in jsdom, and the
	// open pane node to a real sessionStorage; leaving either behind would let one
	// test's state open a pane in the next.
	localStorage.clear();
	sessionStorage.clear();
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

	// The ↻ arrives with a refresh to call and not otherwise — one prop drives
	// both the control and the hotkeys, so they cannot disagree about whether
	// refreshing is possible on this route.
	it('offers the ↻ when there is a refresh to run', () => {
		const v = render(false, { refresh: () => {} });
		expect(v.refreshBtn()).not.toBeNull();
		expect(v.refreshBtn()!.title).toBe('refresh (Ctrl+R)');
		unmount(v.app);
	});

	it('draws no ↻ on the wall, which refreshes on its own timer', () => {
		const v = render(true);
		expect(v.refreshBtn()).toBeNull();
		unmount(v.app);
	});
});

// #1540. The wall has no gear (above), so "include parked" needs a FIXED answer
// there rather than a setting — and the answer is suppress, because the wall is
// an at-a-glance display of what is in motion and parked is the definition of
// what is not.
//
// The wall is protected twice over and that is deliberate: it is handed no
// localStorage to read (sprint 017, so a desk preference cannot follow the
// board onto an unattended screen), and `Board.svelte` writes the rule again as
// `!wall &&` at the point of use. Either alone would hold. These tests pin the
// OUTCOME the pair exists to produce, which is the claim that actually matters
// and the only one that stays true if the plumbing is rearranged.
describe('parked rows (#1540)', () => {
	const PARKED_TITLE = 'a row korg says is dormant';
	const parked: ProposalRow = {
		node_id: 1478,
		title: PARKED_TITLE,
		summary: 'deferred with no end date',
		project: 'agent-projects',
		status: 'parked',
		rank: '9',
		pinned: false,
		comment_count: 0,
		covered_count: 2,
		open: 2,
		resolved: 0,
		done: 0,
		closed: 0,
		updated: '2026-08-20T09:00:00Z',
		synopsis: null
	};
	const withParked: BoardData = { ...board, queue: [parked] };
	const shows = (t: HTMLElement) => t.textContent!.includes(PARKED_TITLE);

	it('hides parked on the desk when nothing is stored, which is the default', () => {
		const v = render(false, { board: withParked });
		expect(shows(v.target)).toBe(false);
		unmount(v.app);
	});

	it('shows parked on the desk once the setting is on', () => {
		localStorage.setItem(SETTINGS_KEY, JSON.stringify({ includeParked: true }));
		const v = render(false, { board: withParked });
		expect(shows(v.target)).toBe(true);
		unmount(v.app);
	});

	// The gate. A preference set at the desk must not be able to put dormant work
	// on a screen with no control to take it back off.
	it('hides parked on the wall even with the setting stored on', () => {
		localStorage.setItem(SETTINGS_KEY, JSON.stringify({ includeParked: true }));
		const v = render(true, { board: withParked });
		expect(shows(v.target)).toBe(false);
		unmount(v.app);
	});

	// The board's first rule (docs/design.md): a panel that hides rows names what
	// it hid. Suppressing parked is the largest hiding kfdc does, so the receipt
	// is not optional — and it names the CAUSE, because unlike korg's omitted
	// counts this one is undone by a checkbox the reader has.
	it('names the parked rows it hid, and says a setting did it', () => {
		const v = render(false, { board: withParked });
		expect(v.target.textContent).toMatch(/1 parked, hidden by a board setting/);
		unmount(v.app);
	});

	it('says nothing about hiding when the rows are being drawn', () => {
		localStorage.setItem(SETTINGS_KEY, JSON.stringify({ includeParked: true }));
		const v = render(false, { board: withParked });
		expect(v.target.textContent).not.toMatch(/hidden by a board setting/);
		unmount(v.app);
	});

	// The statline is printed above the panel it counts (D-3), so it has to move
	// with it or the masthead contradicts the board underneath.
	it('leaves the parked row out of the live count it is printed beside', () => {
		const v = render(false, { board: withParked });
		expect(v.target.querySelector('.statline')!.textContent).toMatch(/0\s*live proposals/);
		unmount(v.app);
	});
});

describe('Board refresh (#1496)', () => {
	it('refreshes in place on the ↻', () => {
		const refresh = vi.fn();
		const v = render(false, { refresh });
		v.refreshBtn()!.click();
		expect(refresh).toHaveBeenCalledTimes(1);
		unmount(v.app);
	});

	// Both are interceptable in Chromium, unlike Ctrl+T/N/W. Claiming them is
	// what makes the reflex Ken already has stop destroying the korg pane.
	it.each([
		['Ctrl+R', { key: 'r', ctrlKey: true }],
		['F5', { key: 'F5' }]
	])('claims %s for the in-app refresh', (_label, init) => {
		const refresh = vi.fn();
		const v = render(false, { refresh });
		expect(key(init)).toBe(true);
		expect(refresh).toHaveBeenCalledTimes(1);
		unmount(v.app);
	});

	// A real hard reload has to stay one keystroke away — for when the APP is
	// what needs re-fetching, not korg. If this ever starts being claimed, the
	// only way out of a bad deploy becomes the address bar.
	it.each([
		['Ctrl+Shift+R', { key: 'R', ctrlKey: true, shiftKey: true }],
		['Shift+F5', { key: 'F5', shiftKey: true }],
		['Ctrl+F5', { key: 'F5', ctrlKey: true }]
	])('leaves %s to the browser', (_label, init) => {
		const refresh = vi.fn();
		const v = render(false, { refresh });
		expect(key(init)).toBe(false);
		expect(refresh).not.toHaveBeenCalled();
		unmount(v.app);
	});

	// The wall arms nothing: nobody is at its keyboard, and a wall that swallowed
	// Ctrl+R would take away the one recovery an operator standing at it has.
	it.each([
		['Ctrl+R', { key: 'r', ctrlKey: true }],
		['F5', { key: 'F5' }]
	])('leaves %s alone on the wall', (_label, init) => {
		const v = render(true);
		expect(key(init)).toBe(false);
		unmount(v.app);
	});

	// A slow korg looks slow rather than dead, and cannot be made to stack
	// fetches by an impatient second press.
	it('will not stack a second fetch while one is in flight', () => {
		const refresh = vi.fn();
		const v = render(false, { refresh, busy: true });
		expect(v.refreshBtn()!.getAttribute('aria-busy')).toBe('true');
		v.refreshBtn()!.click();
		expect(key({ key: 'r', ctrlKey: true })).toBe(true);
		expect(refresh).not.toHaveBeenCalled();
		unmount(v.app);
	});
});

// The floor under the reloads no page can intercept: the app window's own
// refresh control, and Ctrl+R while focus is inside korg's cross-origin frame.
describe('Board pane restore (#1496)', () => {
	it('reopens the pane the tab had open', () => {
		sessionStorage.setItem(PANE_STORAGE_KEY, JSON.stringify({ node: 1203 }));
		const v = render(false);
		expect(v.pane()).not.toBeNull();
		expect(v.target.querySelector('.pane-id')!.textContent).toBe('korg:1203');
		unmount(v.app);
	});

	it('opens nothing when the tab had nothing open', () => {
		const v = render(false);
		expect(v.pane()).toBeNull();
		unmount(v.app);
	});

	// Same rule as the gear, and it matters more here: a pane on an unattended
	// screen is an affordance with no ✕ anybody can press.
	it('never reopens a pane on the wall', () => {
		sessionStorage.setItem(PANE_STORAGE_KEY, JSON.stringify({ node: 1203 }));
		const v = render(true);
		expect(v.pane()).toBeNull();
		unmount(v.app);
	});
});
