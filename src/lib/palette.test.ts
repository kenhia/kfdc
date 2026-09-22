// The palette gate (#1444). `queued` shipped in korg 069 with no rule in
// app.css, so it inherited the amber `.op` default and read as in-flight.
// That is the failure this pins: a status kfdc renders must have a treatment
// somebody chose, not one it fell into.
//
// The gate can only see the literals kfdc knows about — it cannot notice korg
// growing a fifth. That is the neutral `.op` base's job at runtime; this is
// the compile-time half, and it catches the likelier order of events: the
// list gets mirrored from korg's vocab and the CSS is forgotten.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PROGRAM_STATUSES, SCHEDULED_WI_STATUSES } from './board';

const css = readFileSync(new URL('../app.css', import.meta.url), 'utf8');

// The rule body for one selector, so an assertion reads that rule and not the
// stylesheet's every mention of the token.
function rule(selector: string): string {
	const at = css.indexOf(`${selector} {`);
	if (at === -1) return '';
	return css.slice(at, css.indexOf('}', at));
}

describe('program state palette', () => {
	it.each(PROGRAM_STATUSES)('paints the `%s` card and chip', (status) => {
		expect(rule(`.op-${status}`), `.op-${status} has no rule`).not.toBe('');
		expect(rule(`.status.${status}`), `.status.${status} has no rule`).not.toBe('');
	});

	// #1196's regression guard, stated as the rule rather than the colour:
	// holding is korg's resting state between slices, the one a program spends
	// most of its life in. Red made it a near-permanent alarm that led nowhere,
	// because awaiting-Ken is a column (set_awaiting) rendered by Commander's
	// Call — never a status value.
	//
	// `parked` (#1536) is held to the same rule, and it is the stronger case of
	// the two: holding is merely usually long, where parked is deferred with no
	// end date by definition. An alarm on a row whose whole meaning is "nothing
	// will happen here until something outside korg changes" cannot be acted on
	// by the person looking at it, which is what made red wrong the first time.
	//
	// `soaking` (#2151) joins them, and the argument is the strongest of the
	// three: the state means "acceptance is waiting on the passage of days", so
	// a reader looking at it can do nothing about it TODAY by definition. The
	// clock inside Delayed Ops may go red when a soak is overdue — that one IS
	// actionable, and it is a different selector.
	it.each([
		'.op-holding',
		'.status.holding',
		'.op-parked',
		'.status.parked',
		'.op-soaking',
		'.status.soaking'
	])('keeps the alarm colour out of %s', (selector) => {
		expect(rule(selector)).not.toMatch(/--red/);
	});

	// #2190, and the same rule in the masthead rather than on a card. `NO
	// REFRESH` earns red: the board could not reach korg and the reader may have
	// to go and look. A pending reload is the board working correctly and
	// announcing it, so dressing the two alike would spend the alarm colour on
	// the good news and leave the reader unable to tell them apart at a glance.
	it('keeps the alarm colour out of the pending-reload notice', () => {
		expect(rule('.statline .updated')).not.toBe('');
		expect(rule('.statline .updated')).not.toMatch(/--red/);
		expect(rule('.statline .updated')).toMatch(/--amber/);
	});

	// And the one that must keep it, so the test above cannot be satisfied by
	// red leaving the masthead altogether.
	it('keeps the alarm colour ON the no-refresh marker', () => {
		expect(rule('.statline .stale')).toMatch(/--red/);
	});
});

// #1645 brought the FIRST work-item statuses the board paints — every chip
// before Standing Orders wore a proposal's or a program's literal. Same gate,
// same reason: a status kfdc renders must have a treatment somebody chose, not
// one it fell into.
describe('scheduled work-item palette', () => {
	it.each(SCHEDULED_WI_STATUSES)('paints the `%s` chip', (status) => {
		expect(rule(`.status.${status}`), `.status.${status} has no rule`).not.toBe('');
	});

	// #1196's rule reaches this panel too, and `resolved` is where it would
	// most plausibly have been broken: the work is done and somebody has to say
	// so, which feels like an ask. It is not one — "wants Ken" is a column
	// (`set_awaiting`) drawn by Commander's Call, never a status value — and a
	// red chip on every resolved scheduled item would be a near-permanent alarm
	// on the panel's own success case.
	it.each(SCHEDULED_WI_STATUSES.map((s) => `.status.${s}`))(
		'keeps the alarm colour out of %s',
		(selector) => {
			expect(rule(selector)).not.toMatch(/--red/);
		}
	);

	// `parked` deliberately has NO rule of its own here: GP-19 is a rule about
	// every node kind, so a parked work item wears the chip a parked proposal
	// wears. This asserts the sharing rather than leaving it to look like an
	// oversight the next editor should fix.
	it('shares one `parked` chip across node kinds', () => {
		expect(SCHEDULED_WI_STATUSES as readonly string[]).toContain('parked');
		expect(PROGRAM_STATUSES as readonly string[]).toContain('parked');
		expect(css.match(/\.status\.parked \{/g)).toHaveLength(1);
	});
});
