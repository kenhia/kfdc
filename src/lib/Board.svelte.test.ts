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
import type { Board as BoardData, InFlightSchedule, ProposalRow } from './board';
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
	events: [],
	in_flight_schedules: []
};

function render(wall: boolean, extra: Record<string, unknown> = {}) {
	const target = document.body.appendChild(document.createElement('div'));
	const app = mount(Board, {
		target,
		props: {
			board,
			flow: null,
			netlog: [],
			korgBase: 'https://korg.example',
			// Required-but-nullable, and the compiler is what keeps it that way
			// (#2190): adding the field to BoardPayload failed this fixture until
			// it was named, which is the shape a payload field should have.
			build: '0.5.0-abc1234',
			wall,
			...extra
		}
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

// #1645. Standing Orders is where the board draws work korg's parked filter
// must NOT be allowed to reach, and that is a different claim from the panel
// existing — it is the one the next person rearranging `withoutParked` could
// break without touching this panel at all.
describe('in-flight scheduled work (#1645)', () => {
	const PARKED_DRILL = 'a drill somebody set aside mid-flight';
	const inFlight: InFlightSchedule = {
		node_id: 1112,
		title: 'a standing order — {DATE}',
		project: 'krot',
		wi_number: 1635,
		wi_title: PARKED_DRILL,
		wi_status: 'parked',
		materialized_at: '2026-08-20T09:00:00Z'
	};
	const withDrill: BoardData = { ...board, in_flight_schedules: [inFlight] };
	const shows = (t: HTMLElement) => t.textContent!.includes(PARKED_DRILL);

	it('draws the panel on the desk', () => {
		const v = render(false);
		expect(v.target.textContent).toMatch(/Standing Orders/);
		unmount(v.app);
	});

	// Wall mode is a display MODE, not a second layout: a panel differs there
	// only where an affordance does, and this one has none.
	it('draws the panel on the wall too', () => {
		const v = render(true);
		expect(v.target.textContent).toMatch(/Standing Orders/);
		unmount(v.app);
	});

	// THE CLAIM THAT MATTERS. korg's in-flight predicate reads
	// WI_UNFINISHED_STATUSES expressly so a parked materialized item stays in
	// the block — dropping it would re-hide exactly the item somebody
	// deliberately set aside, which is korg #1644's own bug. Suppressing it on
	// this side would re-create that bug behind a checkbox.
	it('draws a parked in-flight item with the desk setting off', () => {
		const v = render(false, { board: withDrill });
		expect(shows(v.target)).toBe(true);
		unmount(v.app);
	});

	// And on the wall, which suppresses parked PROPOSALS unconditionally. The
	// two are different facts wearing one word, and this is the test that says
	// so out loud.
	it('draws it on the wall, which suppresses parked proposals unconditionally', () => {
		const v = render(true, { board: withDrill });
		expect(shows(v.target)).toBe(true);
		unmount(v.app);
	});

	it('says the empty case rather than drawing an empty panel', () => {
		const v = render(false);
		expect(v.target.textContent).toMatch(/no scheduled work in flight/);
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

// ---------------------------------------------------------------------------
// Sprint 020's two routings, asserted at the level where they actually happen:
// Board.svelte is the one place that decides what each panel is handed.
// ---------------------------------------------------------------------------
const soakingProgram = {
	node_id: 2070,
	title: 'kmon fleet collection',
	aim: 'collect every host nightly',
	status: 'soaking',
	span: ['kmon'],
	slice_count: 1,
	slices: [
		{
			node_id: 2071,
			title: 'a finished slice',
			project: 'kmon',
			status: 'done',
			rank: '0',
			open: 0,
			resolved: 0,
			done: 1,
			closed: 0,
			covered_count: 1
		}
	],
	soaks: [
		{
			node_id: 2062,
			wi_number: 2062,
			title: 'three consecutive nightlies',
			project: 'kmon',
			wi_status: 'open',
			check_after: '2026-09-13',
			invalidated_if: 'the baseline is regenerated',
			rank: '0'
		}
	]
};

const reviewedReport = {
	node_id: 2098,
	source: 'kmon',
	model: 'm',
	status: 'ok',
	escalated: false,
	summary: 'all eight hosts collected',
	report_date: '2026-08-20',
	comment_count: 0,
	reviewed: true,
	updated: '2026-08-20T00:00:00Z'
};

function panelText(target: HTMLElement, heading: string): string {
	const h = [...target.querySelectorAll('h2')].find((n) => n.textContent === heading)!;
	return h.closest('section')!.textContent!.replace(/\s+/g, ' ');
}

describe('Board routes soaking programs off Operations (#2155)', () => {
	// The whole slice, in one assertion: Operations means "wants your attention",
	// and this program does not want any until the clock runs out.
	it('draws a soaking program in Delayed Ops and not in Operations', () => {
		const v = render(false, { board: { ...board, programs: [soakingProgram] } });
		expect(panelText(v.target, 'Delayed Ops')).toContain('kmon fleet collection');
		expect(panelText(v.target, 'Operations')).not.toContain('kmon fleet collection');
		unmount(v.app);
	});

	// Nothing disappears silently — and this one MOVED, so the foot says where to
	// rather than that it was hidden.
	it('has Operations name where they went', () => {
		const v = render(false, { board: { ...board, programs: [soakingProgram] } });
		expect(panelText(v.target, 'Operations')).toContain('1 soaking, in Delayed Ops');
		unmount(v.app);
	});

	// The wall is not a display preference — it is the same routing. A panel that
	// only existed on the desk would leave the wall showing the demand the whole
	// sprint exists to remove.
	it('routes the same way on the wall', () => {
		const v = render(true, { board: { ...board, programs: [soakingProgram] } });
		expect(panelText(v.target, 'Delayed Ops')).toContain('kmon fleet collection');
		expect(panelText(v.target, 'Operations')).not.toContain('kmon fleet collection');
		unmount(v.app);
	});

	it('says so, in the FDC register, when nothing is soaking', () => {
		const v = render(false);
		expect(panelText(v.target, 'Delayed Ops')).toContain('no missions in soak');
		unmount(v.app);
	});
});

describe('Board and reviewed reports (#2156)', () => {
	const withReport = { board: { ...board, reports: [reviewedReport] } };

	it('draws reviewed reports by default, marked', () => {
		const v = render(false, withReport);
		expect(panelText(v.target, 'Sensor Net')).toContain('all eight hosts collected');
		expect(v.target.querySelector('.rev')).not.toBeNull();
		unmount(v.app);
	});

	it('hides them when the reader unticks the setting, and says how many', () => {
		localStorage.setItem(SETTINGS_KEY, JSON.stringify({ includeReviewed: false }));
		const v = render(false, withReport);
		const net = panelText(v.target, 'Sensor Net');
		expect(net).not.toContain('all eight hosts collected');
		expect(net).toContain('1 reviewed, hidden by a board setting');
		unmount(v.app);
	});

	// The wall's fixed answer, and it is the OPPOSITE of its parked one. A
	// reviewed report is still the latest word from that sensor, and a wall that
	// dropped it could show a sensor as silent on a morning it had reported.
	//
	// WHAT THIS TEST CAN AND CANNOT PIN, measured rather than assumed. Two
	// mechanisms enforce the rule: `settings` is built with no storage on the
	// wall, AND `showReviewed` is written as a literal. They agree, so deleting
	// EITHER one alone leaves this test green — a negative run confirmed it.
	// Deleting the literal once the storage guard is gone fails it, which is
	// exactly the scenario the literal was written for and the reason it is not
	// redundant. The pre-existing parked literal measures identically; this is
	// defence in depth, and the note is here so a later reader does not read a
	// passing test as proof that one line alone is doing the work.
	it('always draws them on the wall, whatever the desk stored', () => {
		localStorage.setItem(SETTINGS_KEY, JSON.stringify({ includeReviewed: false }));
		const v = render(true, withReport);
		expect(panelText(v.target, 'Sensor Net')).toContain('all eight hosts collected');
		unmount(v.app);
	});
});

describe('Rate of Fire leads its column (#1841)', () => {
	// The one layout claim jsdom CAN hold honestly. It cannot measure heights or
	// see the overflow Ken photographed — those took a headless browser in
	// `.scratch/` (#1284, #1460) — but document order inside a column is plain
	// DOM, and document order is the whole of the fix. So this is a real gate on
	// the thing that would silently drift back, and not a layout test pretending
	// jsdom can see layout.
	const headings = (target: HTMLElement) =>
		[...target.querySelectorAll('.board .col')]
			.map((col) => [...col.querySelectorAll('h2')].map((h) => h.textContent))
			.find((hs) => hs.includes('Rate of Fire'))!;

	it('puts Rate of Fire above Commander’s Call and Sensor Net', () => {
		const v = render(false);
		const hs = headings(v.target);
		expect(hs[0]).toBe('Rate of Fire');
		expect(hs.indexOf('Rate of Fire')).toBeLessThan(hs.indexOf("Commander's Call"));
		expect(hs.indexOf('Rate of Fire')).toBeLessThan(hs.indexOf('Sensor Net'));
		unmount(v.app);
	});

	// Wall mode is a display MODE, not a second layout — so the order is not a
	// desk preference either. A board whose columns read differently on the wall
	// is the thing `Board.svelte` exists to make impossible.
	it('reads the same on the wall', () => {
		const v = render(true);
		expect(headings(v.target)[0]).toBe('Rate of Fire');
		unmount(v.app);
	});
});

describe('Board says so before it reloads for a new bundle (#2190)', () => {
	const notice = (target: HTMLElement) => target.querySelector('.statline .updated');

	// The board reloads for exactly one reason, and a reader is owed it. Without
	// the notice the screen blanks and comes back under Ken's cursor with no
	// explanation, which is indistinguishable from a crash — so this is the same
	// rule as `NO REFRESH` beside `asOf`: never change what the board is claiming
	// without saying that you did.
	it('draws the notice while a reload is pending', () => {
		const v = render(false, { updated: true });
		expect(notice(v.target)!.textContent).toMatch(/board updated/i);
		expect(notice(v.target)!.textContent).toMatch(/reloading/i);
		unmount(v.app);
	});

	// The ordinary state, which is the one that lasts all day.
	it('draws nothing at all the rest of the time', () => {
		const v = render(false);
		expect(notice(v.target)).toBeNull();
		unmount(v.app);
	});

	// Not a fault, so not red. `NO REFRESH` means the board could not ask and the
	// reader may need to act; this means the board asked, got a NEWER kfdc than
	// the one drawing the pixel, and has already scheduled the fix. Amber is the
	// board's in-motion hue and that is what this is.
	it('is not dressed as a fault', () => {
		const v = render(false, { updated: true });
		expect(notice(v.target)!.classList.contains('stale')).toBe(false);
		unmount(v.app);
	});
});
