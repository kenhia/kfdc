<script lang="ts">
	import { rateOfFire, type FlowBar, type WorkItemFlowSeries } from '$lib/flow';

	let { flow }: { flow: WorkItemFlowSeries | null } = $props();

	const r = $derived(rateOfFire(flow));

	// Native-pixel geometry — the svg is drawn at 1:1 and never stretched, so
	// the board's type scale stays consistent and a longer series simply
	// renders wider: the widening to 10 days costs no edit here.
	const SLOT = 30;
	const BAR = 16;
	const PAD_L = 8;
	const PAD_R = 36;
	const BASE = 44;
	const MAXH = 34;
	const SPARK_TOP = 106;
	const SPARK_H = 22;
	const H = 136;

	const width = $derived(r ? PAD_L + r.bars.length * SLOT + PAD_R : 0);
	const plotR = $derived(r ? PAD_L + r.bars.length * SLOT : 0);
	const bx = (i: number) => PAD_L + i * SLOT + (SLOT - BAR) / 2;
	const cx = (i: number) => PAD_L + i * SLOT + SLOT / 2;
	// Nonzero counts keep a visible sliver even when the scale would erase
	// them — nothing disappears silently.
	const scaled = (v: number) => (r && v > 0 ? Math.max(1.5, (v / r.scaleMax) * MAXH) : 0);
	const sy = (v: number) =>
		r ? SPARK_TOP + ((r.backlogMax - v) / (r.backlogMax - r.backlogMin)) * SPARK_H : 0;

	// Rounded at the data end, square at the baseline (mark spec).
	function cap(x: number, y: number, h: number, up: boolean): string {
		const rr = Math.min(2, h / 2);
		return up
			? `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + BAR - rr} Q${x + BAR},${y} ${x + BAR},${y + rr} V${y + h} Z`
			: `M${x},${y} V${y + h - rr} Q${x},${y + h} ${x + rr},${y + h} H${x + BAR - rr} Q${x + BAR},${y + h} ${x + BAR},${y + h - rr} V${y} Z`;
	}

	// Durable sits on the baseline, churn rides the outer end, and a 2px
	// surface gap — not a stroke — separates the two fills.
	function segs(i: number, v: number, dur: number, up: boolean): { d: string; cls: string }[] {
		const hd = scaled(dur);
		const hc = scaled(v - dur);
		const gap = hd && hc ? 2 : 0;
		const dir = up ? 'add' : 'out';
		const out: { d: string; cls: string }[] = [];
		if (hd) {
			const y = up ? BASE - 2 - hd : BASE + 2;
			out.push({
				d: hc ? `M${bx(i)},${y} h${BAR} v${hd} h${-BAR} Z` : cap(bx(i), y, hd, up),
				cls: `${dir}-dur`
			});
		}
		if (hc) {
			const y = up ? BASE - 2 - hd - gap - hc : BASE + 2 + hd + gap;
			out.push({ d: cap(bx(i), y, hc, up), cls: `${dir}-churn` });
		}
		return out;
	}

	const tip = (b: FlowBar) =>
		`${b.day} · added ${b.added}${b.addedKnown ? ` (${b.addedDurable} durable)` : ' (durability pending)'}` +
		` · closed ${b.closed} (${b.closedDurable} durable) · backlog ${b.backlog}`;
</script>

<section class="panel rof">
	<div class="panel-head">
		<h2>Rate of Fire</h2>
		<span class="sub">work-item flow — durable vs churn</span>
	</div>

	{#if r && flow}
		<svg
			class="chart"
			{width}
			height={H}
			viewBox="0 0 {width} {H}"
			role="img"
			aria-label="Work-item flow over {r.bars
				.length} days: added above and closed below a shared baseline, durable portions solid, backlog sparkline beneath. The same data follows as a table."
		>
			<!-- One shared max for both directions — the mirror halves must be
			     comparable by eye, so there is exactly one scale. -->
			<line class="grid" x1={PAD_L} y1={BASE - 2 - MAXH} x2={plotR} y2={BASE - 2 - MAXH} />
			<line class="grid" x1={PAD_L} y1={BASE + 2 + MAXH} x2={plotR} y2={BASE + 2 + MAXH} />
			<text class="tick" x={plotR + 4} y={BASE + 1 - MAXH}>{r.scaleMax}</text>
			<line class="base" x1={PAD_L} y1={BASE} x2={plotR} y2={BASE} />

			{#each r.bars as b, i (b.day)}
				{#each segs(i, b.added, b.addedDurable, true) as s (s.cls)}
					<path class={s.cls} d={s.d} />
				{/each}
				{#each segs(i, b.closed, b.closedDurable, false) as s (s.cls)}
					<path class={s.cls} d={s.d} />
				{/each}
				<text class="day" class:today={i === r.bars.length - 1} x={cx(i)} y="92">{b.label}</text>
			{/each}

			<text class="strip-t" x={PAD_L} y="102">backlog</text>
			<polyline
				class="spark"
				points={r.bars.map((b, i) => `${cx(i)},${sy(b.backlog)}`).join(' ')}
			/>
			<circle class="spark-dot" cx={cx(r.bars.length - 1)} cy={sy(r.backlogNow)} r="3.5" />
			<text class="spark-v" x={cx(r.bars.length - 1) + 9} y={sy(r.backlogNow) + 3.5}
				>{r.backlogNow}</text
			>

			<!-- Hover layer: the hit target is the whole day slot, never the mark. -->
			{#each r.bars as b, i (b.day)}
				<rect class="hit" x={PAD_L + i * SLOT} y="0" width={SLOT} height={H}>
					<title>{tip(b)}</title>
				</rect>
			{/each}
		</svg>

		<div class="stats">
			<span>in <b>{r.totals.added}</b></span>
			<span>out <b>{r.totals.closed}</b></span>
			<span>durable out <b class="ok">{r.totals.closedDurable}</b></span>
			{#if r.totals.addedDurableKnown !== null}
				<span>durable in <b class="load">{r.totals.addedDurableKnown}</b></span>
			{/if}
			<span
				>backlog <b>{r.backlogNow}</b>
				<span class="delta" class:up={r.backlogDelta > 0} class:down={r.backlogDelta < 0}
					>{r.backlogDelta > 0 ? '+' : ''}{r.backlogDelta}/{r.bars.length}d</span
				></span
			>
		</div>
		<div class="legend">
			<i class="sw load"></i> added <i class="sw ok"></i> closed
			<span class="key">solid durable · faded &lt;{flow.durable_after_days}d</span>
		</div>

		<table class="visually-hidden">
			<caption>Work-item flow by day</caption>
			<thead>
				<tr>
					<th>day</th><th>added</th><th>added durable</th><th>closed</th>
					<th>closed durable</th><th>backlog</th>
				</tr>
			</thead>
			<tbody>
				{#each r.bars as b (b.day)}
					<tr>
						<td>{b.day}</td><td>{b.added}</td>
						<td>{b.addedKnown ? b.addedDurable : 'pending'}</td>
						<td>{b.closed}</td><td>{b.closedDurable}</td><td>{b.backlog}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{:else if flow}
		<p class="empty">flow feed empty — no days inside the window</p>
	{:else}
		<p class="empty">no flow feed — korg does not serve /api/work-items/flow yet</p>
	{/if}
</section>
