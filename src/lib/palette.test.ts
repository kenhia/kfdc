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
import { PROGRAM_STATUSES } from './board';

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
	it.each(['.op-holding', '.status.holding'])('keeps the alarm colour out of %s', (selector) => {
		expect(rule(selector)).not.toMatch(/--red/);
	});
});
