// The Ticker's one piece of behaviour a pure derivation test cannot reach:
// whether the footer exists at all. `tickerLines` is covered in ticker.test.ts
// and is deliberately not re-asserted through the DOM.
import { mount, unmount, type ComponentProps } from 'svelte';
import { describe, expect, it } from 'vitest';
import { PaneState, paneContext } from '$lib/pane.svelte';
import type { TickerLine } from '$lib/ticker';
import Ticker from './Ticker.svelte';

const line = (over: Partial<TickerLine> = {}): TickerLine => ({
	age: '3m',
	at: '2026-08-11T03:21:30.025966Z',
	project: 'kfdc',
	kind: 'sprint_proposal',
	node_id: 1190,
	wi_number: null,
	ref: 1190,
	transition: 'proposed→active',
	to_status: 'active',
	text: "Ticker: render korg's transition lo…",
	...over
});

// korg's origin reaches every ref through the pane context now (#1203) rather
// than as a `korgBase` prop threaded to the two feeds that happened to need it.
function render(props: Partial<ComponentProps<typeof Ticker>> = {}) {
	const target = document.body.appendChild(document.createElement('div'));
	const app = mount(Ticker, {
		target,
		context: paneContext(new PaneState('https://korg.example')),
		props: { lines: [line()], ...props }
	});
	return {
		target,
		app,
		footer: () => target.querySelector('footer.ticker'),
		items: () =>
			[...target.querySelectorAll('.ev')].map((el) => el.textContent!.replace(/\s+/g, ' ').trim())
	};
}

describe('Ticker', () => {
	// THE honesty rule (#1187, roadmap Phase 3). korg's event log begins at
	// migration 0026 and was never backfilled, so an empty window means "nothing
	// has moved since the migration" — it is NOT evidence that nothing ever
	// moved. There is no empty state that says that without overstating, so the
	// footer must not exist at all: no heading, no rule, no "the net is quiet".
	// kfdc's whole credibility is that it does not claim what it does not know.
	it('renders no footer whatsoever on an empty window', () => {
		const v = render({ lines: [] });
		expect(v.footer()).toBeNull();
		expect(v.target.textContent!.trim()).toBe('');
		unmount(v.app);
	});

	it("prints korg's transition verbatim, with the ref linked into korg", () => {
		const v = render();
		expect(v.items()).toEqual([
			"3m kfdc 1190 proposed→active Ticker: render korg's transition lo…"
		]);
		const a = v.target.querySelector('.ev a') as HTMLAnchorElement;
		expect(a.getAttribute('href')).toBe('https://korg.example/n/1190');
		unmount(v.app);
	});

	// The age is the visible stamp because every panel ages the same way; korg's
	// exact recorded instant is the Ticker's own advantage and must stay
	// reachable rather than being rounded away.
	it("keeps korg's exact instant on the age stamp", () => {
		const v = render();
		expect(v.target.querySelector('.ev .t')!.getAttribute('title')).toBe(
			'2026-08-11T03:21:30.025966Z'
		);
		unmount(v.app);
	});

	// The source note states the window and nothing more — a scope claim, never
	// a history claim.
	it('states the window it is showing', () => {
		const v = render();
		expect(v.target.querySelector('.src-note')!.textContent!.trim()).toBe(
			'feed: korg transitions · newest 20'
		);
		unmount(v.app);
	});

	// One accent, and only for a sprint shipping. Accenting every terminal
	// status painted 12 of 20 rows green against the live window, because
	// `resolved→closed` is Ken's routine verification sweep — see `shipped`.
	it('accents a shipped proposal and leaves routine closures quiet', () => {
		const v = render({
			lines: [
				line({ kind: 'sprint_proposal', to_status: 'done' }),
				line({ kind: 'workitem', to_status: 'closed', node_id: 1164, wi_number: 1164 }),
				line({ kind: 'sprint_proposal', to_status: 'active', node_id: 912 })
			]
		});
		const cls = [...v.target.querySelectorAll('.tr')].map((el) => el.className);
		expect(cls[0]).toContain('ship');
		expect(cls[1]).not.toContain('ship');
		expect(cls[2]).not.toContain('ship');
		unmount(v.app);
	});

	// #1197's cosmetic half. A program carries no project, and an unguarded
	// `<span class="lp">` for it is not merely empty — it is a flex item, so it
	// still spends the strip's 6px gap on nothing. The assertion is on the span
	// EXISTING, not on its text: an empty span passes a textContent check and
	// still costs the gap, which is exactly how this got shipped.
	it('renders no project chip at all for an event that has no project', () => {
		const v = render({
			lines: [line({ kind: 'program', project: null, node_id: 1192, wi_number: null, ref: 1192 })]
		});
		expect(v.target.querySelector('.lp')).toBeNull();
		// The rest of the line is unaffected — and a program still deep-links.
		expect(v.items()).toEqual(["3m 1192 proposed→active Ticker: render korg's transition lo…"]);
		expect(v.target.querySelector('.ev a')!.getAttribute('href')).toBe(
			'https://korg.example/n/1192'
		);
		unmount(v.app);
	});

	// The guard must not eat a real project — the other half of the same rule.
	it('renders the project chip whenever korg gave one', () => {
		const v = render();
		expect(v.target.querySelector('.lp')!.textContent).toBe('kfdc');
		unmount(v.app);
	});

	// Was: "renders an unlinkable ref as plain text". There is no such thing any
	// more (#1203). korg's `/n/:id` resolves every kind, so the six kinds that
	// used to degrade — correctly, under kfdc #993's don't-fake-URLs rule — now
	// link like the other three. The degradation was never the goal; having no
	// URL to offer was the constraint, and korg sprint 070 removed it.
	it('links a kind that used to have no korg page at all', () => {
		const v = render({ lines: [line({ kind: 'report', node_id: 77, wi_number: null, ref: 77 })] });
		expect(v.target.querySelector('.lref')).toBeNull();
		expect(v.target.querySelector('.ev a')!.getAttribute('href')).toBe('https://korg.example/n/77');
		unmount(v.app);
	});
});
