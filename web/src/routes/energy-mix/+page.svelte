<script lang="ts">
	import {
		Activity,
		Building2,
		CalendarRange,
		Clock3,
		Database,
		Fuel,
		ShieldCheck,
		SunMedium,
		UtilityPole,
		Zap
	} from '@lucide/svelte';
	import { onMount } from 'svelte';
	import AppShell from '#lib/components/AppShell.svelte';
	import EnergyMixChart from '#lib/components/EnergyMixChart.svelte';
	import EnergyMixGauge from '#lib/components/EnergyMixGauge.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import { formatDateTime, formatNumber } from '#lib/format.js';
	import type { EnergyMixPeriod } from '#lib/types.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const periodOptions: Array<{ key: EnergyMixPeriod; label: string; detail: string }> = [
		{ key: 'hourly', label: 'Hourly', detail: 'Last 24 hours' },
		{ key: 'daily', label: 'Daily', detail: 'Last 30 days' },
		{ key: 'weekly', label: 'Weekly', detail: 'Last 12 weeks' },
		{ key: 'monthly', label: 'Monthly', detail: 'Last 12 months' }
	];
	let result = $derived(data.energyMix);
	let summary = $derived(result?.summary ?? null);
	let solarSources = $derived(result?.sourceMeters.filter((meter) => meter.role === 'solar_source') ?? []);
	let gridSources = $derived(result?.sourceMeters.filter((meter) => meter.role === 'grid_source') ?? []);
	let generatorSources = $derived(result?.sourceMeters.filter((meter) => meter.role === 'generator_source') ?? []);
	let allSources = $derived([...solarSources, ...gridSources, ...generatorSources]);
	let refreshHref = $derived(`/energy-mix?period=${data.period}${data.customRange ? `&from=${data.customRange.from}&to=${data.customRange.to}` : ''}&refresh=true`);
	let autoRefreshIn = $state(15 * 60);

	onMount(() => {
		const current = new URL(window.location.href);
		if (current.searchParams.has('refresh')) {
			current.searchParams.delete('refresh');
			window.history.replaceState({}, '', current);
		}
		const timer = window.setInterval(() => {
			autoRefreshIn -= 1;
			if (autoRefreshIn <= 0) window.location.reload();
		}, 1000);
		return () => window.clearInterval(timer);
	});

	const targetLabel = (status: string): string => ({
		within_target: 'Within 90–95% target',
		below_target: 'Below solar target',
		above_target: 'Above target range',
		no_data: 'No matched energy data'
	})[status] ?? 'Target status unavailable';

	const countdownLabel = (seconds: number): string =>
		`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
</script>

<svelte:head><title>Energy mix | MicroAccess Smart Metering</title></svelte:head>

<AppShell active="energy">
	<PageHeader
		eyebrow="Na-Aka Hub energy operations"
		title="Energy mix"
		description="A like-for-like comparison of solar, grid and any configured generator supply using only periods reported by every active source meter."
		{refreshHref}
	/>

	<nav class="periods" aria-label="Energy comparison presets">
		{#each periodOptions as option (option.key)}
			<a class:active={data.period === option.key && !data.customRange} href={`/energy-mix?period=${option.key}`}>
				<strong>{option.label}</strong><span>{option.detail}</span>
			</a>
		{/each}
	</nav>

	<section class="filter-panel" aria-label="Custom energy data filter">
		<div class="filter-title"><CalendarRange size={18} /><div><strong>Custom analysis window</strong><span>Choose exact dates and how the results should be grouped.</span></div></div>
		<form method="GET" action="/energy-mix">
			<label>From<input type="date" name="from" value={data.customRange?.from ?? ''} max={data.today} required /></label>
			<label>To<input type="date" name="to" value={data.customRange?.to ?? ''} max={data.today} required /></label>
			<label>Group by<select name="period" value={data.period}>
				{#each periodOptions as option (option.key)}<option value={option.key}>{option.label}</option>{/each}
			</select></label>
			<button type="submit">Apply filter</button>
			{#if data.customRange}<a href={`/energy-mix?period=${data.period}`}>Clear custom dates</a>{/if}
		</form>
		<div class="sync-status">
			<span><Clock3 size={15} /> Vendor readings normally arrive hourly. MSM checks this view every 15 minutes.</span>
			<strong>Next check {countdownLabel(autoRefreshIn)}</strong>
			{#if result}<span>Last synced {formatDateTime(result.dataSource.retrievedAt)}{result.dataSource.cached ? ' · short cache used' : ' · provider checked'}</span>{/if}
		</div>
	</section>

	{#if data.error}
		<section class="state">{data.error.message}</section>
	{:else if result && summary}
		<section class="hero-grid">
			<article class="panel contribution">
				<div class="heading">
					<div><p>Contribution split</p><h2>What powered Na-Aka Hub</h2></div>
					<span class:good={summary.targetStatus === 'within_target'} class:warn={summary.targetStatus !== 'within_target'}>{targetLabel(summary.targetStatus)}</span>
				</div>
				<div class="energy-flow">
					<div class="source solar-source">
						<span class="icon"><SunMedium size={25} /></span>
						<p>Solar</p><strong>{formatNumber(summary.solarKwh)} kWh</strong><small>{summary.solarPercent.toFixed(1)}% of matched energy</small>
					</div>
					<div class="flow-line solar-line"><span></span></div>
					<div class="building">
						<span class="building-icon"><Building2 size={38} /></span>
						<p>Na-Aka Hub</p><strong>{formatNumber(summary.totalKwh)} kWh</strong><small>Ground floor + Floors 1–5</small>
					</div>
					<div class="right-sources">
						<div class="right-source">
							<div class="flow-line incoming grid-line"><span></span></div>
							<div class="source grid-source"><span class="icon"><UtilityPole size={23} /></span><p>Grid</p><strong>{formatNumber(summary.gridKwh)} kWh</strong><small>{summary.gridPercent.toFixed(1)}% of matched energy</small></div>
						</div>
						<div class="right-source">
							<div class="flow-line incoming generator-line"><span></span></div>
							<div class:awaiting={!summary.generatorConfigured} class="source generator-source"><span class="icon"><Fuel size={23} /></span><p>Generator</p>
								{#if summary.generatorConfigured}<strong>{formatNumber(summary.generatorKwh)} kWh</strong><small>{summary.generatorPercent.toFixed(1)}% · {summary.generatorActiveIntervals ?? 0} active hourly intervals</small>
								{:else}<strong>Awaiting meter</strong><small>Excluded from totals until connected</small>{/if}
							</div>
						</div>
					</div>
				</div>
			</article>

			<aside class="panel gauge-panel">
				<div class="heading"><div><p>Solar performance</p><h2>90–95% contribution target</h2></div></div>
				<EnergyMixGauge solarPercent={summary.solarPercent} minimum={result.target.solarMinimumPercent} maximum={result.target.solarMaximumPercent} />
			</aside>
		</section>

		<section class="kpis">
			<article><span class="kpi-icon solar"><SunMedium size={18} /></span><div><p>Solar energy</p><strong>{formatNumber(summary.solarKwh)} <small>kWh</small></strong><span>{summary.solarPercent.toFixed(1)}% contribution</span></div></article>
			<article><span class="kpi-icon grid"><UtilityPole size={18} /></span><div><p>Grid energy</p><strong>{formatNumber(summary.gridKwh)} <small>kWh</small></strong><span>{summary.gridPercent.toFixed(1)}% dependency</span></div></article>
			<article><span class="kpi-icon generator"><Fuel size={18} /></span><div><p>Generator energy</p><strong>{summary.generatorConfigured ? formatNumber(summary.generatorKwh) : 'Not metered'} {#if summary.generatorConfigured}<small>kWh</small>{/if}</strong><span>{summary.generatorConfigured ? `${summary.generatorPercent.toFixed(1)}% contribution` : 'Ready for future source meter'}</span></div></article>
			<article><span class="kpi-icon"><Activity size={18} /></span><div><p>Matched intervals</p><strong>{summary.matchedIntervals} <small>of {summary.expectedIntervals}</small></strong><span>All configured sources reported</span></div></article>
			<article><span class="kpi-icon"><ShieldCheck size={18} /></span><div><p>Comparison coverage</p><strong>{summary.coveragePercent.toFixed(1)}<small>%</small></strong><span>Transparent data confidence</span></div></article>
		</section>

		<section class="panel chart-panel">
			<div class="heading chart-heading">
				<div><p>Energy contribution trend</p><h2>Solar, grid and generator usage</h2></div>
				<div class="legend"><span><i class="solar-dot"></i>Solar</span><span><i class="grid-dot"></i>Grid</span><span><i class="generator-dot"></i>Generator</span><span><i class="missing-dot"></i>Missing data</span></div>
			</div>
			<div class="chart-scroll"><EnergyMixChart buckets={result.buckets} period={result.period} /></div>
			<div class="chart-note"><Clock3 size={15} /><span>The number above each bar is total kWh; the percentage below it is matched-source coverage. A dash means data is missing, while a zero means the configured sources reported no consumption.</span></div>
		</section>

		<section class="detail-grid">
			<article class="panel sources">
				<div class="heading"><div><p>Source meters</p><h2>Data feeding this analysis</h2></div><Zap size={18} /></div>
				<div class="source-list">
					{#each allSources as meter (meter.providerId)}
						<a href={`/meters/${meter.providerId}`}>
							<span class:solar-meter={meter.role === 'solar_source'} class:grid-meter={meter.role === 'grid_source'} class:generator-meter={meter.role === 'generator_source'}>
								{#if meter.role === 'solar_source'}<SunMedium size={17} />{:else if meter.role === 'grid_source'}<UtilityPole size={17} />{:else}<Fuel size={17} />{/if}
							</span>
							<div><strong>{meter.name}</strong><small>{meter.meterNumber}</small></div>
							<div class="source-window"><strong>{meter.observedIntervals} readings</strong><small>{formatDateTime(meter.firstReadingAt)} – {formatDateTime(meter.latestReadingAt)}</small></div>
						</a>
					{/each}
					{#if !summary.generatorConfigured}
						<div class="pending-source"><span class="generator-meter"><Fuel size={17} /></span><div><strong>Generator source meter</strong><small>Not installed or classified yet</small></div><em>Awaiting meter</em></div>
					{/if}
				</div>
			</article>

			<aside class="panel quality">
				<div class="heading"><div><p>Data-quality boundary</p><h2>How to read the result</h2></div><Database size={18} /></div>
				<div class="method"><span>1</span><p><strong>Use interval consumption.</strong> “Usage kWh” is the change in the cumulative meter register during the preceding interval.</p></div>
				<div class="method"><span>2</span><p><strong>Match the timestamps.</strong> A period counts only when all currently configured source meters report for the same time.</p></div>
				<div class="method"><span>3</span><p><strong>Do not manufacture zeroes.</strong> Missing readings remain missing. The future generator leg is excluded until its physical meter is connected and classified.</p></div>
				<div class="method"><span>4</span><p><strong>Runtime is initially an estimate.</strong> Once installed, generator-active hourly intervals can estimate runtime; exact runtime needs engine start/stop telemetry or finer readings.</p></div>
				<p class="range">Analysis window: <strong>{formatDateTime(result.range.from)}</strong> to <strong>{formatDateTime(result.range.to)}</strong> (Africa/Lagos).</p>
			</aside>
		</section>
	{/if}
</AppShell>

<style>
	.state, .panel, .filter-panel { border: 1px solid var(--line); border-radius: 1rem; background: var(--surface); box-shadow: var(--shadow-sm); }
	.state { padding: 1rem; color: var(--danger); }
	.periods { display: grid; grid-template-columns: repeat(4, 1fr); gap: .55rem; margin-bottom: .65rem; }
	.periods a { padding: .68rem .8rem; border: 1px solid var(--line); border-radius: .78rem; background: color-mix(in srgb, var(--surface) 82%, transparent); color: var(--text); text-decoration: none; }
	.periods a:hover, .periods a.active { border-color: var(--sky); background: var(--surface); box-shadow: var(--shadow-sm); }
	.periods a.active { box-shadow: inset 0 -3px 0 var(--teal), var(--shadow-sm); }
	.periods strong, .periods span { display: block; }.periods strong { color: var(--navy); font-size: .72rem; }.periods span { margin-top: .15rem; color: var(--text-muted); font-size: .55rem; }
	.filter-panel { display: grid; grid-template-columns: minmax(12rem,.7fr) minmax(31rem,1.5fr); gap: .8rem 1.2rem; margin-bottom: .8rem; padding: .85rem 1rem; }
	.filter-title { display: flex; align-items: center; gap: .65rem; color: var(--blue); }.filter-title div { min-width: 0; }.filter-title strong, .filter-title span { display: block; }.filter-title strong { color: var(--navy); font-size: .7rem; }.filter-title span { margin-top: .16rem; color: var(--text-muted); font-size: .53rem; }
	.filter-panel form { display: flex; align-items: flex-end; justify-content: flex-end; gap: .45rem; }.filter-panel label { display: grid; gap: .25rem; color: var(--text-muted); font-size: .5rem; font-weight: 750; }.filter-panel input, .filter-panel select { min-height: 2.15rem; box-sizing: border-box; padding: .45rem .55rem; border: 1px solid var(--line); border-radius: .55rem; background: var(--surface-soft); color: var(--text); font-size: .62rem; }.filter-panel button, .filter-panel form > a { display: inline-flex; min-height: 2.15rem; box-sizing: border-box; align-items: center; padding: .48rem .7rem; border: 0; border-radius: .55rem; background: var(--action); color: white; font-size: .58rem; font-weight: 800; text-decoration: none; cursor: pointer; }.filter-panel form > a { border: 1px solid var(--line); background: var(--surface-soft); color: var(--text); }
	.sync-status { display: flex; grid-column: 1 / -1; flex-wrap: wrap; align-items: center; gap: .45rem 1rem; padding-top: .65rem; border-top: 1px solid var(--line-soft); color: var(--text-muted); font-size: .54rem; }.sync-status span { display: inline-flex; align-items: center; gap: .35rem; }.sync-status strong { color: var(--blue); }
	.hero-grid { display: grid; grid-template-columns: minmax(0, 1.75fr) minmax(17rem, .65fr); gap: .8rem; }
	.panel { padding: 1rem; }
	.heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
	.heading p { margin: 0 0 .3rem; color: var(--steel); font-size: .58rem; font-weight: 850; letter-spacing: .06em; text-transform: uppercase; }
	.heading h2 { margin: 0; color: var(--navy); font-size: 1.02rem; }
	.heading > span { padding: .38rem .6rem; border-radius: 999px; font-size: .58rem; font-weight: 800; white-space: nowrap; }
	.heading > span.good { background: color-mix(in srgb, var(--success) 16%, var(--surface)); color: var(--success); }.heading > span.warn { background: color-mix(in srgb, var(--warning) 18%, var(--surface)); color: var(--warning); }
	.energy-flow { display: grid; min-height: 17rem; grid-template-columns: 1fr minmax(2rem,.45fr) 1.25fr minmax(10rem,1.35fr); align-items: center; gap: .35rem; padding: 1rem .3rem .2rem; }
	.source, .building { text-align: center; }
	.icon, .building-icon { display: grid; width: 3.3rem; height: 3.3rem; margin: 0 auto .7rem; place-items: center; border-radius: 50%; }
	.solar-source .icon { background: linear-gradient(145deg, #d9f2f4, var(--sky)); color: #0a4174; box-shadow: 0 .5rem 1.4rem rgba(78,142,162,.22); }
	.grid-source .icon { background: linear-gradient(145deg, #0a4174, #001d39); color: white; box-shadow: 0 .5rem 1.4rem rgba(0,29,57,.22); }
	.generator-source .icon { background: color-mix(in srgb, var(--generator) 22%, var(--surface)); color: var(--generator); box-shadow: 0 .5rem 1.4rem rgba(216,137,47,.15); }
	.generator-source.awaiting { opacity: .72; }
	.building-icon { width: 4.7rem; height: 4.7rem; border-radius: 1.2rem; background: var(--pale-blue); color: var(--blue); box-shadow: inset 0 0 0 1px var(--pale), 0 .6rem 1.6rem rgba(0,29,57,.1); }
	.source p, .building p { margin: 0; color: var(--text-muted); font-size: .61rem; font-weight: 750; }
	.source strong, .building strong { display: block; margin-top: .22rem; color: var(--navy); font-size: 1rem; }.building strong { font-size: 1.32rem; }.source small, .building small { display: block; margin-top: .24rem; color: var(--text-muted); font-size: .53rem; }
	.flow-line { position: relative; height: 3px; background: var(--line); }.flow-line span { position: absolute; top: 50%; right: -.05rem; width: .48rem; height: .48rem; transform: translateY(-50%) rotate(45deg); border-top: 2px solid; border-right: 2px solid; }.solar-line { background: linear-gradient(90deg, var(--sky), var(--teal)); }.solar-line span { color: var(--teal); }
	.right-sources { display: grid; gap: 1.1rem; }.right-source { display: grid; grid-template-columns: minmax(2rem,.55fr) 1fr; align-items: center; gap: .3rem; }.incoming { transform: rotate(180deg); }.grid-line { background: linear-gradient(90deg, #001d39, #0a4174); }.grid-line span { color: #0a4174; }.generator-line { background: linear-gradient(90deg, var(--generator), color-mix(in srgb, var(--generator) 42%, var(--line))); }.generator-line span { color: var(--generator); }
	.gauge-panel { display: flex; align-items: center; flex-direction: column; }.gauge-panel .heading { width: 100%; margin-bottom: .8rem; }
	.kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: .65rem; margin: .8rem 0; }
	.kpis article { display: flex; min-width: 0; align-items: center; gap: .7rem; padding: .8rem; border: 1px solid var(--line); border-radius: .85rem; background: var(--surface); box-shadow: var(--shadow-sm); }
	.kpi-icon { display: grid; width: 2.35rem; height: 2.35rem; flex: 0 0 auto; place-items: center; border-radius: .66rem; background: var(--pale-blue); color: var(--blue); }.kpi-icon.solar { background: color-mix(in srgb, var(--teal) 15%, var(--surface)); color: var(--teal); }.kpi-icon.grid { background: color-mix(in srgb, var(--blue) 14%, var(--surface)); color: var(--blue); }.kpi-icon.generator { background: color-mix(in srgb, var(--generator) 16%, var(--surface)); color: var(--generator); }
	.kpis p, .kpis strong, .kpis div > span { display: block; }.kpis p { margin: 0; color: var(--text-muted); font-size: .55rem; }.kpis strong { overflow: hidden; margin-top: .18rem; color: var(--navy); font-size: .92rem; text-overflow: ellipsis; white-space: nowrap; }.kpis strong small { font-size: .58rem; }.kpis div > span { margin-top: .12rem; color: var(--text-muted); font-size: .49rem; }
	.chart-panel { margin-bottom: .8rem; }.chart-heading { align-items: center; margin-bottom: 1rem; }.legend { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: .75rem; }.legend span { display: flex; align-items: center; gap: .3rem; color: var(--text-muted); font-size: .55rem; }.legend i { width: .55rem; height: .55rem; border-radius: .16rem; }.solar-dot { background: var(--teal); }.grid-dot { background: #001d39; }.generator-dot { background: var(--generator); }.missing-dot { border: 1px dashed var(--text-muted); background: transparent; }
	.chart-scroll { overflow-x: auto; padding: .4rem .2rem .2rem; }.chart-note { display: flex; align-items: center; gap: .45rem; margin-top: .65rem; padding-top: .65rem; border-top: 1px solid var(--line-soft); color: var(--text-muted); font-size: .58rem; }
	.detail-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: .8rem; }.sources .heading, .quality .heading { margin-bottom: .8rem; }.sources .heading :global(svg), .quality .heading :global(svg) { color: var(--teal); }
	.source-list { display: grid; gap: .45rem; }.source-list a, .pending-source { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: .65rem; padding: .7rem; border: 1px solid var(--line-soft); border-radius: .75rem; color: inherit; text-decoration: none; }.source-list a:hover { border-color: var(--sky); background: var(--surface-soft); }.source-list a > span, .pending-source > span { display: grid; width: 2.15rem; height: 2.15rem; place-items: center; border-radius: .6rem; }.solar-meter { background: color-mix(in srgb, var(--teal) 15%, var(--surface)); color: var(--teal); }.grid-meter { background: color-mix(in srgb, var(--blue) 14%, var(--surface)); color: var(--blue); }.generator-meter { background: color-mix(in srgb, var(--generator) 16%, var(--surface)); color: var(--generator); }.source-list strong, .source-list small { display: block; }.source-list strong { color: var(--navy); font-size: .66rem; }.source-list small { margin-top: .14rem; color: var(--text-muted); font-size: .52rem; }.source-window { text-align: right; }.pending-source { border-style: dashed; }.pending-source em { color: var(--generator); font-size: .54rem; font-style: normal; font-weight: 800; }
	.method { display: grid; grid-template-columns: auto 1fr; gap: .55rem; margin-bottom: .55rem; }.method > span { display: grid; width: 1.5rem; height: 1.5rem; place-items: center; border-radius: 50%; background: var(--pale-blue); color: var(--blue); font-size: .56rem; font-weight: 850; }.method p { margin: 0; color: var(--text-muted); font-size: .61rem; line-height: 1.5; }.method strong { color: var(--navy); }.range { margin: .75rem 0 0; padding: .65rem; border-radius: .65rem; background: var(--surface-soft); color: var(--text-muted); font-size: .56rem; line-height: 1.5; }.range strong { color: var(--navy); }
	@media (max-width: 1250px) { .kpis { grid-template-columns: repeat(3, 1fr); }.filter-panel { grid-template-columns: 1fr; }.filter-panel form { justify-content: flex-start; }.sync-status { grid-column: 1; } }
	@media (max-width: 1100px) { .hero-grid, .detail-grid { grid-template-columns: 1fr; } }
	@media (max-width: 700px) { .periods { grid-template-columns: repeat(2, 1fr); }.filter-panel form { align-items: stretch; flex-direction: column; }.filter-panel form > a, .filter-panel button { justify-content: center; }.energy-flow { grid-template-columns: 1fr; gap: .8rem; }.flow-line { width: 3px; height: 1.5rem; margin: 0 auto; }.solar-line { background: linear-gradient(var(--sky), var(--teal)); }.flow-line span { top: auto; right: 50%; bottom: -.05rem; transform: translateX(50%) rotate(135deg); }.right-sources { width: 100%; }.right-source { grid-template-columns: 1fr; }.incoming { transform: none; }.building { order: 3; }.solar-source { order: 1; }.solar-line { order: 2; }.right-sources { order: 4; }.kpis { grid-template-columns: 1fr; }.chart-heading { align-items: flex-start; flex-direction: column; }.legend { justify-content: flex-start; }.source-list a, .pending-source { grid-template-columns: auto 1fr; }.source-window, .pending-source em { grid-column: 2; text-align: left; } }
</style>
