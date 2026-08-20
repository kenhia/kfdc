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
// machine can be tested without a DOM — same reason as wall.svelte.ts.
import { getContext, setContext } from 'svelte';
import { nodeHref } from './korglink';

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

	constructor(base: string, enabled = true) {
		this.base = base;
		this.enabled = enabled;
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
		if (this.enabled) this.node = nodeId;
	}

	close(): void {
		this.node = null;
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
