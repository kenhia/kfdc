// Ticker — korg's transition log, rendered (kfdc #1187). The board's second
// transition feed, and deliberately not the first one's twin: #1186 measured
// the two against live production and settled the division of labour.
//
//   Net Log  — observer-relative. What THIS board saw change since it last
//              looked, at observation time. Speaks FDC (firing, splash, on
//              deck). Sees queue movement, splash and awaiting, none of which
//              korg records as a status transition.
//   Ticker   — korg-authoritative. What korg RECORDED, at korg's own instant,
//              in korg's own words. Sees per-work-item transitions, which the
//              Net Log's proposal-level digest is structurally blind to (16 of
//              the 20 events in the window #1186 measured).
//
// Hence the one rule this module enforces: the Ticker does not paraphrase.
// A `from_status → to_status` is quoted verbatim, never translated into the
// Net Log's FDC verbs — a panel whose whole claim is "this is the record"
// cannot restate the record in its own words.

import { formatAge, type Board } from './board';
import { fragment, lineHref } from './netlog';

export interface TickerLine {
	// Age against the board's `generated` — Postgres's clock on both sides, the
	// same rule every other panel follows. Never Date.now().
	age: string;
	// korg's exact recorded instant, carried through untouched: the one thing
	// the Net Log's observation time structurally cannot offer.
	at: string;
	project: string;
	kind: string;
	node_id: number;
	wi_number: number | null;
	// What the line prints and links: korg numbers a work item by wi_number and
	// everything else by node_id.
	ref: number;
	// korg's own words (#1186). Not an FDC verb.
	transition: string;
	// Where the transition landed, carried separately so the render can accent
	// a ship without parsing the arrow back out of `transition`.
	to_status: string;
	text: string;
}

// Shorter than the Net Log's 60: the Ticker is a wrapping run of items, so
// every character costs horizontal room shared with the next event, not the
// tail of a line that was going to be blank anyway.
const TITLE_MAX = 36;

export function tickerLines(b: Board): TickerLine[] {
	// Absent (a korg predating #977) reads the same as empty — strictly less
	// information, so strictly less to claim. The board must not fall over
	// because a footer strip lost its feed.
	return (b.events ?? []).map((e) => ({
		age: formatAge(b.generated, e.at),
		at: e.at,
		project: e.project,
		kind: e.kind,
		node_id: e.node_id,
		wi_number: e.wi_number,
		ref: e.wi_number ?? e.node_id,
		transition: `${e.from_status}→${e.to_status}`,
		to_status: e.to_status,
		text: fragment(e.title, TITLE_MAX)
	}));
}

// The Ticker's one accent, and it means exactly one thing: a sprint shipped.
//
// Measured against the live window before being written this narrowly. The
// obvious rule — accent anything reaching a terminal status — painted 12 of 20
// events green, because `resolved→closed` is Ken's routine verification sweep
// and it dominates the feed. An accent that fires on more than half the rows is
// not an accent, it is the background. A proposal reaching `done` is the rare
// event the board's vocabulary already celebrates (SPLASH, #990), and it was 1
// of 20 in the same window.
export function shipped(l: TickerLine): boolean {
	return l.kind === 'sprint_proposal' && l.to_status === 'done';
}

// Both feeds link into korg by exactly one rule, so the two cannot drift apart
// on what a korg URL looks like. Shared deliberately (#1187).
export const tickerHref = lineHref;
