<script lang="ts">
	import type { EnergyMixPeriod, FloorKey, FloorUsageBucket } from '#lib/types.js';

	let { buckets, floorKey, period }: { buckets: FloorUsageBucket[]; floorKey: FloorKey; period: EnergyMixPeriod } = $props();
	let values = $derived(buckets.map((bucket) => ({
		...bucket,
		usageKwh: bucket.floors.find((floor) => floor.floorKey === floorKey)?.usageKwh ?? 0
	})));
	let maximum = $derived(Math.max(1, ...values.map((bucket) => bucket.usageKwh)));

	const compactLabel = (label: string): string => {
		if (period === 'hourly') return label.slice(11);
		if (period === 'daily') return label.slice(5);
		if (period === 'monthly') return label;
		return label.replace('Week of ', '');
	};
</script>

<div class="chart" style={`--columns:${Math.max(values.length, 1)}`}>
	{#each values as bucket (bucket.key)}
		<div class="column" title={`${bucket.label}: ${bucket.usageKwh.toLocaleString()} kWh`}>
			<strong>{bucket.usageKwh > 0 ? bucket.usageKwh.toLocaleString(undefined, { maximumFractionDigits: 1 }) : '—'}</strong>
			<div class="track"><span style={`height:${bucket.usageKwh > 0 ? Math.max(4, (bucket.usageKwh / maximum) * 100) : 0}%`}></span></div>
			<small>{compactLabel(bucket.label)}</small>
		</div>
	{/each}
</div>

<style>
	.chart { display: grid; min-width: max(100%, calc(var(--columns) * 3.15rem)); height: 13.5rem; grid-template-columns: repeat(var(--columns), minmax(2.4rem, 1fr)); gap: .45rem; align-items: end; }
	.column { display: grid; height: 100%; grid-template-rows: 1.15rem 1fr 1.25rem; gap: .3rem; align-items: end; text-align: center; }
	.column strong { overflow: hidden; color: var(--blue); font-size: .48rem; font-weight: 800; text-overflow: ellipsis; white-space: nowrap; }
	.track { position: relative; height: 100%; overflow: hidden; border-radius: .45rem .45rem .16rem .16rem; background: linear-gradient(to top, var(--line-soft), transparent); }
	.track span { position: absolute; right: 0; bottom: 0; left: 0; min-height: 0; border-radius: .42rem .42rem .12rem .12rem; background: linear-gradient(to top, var(--blue), var(--sky)); box-shadow: 0 -.3rem 1rem color-mix(in srgb, var(--sky) 20%, transparent); }
	.column small { overflow: hidden; color: var(--text-muted); font-size: .46rem; text-overflow: ellipsis; white-space: nowrap; }
</style>
