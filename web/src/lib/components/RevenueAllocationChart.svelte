<script lang="ts">
	import type { EnergyMixPeriod, RevenueBucket } from '#lib/types.js';
	let { buckets, period, sharedSupplyLabel }: { buckets: RevenueBucket[]; period: EnergyMixPeriod; sharedSupplyLabel: string } = $props();
	let visibleBuckets = $derived(buckets);
	let maximum = $derived(Math.max(1, ...visibleBuckets.map((bucket) => bucket.accruedEnergyRevenueNgn)));

	const shortLabel = (label: string, value: EnergyMixPeriod): string => {
		if (value === 'hourly') return label.slice(11);
		if (value === 'daily') return label.slice(5);
		if (value === 'weekly') return label.replace('Week of ', '').slice(5);
		return label;
	};

	const compactNaira = (value: number): string =>
		new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', notation: 'compact', maximumFractionDigits: 1 }).format(value);
</script>

{#if visibleBuckets.length === 0}
	<div class="empty">No matched source energy was returned for this period.</div>
{:else}
	<div class="chart" style={`--count: ${visibleBuckets.length}`} role="img" aria-label={`Accrued energy revenue split between solar, ${sharedSupplyLabel} and separately metered generator supply`}>
		{#each visibleBuckets as bucket (bucket.key)}
			<div class="column" title={`${bucket.label}: ${compactNaira(bucket.accruedEnergyRevenueNgn)} accrued energy revenue; ${compactNaira(bucket.solarAccruedRevenueNgn)} solar; ${compactNaira(bucket.sharedSupplyAccruedRevenueNgn)} ${sharedSupplyLabel}; ${compactNaira(bucket.generatorAccruedRevenueNgn)} separately metered generator; ${bucket.coveragePercent}% meter coverage`}>
				<div class="value">{bucket.coveragePercent === 0 ? '—' : compactNaira(bucket.accruedEnergyRevenueNgn)}</div>
				<div class:empty-bar={bucket.accruedEnergyRevenueNgn === 0} class:missing-source={bucket.coveragePercent === 0} class="bar-track">
					{#if bucket.accruedEnergyRevenueNgn === 0}
						<span class="zero-mark" aria-hidden="true"></span>
					{:else}
						<div class="bar" style={`height: ${Math.max(4, (bucket.accruedEnergyRevenueNgn / maximum) * 100)}%`}>
							<div class="generator" style={`height: ${(bucket.generatorAccruedRevenueNgn / bucket.accruedEnergyRevenueNgn) * 100}%`}></div>
							<div class="grid" style={`height: ${(bucket.sharedSupplyAccruedRevenueNgn / bucket.accruedEnergyRevenueNgn) * 100}%`}></div>
							<div class="solar" style={`height: ${(bucket.solarAccruedRevenueNgn / bucket.accruedEnergyRevenueNgn) * 100}%`}></div>
						</div>
					{/if}
				</div>
				<span>{shortLabel(bucket.label, period)}</span>
				<small>{bucket.coveragePercent}% coverage</small>
			</div>
		{/each}
	</div>
{/if}

<style>
	.chart { display: grid; min-width: max(100%, calc(var(--count, 1) * 2.4rem)); height: 19rem; grid-template-columns: repeat(var(--count, 1), minmax(2rem, 1fr)); gap: .35rem; align-items: end; }
	.column { display: grid; height: 100%; grid-template-rows: 1.3rem 1fr 1.1rem .8rem; align-items: end; text-align: center; }
	.value { overflow: hidden; color: var(--text); font-size: .7rem; font-weight: 750; text-overflow: ellipsis; white-space: nowrap; }
	.bar-track { position: relative; height: 100%; overflow: hidden; border-radius: .35rem .35rem .18rem .18rem; background: repeating-linear-gradient(to top, var(--line-soft) 0, var(--line-soft) 1px, transparent 1px, transparent 25%); }
	.bar-track.missing-source { border: 1px dashed var(--line); background: repeating-linear-gradient(135deg, transparent 0, transparent 7px, var(--line-soft) 7px, var(--line-soft) 10px); }
	.bar { position: absolute; bottom: 0; width: 100%; overflow: hidden; border-radius: .35rem .35rem .15rem .15rem; box-shadow: 0 .2rem .6rem rgba(0,29,57,.12); }
	.solar { background: linear-gradient(180deg, var(--sky), var(--teal)); }
	.grid { background: linear-gradient(180deg, var(--blue), var(--nav-surface)); }
	.generator { background: linear-gradient(180deg, #f4bd6d, var(--generator)); }
	.zero-mark { position: absolute; right: 10%; bottom: .2rem; left: 10%; height: 3px; border-radius: 999px; background: var(--steel); }
	.column > span { overflow: hidden; color: var(--navy); font-size: .66rem; font-weight: 800; text-overflow: ellipsis; white-space: nowrap; }
	.column > small { color: var(--text); font-size: .61rem; font-weight: 650; }
	.empty { display: grid; min-height: 12rem; place-items: center; color: var(--text-muted); font-size: .7rem; text-align: center; }
	@media (max-width: 899px) { .chart { height: 16rem; min-width: max(100%, calc(var(--count, 1) * 2.7rem)); } }
</style>
