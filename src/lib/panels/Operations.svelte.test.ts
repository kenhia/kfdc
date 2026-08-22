// The program-state palette (#1444, #1196). korg emits a program status
// literal; the panel switches on that literal and nothing else. The
// derivation that would "work" — reading the slices — is forbidden by GP-13's
// state half (korg #1424): `queued` means no slice has *started*, where
// started is active-or-done and explicitly not declined, and korg maintains
// that across three write paths a read-time derivation cannot see.
import { mount, unmount, type ComponentProps } from 'svelte';
import { describe, expect, it } from 'vitest';
import { PaneState, paneContext } from '$lib/pane.svelte';
import { PROGRAM_STATUSES, type ProgramRow, type ProgramSlice } from '$lib/board';
import Operations from './Operations.svelte';

const slice = (node_id: number, status = 'proposed'): ProgramSlice => ({
	node_id,
	title: `slice ${node_id}`,
	project: 'korg',
	status,
	rank: String(node_id),
	open: 1,
	resolved: 0,
	done: 0,
	closed: 0,
	covered_count: 1
});

const program = (over: Partial<ProgramRow> = {}): ProgramRow => ({
	node_id: 1447,
	title: 'program states the board can read',
	aim: 'a',
	status: 'active',
	span: ['korg', 'kfdc'],
	slice_count: 2,
	slices: [slice(1445, 'done'), slice(1446, 'active')],
	...over
});

function render(props: Partial<ComponentProps<typeof Operations>> = {}) {
	const target = document.body.appendChild(document.createElement('div'));
	const app = mount(Operations, {
		target,
		context: paneContext(new PaneState('https://korg.example')),
		props: { programs: [program()], omitted: { done: 0, archived: 0 }, ...props }
	});
	const card = () => target.querySelector('div.op') as HTMLElement;
	return {
		target,
		app,
		card,
		// The state classes the card wears, base `op` excluded — the palette is
		// one rule per korg literal, so this should always be exactly one.
		state: () => [...card().classList].filter((c) => c !== 'op'),
		chip: () => target.querySelector('span.status') as HTMLElement,
		marks: () => [...target.querySelectorAll('.slice .mark')].map((m) => m.textContent!.trim())
	};
}

describe('Operations program state', () => {
	// The bug #1444 names: a status with no rule of its own fell through to the
	// amber `.op` default and a program nobody had started read as ACTIVE.
	it.each(PROGRAM_STATUSES)('gives `%s` a card class of its own', (status) => {
		const v = render({ programs: [program({ status })] });
		expect(v.state()).toEqual([`op-${status}`]);
		unmount(v.app);
	});

	it('prints korg`s literal in the chip and carries it as a class', () => {
		const v = render({ programs: [program({ status: 'queued' })] });
		expect(v.chip().textContent).toBe('queued');
		expect([...v.chip().classList]).toEqual(['status', 'queued']);
		unmount(v.app);
	});

	// A status kfdc has never heard of must land on the neutral base, not on
	// whichever treatment happens to be the default. korg owns the vocabulary
	// and can grow it between deploys — GP-13's consumer half, and the runtime
	// half of the pair whose compile-time half is palette.test.ts.
	//
	// THE SPECIMEN HAS TO BE FICTIONAL, and #1536 is why that is now written
	// down and asserted rather than assumed. This test shipped with `parked` as
	// its hypothetical unknown; korg then shipped `parked` for real (sprint
	// 072), and the test went on passing while asserting the opposite of its
	// own name — that a KNOWN literal gets a class of its own, which is the
	// `it.each` above. A hypothetical borrowed from korg's plausible future is
	// a hypothetical with an expiry date, so this one is deliberately a word
	// korg has no use for, and the vocabulary is checked rather than trusted.
	const UNKNOWN = 'mothballed';
	it('lands an unknown status on the neutral base', () => {
		expect(PROGRAM_STATUSES as readonly string[]).not.toContain(UNKNOWN);
		const v = render({ programs: [program({ status: UNKNOWN })] });
		expect(v.state()).toEqual([`op-${UNKNOWN}`]);
		for (const known of PROGRAM_STATUSES) {
			expect(v.card().className).not.toMatch(new RegExp(`op-${known}\\b`));
		}
		unmount(v.app);
	});

	// Found by the grep #1196 asked for: the slice chip read every non-done,
	// non-active slice as "still ahead", so a declined slice sat pending
	// forever — and disagreed with board.ts's PROPOSAL_FINISHED, which counts
	// declined as finished. Two definitions of the same korg fact, in one repo.
	it('reads a declined slice as dropped, not still ahead', () => {
		const v = render({
			programs: [program({ slices: [slice(1, 'done'), slice(2, 'declined'), slice(3)] })]
		});
		expect(v.marks()).toEqual(['✓', '✕', '·']);
		unmount(v.app);
	});
});
