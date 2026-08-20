// The expanded-mode pane's state (#1203, slice 2 of program korg:1471).
//
// The pane hosts REAL korg in an iframe beside the board. That is the whole
// architectural point and it is GP-1 at its sharpest: the board renders the
// rollup and DELEGATES the node. kfdc never grows notes, comments, an edit
// form or a clear-awaiting button, because the thing that owns those is sitting
// next to it. Any future "just a small edit here" is a change to that contract,
// not a feature.
//
// v1 control is one-way — kfdc sets the iframe's src and nothing comes back.
// No `postMessage`, no handshake, no state sync (GP-17, and #1203's own 2026-08-05
// decision). A channel between the two would be the first step toward a second
// korg UI, which is the thing this design exists to avoid.
//
// Lives in a `.svelte.ts` module rather than inside Board.svelte so the state
// machine can be tested without a DOM — same reason as feed.svelte.ts.
import { getContext, setContext } from 'svelte';
import { nodeHref } from './korglink';
import type { StorageLike } from './settings.svelte';

/** One key, holding an object — same shape rule as `kfdc.settings.v1`: a second
 *  pane preference is an added field, not a format migration. */
export const PANE_STORAGE_KEY = 'kfdc.pane.v1';

// sessionStorage, not localStorage, and the difference is the point (#1496).
// It is per-tab and dies with the window, so the board restores a pane Ken had
// open a moment ago and never resurrects one in a window opened days later.
// Open-on-cold-launch was explicitly not asked for; if it is ever wanted, it is
// a one-word change here, which is why it is not worth deciding now.
//
// This does not breach GP-1's no-side-store rule, and the 2026-08-20 note on
// GP-1 is the test: *would korg changing make the stored value wrong?* What is
// stored is which surface the reader last had open — display chrome, named in
// that note as the consumer's — and not one field of the node itself. The pane
// fetches live korg either way; a node that has since been archived simply
// renders korg's own answer for it.
//
// Anything at all can be in a web store: a hand-edited value, a half-written
// entry, a format from a kfdc two sprints from now. Every failure opens nothing,
// because the alternative is a board that throws on load for the only person who
// has one (same rule as settings.svelte.ts).
function readNode(storage: StorageLike | null): number | null {
	if (!storage) return null;
	try {
		const raw = storage.getItem(PANE_STORAGE_KEY);
		if (raw === null) return null;
		const parsed: unknown = JSON.parse(raw);
		if (typeof parsed !== 'object' || parsed === null) return null;
		const v = (parsed as Record<string, unknown>).node;
		// korg node ids are positive integers. A float, a zero or a negative is
		// not a stale reference, it is a corrupt one — and `/n/1203.5` is a URL
		// korg never served, which is the class of bug GP-16 exists to prevent.
		if (typeof v !== 'number' || !Number.isInteger(v) || v <= 0) return null;
		return v;
	} catch {
		// Covers both a corrupt payload and a browser that throws on the property
		// access itself (private modes do).
		return null;
	}
}

export class PaneState {
	// korg's origin, exactly as the board's server read korg on. Deployment
	// constant (it comes from KORG_URL in the service env), so it is captured
	// once at construction and never re-synced from props — a board that had to
	// track a changing korg origin would have already lost its data feed.
	readonly base: string;

	// Whether there is a pane to open at all. False on the wall: nobody is at
	// the keyboard, so refs there stay plain links and never pretend to be
	// buttons. `show` is a no-op rather than a throw, so a panel shared by both
	// routes needs no `wall` prop to behave correctly (docs/design.md § Wall mode
	// — the wall draws no affordance it cannot honour).
	readonly enabled: boolean;

	// The node on show; null exactly when the pane is closed.
	node = $state<number | null>(null);

	// Where the open node survives a reload the page could not intercept, or null
	// wherever there is nothing to survive into: the server, and the wall.
	private readonly storage: StorageLike | null;

	constructor(base: string, enabled = true, storage: StorageLike | null = null) {
		this.base = base;
		this.enabled = enabled;
		this.storage = enabled ? storage : null;
	}

	get open(): boolean {
		return this.enabled && this.node !== null;
	}

	// The URL currently in the pane, or null when it is closed.
	get href(): string | null {
		return this.node === null ? null : nodeHref(this.base, this.node);
	}

	// Every korg URL the board prints comes through here, so there is exactly one
	// place that knows what a korg link looks like (GP-16).
	link(nodeId: number): string {
		return nodeHref(this.base, nodeId);
	}

	show(nodeId: number): void {
		if (!this.enabled) return;
		this.node = nodeId;
		this.persist();
	}

	close(): void {
		this.node = null;
		this.persist();
	}

	// Reopen whatever this tab had open, if anything. Called from an EFFECT in
	// Board.svelte rather than from the constructor, and that is not a style
	// choice: the server renders the pane closed — it cannot see this browser's
	// sessionStorage — so a constructor that opened it would make the `{#if}`
	// block differ between the SSR'd HTML and the first client render, which is a
	// hydration mismatch. An effect runs after hydration has finished.
	//
	// What comes back is the node KFDC set, never wherever Ken navigated to
	// inside korg: that location is cross-origin and unknowable here, and
	// `postMessage` — the one thing that could cross — is forbidden by GP-17.
	// It stays a gap. The in-app refresh is what has full fidelity; this is the
	// floor under the reloads no page can intercept (the app window's own refresh
	// control, and Ctrl+R while focus is inside the frame).
	restore(): void {
		const node = readNode(this.storage);
		if (node !== null) this.node = node;
	}

	private persist(): void {
		try {
			if (this.node === null) this.storage?.removeItem(PANE_STORAGE_KEY);
			else this.storage?.setItem(PANE_STORAGE_KEY, JSON.stringify({ node: this.node }));
		} catch {
			// A full or unavailable store costs this reader a restore, never the
			// board. The pane they just opened is already open.
		}
	}
}

const PANE = Symbol('kfdc.pane');

// Board.svelte publishes one pane; every ref on the page finds it through
// context rather than eight panels each taking a `korgBase` prop they only pass
// along. Two already did, which is the shape that says this belongs in context.
export function providePane(state: PaneState): PaneState {
	setContext(PANE, state);
	return state;
}

export function usePane(): PaneState {
	const state = getContext<PaneState | undefined>(PANE);
	// Loud rather than lenient: a missing pane means a missing korg origin, and
	// the lenient version of this renders `undefined/n/1203` into a live href.
	if (!state) throw new Error('usePane: no PaneState in context — render inside Board.svelte');
	return state;
}

// For mounting a panel outside Board.svelte — component tests, and any future
// second host. Exported so the context key itself can stay private.
export function paneContext(state: PaneState): Map<symbol, PaneState> {
	// A plain Map on purpose, and `mount`'s own signature demands one. Svelte
	// reads it once while initialising the component tree and nothing ever
	// mutates it afterwards — the reactivity lives in PaneState's `$state`, which
	// is the object this map hands over. A SvelteMap here would make the
	// *container* reactive to writes that never happen.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	return new Map([[PANE, state]]);
}
