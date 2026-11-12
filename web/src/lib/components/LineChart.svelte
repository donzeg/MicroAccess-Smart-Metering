<script lang="ts">
	let { values, label, unit = '' }: { values: number[]; label: string; unit?: string } = $props();
	const width = 760;
	const height = 220;
	const pad = 18;
	let min = $derived(values.length ? Math.min(...values) : 0);
	let max = $derived(values.length ? Math.max(...values) : 0);
	let range = $derived(Math.max(max - min, 1));
	let points = $derived(values.map((value, index) => {
		const x = values.length <= 1 ? width / 2 : pad + (index / (values.length - 1)) * (width - pad * 2);
		const y = height - pad - ((value - min) / range) * (height - pad * 2);
		return `${x.toFixed(1)},${y.toFixed(1)}`;
	}).join(' '));
	const number = (value: number) => new Intl.NumberFormat('en-NG', { maximumFractionDigits: 2 }).format(value);
</script>

<div class="chart" role="img" aria-label={label}>
	{#if values.length > 1}
		<div class="scale"><span>{number(max)} {unit}</span><span>{number(min)} {unit}</span></div>
		<svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
			<defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4e8ea2" stop-opacity=".34"/><stop offset="1" stop-color="#4e8ea2" stop-opacity="0"/></linearGradient></defs>
			<polygon points={`${pad},${height - pad} ${points} ${width - pad},${height - pad}`} fill="url(#fill)" />
			<polyline points={points} fill="none" stroke="#0a4174" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
		</svg>
	{:else}
		<div class="empty">At least two dated values are required to draw a trend.</div>
	{/if}
</div>

<style>
	.chart { position: relative; min-height: 13.75rem; border-radius: .85rem; background: linear-gradient(180deg, #f7fbfd, #fff); overflow: hidden; }
	svg { display: block; width: 100%; height: 13.75rem; }
	.scale { position: absolute; z-index: 1; inset: .65rem .8rem auto; display: flex; justify-content: space-between; color: var(--text-muted); font-size: .62rem; }
	.empty { display: grid; min-height: 13.75rem; place-items: center; color: var(--text-muted); font-size: .75rem; }
</style>
