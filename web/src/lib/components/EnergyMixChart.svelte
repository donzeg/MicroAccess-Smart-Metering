<script lang="ts">
	import type { EnergyMixBucket, EnergyMixPeriod } from '#lib/types.js';
	let { buckets, period }: { buckets: EnergyMixBucket[]; period: EnergyMixPeriod } = $props();
	let visibleBuckets = $derived(buckets.filter((bucket) => bucket.expectedIntervals > 0));
	let maximum = $derived(Math.max(1, ...visibleBuckets.map((bucket) => bucket.totalKwh)));

	const shortLabel = (label: string, value: EnergyMixPeriod): string => {
		if (value === 'hourly') return label.slice(11);
		if (value === 'daily') return label.slice(5);
		if (value === 'weekly') return label.replace('Week of ', '').slice(5);
		return label;
	};
</script>

{#if visibleBuckets.length === 0}
	<div class="empty">No energy intervals were returned for this period.</div>
{:else}
	<div class="chart" style={`--count: ${visibleBuckets.length}`} role="img" aria-label="Stacked solar, grid and configured generator energy contribution chart">
		{#each visibleBuckets as bucket (bucket.key)}
			<div
				class="column"
				title={`${bucket.label}: ${bucket.solarKwh.toLocaleString()} kWh solar, ${bucket.gridKwh.toLocaleString()} kWh grid, ${bucket.generatorKwh.toLocaleString()} kWh generator, ${bucket.coveragePercent}% coverage`}
			>
				<div class="value">{bucket.matchedIntervals === 0 ? '—' : bucket.totalKwh.toLocaleString()}</div>
				<div class:missing={bucket.matchedIntervals === 0} class:zero={bucket.matchedIntervals > 0 && bucket.totalKwh === 0} class="bar-track">
					{#if bucket.matchedIntervals === 0}
						<span class="missing-mark" aria-hidden="true"></span>
					{:else if bucket.totalKwh === 0}
						<span class="zero-mark" aria-hidden="true"></span>
					{:else}
						<div class="bar" style={`height: ${Math.max(3, (bucket.totalKwh / maximum) * 100)}%`}>
							<div class="grid" style={`height: ${bucket.gridPercent}%`}></div>
							<div class="generator" style={`height: ${bucket.generatorPercent}%`}></div>
							<div class="solar" style={`height: ${bucket.solarPercent}%`}></div>
						</div>
					{/if}
				</div>
				<span>{shortLabel(bucket.label, period)}</span>
				<small>{bucket.coveragePercent}%</small>
			</div>
		{/each}
	</div>
{/if}

<style>
	.chart { display: grid; min-width: 46rem; height: 19rem; grid-template-columns: repeat(var(--count, 1), minmax(1.8rem, 1fr)); gap: .35rem; align-items: end; }
	.column { display: grid; height: 100%; grid-template-rows: 1.3rem 1fr 1.1rem .8rem; align-items: end; text-align: center; }
	.value { overflow: hidden; color: var(--text-muted); font-size: .49rem; text-overflow: ellipsis; }
	.bar-track { position: relative; height: 100%; overflow: hidden; border-radius: .35rem .35rem .18rem .18rem; background: repeating-linear-gradient(to top, var(--line-soft) 0, var(--line-soft) 1px, transparent 1px, transparent 25%); }
	.bar { position: absolute; bottom: 0; width: 100%; min-height: 0; overflow: hidden; border-radius: .35rem .35rem .15rem .15rem; box-shadow: 0 .2rem .6rem rgba(0,29,57,.12); }
	.solar { background: linear-gradient(180deg, var(--sky), var(--teal)); }
	.grid { background: linear-gradient(180deg, var(--blue), var(--nav-surface)); }
	.generator { background: linear-gradient(180deg, #f4bd6d, var(--generator)); }
	.bar-track.missing { background: repeating-linear-gradient(135deg, transparent 0, transparent 5px, var(--line-soft) 5px, var(--line-soft) 7px); }
	.missing-mark { position: absolute; right: 20%; bottom: .32rem; left: 20%; border-bottom: 2px dashed var(--text-muted); opacity: .55; }
	.zero-mark { position: absolute; right: 10%; bottom: .2rem; left: 10%; height: 3px; border-radius: 999px; background: var(--steel); }
	.column > span { overflow: hidden; color: var(--navy); font-size: .52rem; font-weight: 750; text-overflow: ellipsis; white-space: nowrap; }
	.column > small { color: var(--text-muted); font-size: .45rem; }
	.empty { display: grid; min-height: 12rem; place-items: center; color: var(--text-muted); font-size: .7rem; text-align: center; }
</style>
