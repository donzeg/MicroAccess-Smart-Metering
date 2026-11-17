<script lang="ts">
	import {
		Activity,
		Building2,
		CalendarRange,
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
	import InfoPopover from '#lib/components/InfoPopover.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import { formatDateTime, formatNumber } from '#lib/format.js';
	import type { EnergyMixPeriod } from '#lib/types.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const rangeOptions = [
		{ key: 'today', label: 'Today', detail: 'Midnight to latest completed hour', grouping: 'Hourly' },
		{ key: '7d', label: '7 Days', detail: 'Seven calendar days', grouping: 'Daily' },
		{ key: '30d', label: '30 Days', detail: 'Thirty calendar days', grouping: 'Daily' },
		{ key: '12m', label: '12 Months', detail: 'Twelve calendar months', grouping: 'Monthly' },
		{ key: 'ytd', label: 'Year to Date', detail: 'January 1 to today', grouping: 'Monthly' }
	];
	const groupingOptions: Array<{ key: EnergyMixPeriod; label: string }> = [
		{ key: 'hourly', label: 'Hourly' },
		{ key: 'daily', label: 'Daily' },
		{ key: 'weekly', label: 'Weekly' },
		{ key: 'monthly', label: 'Monthly' }
	];
	let result = $derived(data.energyMix);
	let summary = $derived(result?.summary ?? null);
	let sharedSupplyLabel = $derived(result?.sourceTopology.sharedSupplyLabel ?? 'AEDC grid');
	let gridIncludesGenerator = $derived(result?.sourceTopology.gridSourceIncludesGenerator ?? false);
	let missingIntervals = $derived(summary ? Math.max(0, summary.expectedIntervals - summary.matchedIntervals) : 0);
	let solarSources = $derived(result?.sourceMeters.filter((meter) => meter.role === 'solar_source') ?? []);
	let gridSources = $derived(result?.sourceMeters.filter((meter) => meter.role === 'grid_source') ?? []);
	let generatorSources = $derived(result?.sourceMeters.filter((meter) => meter.role === 'generator_source') ?? []);
	let allSources = $derived([...solarSources, ...gridSources, ...generatorSources]);
	let wholeWindowSolarStatus = $derived(
		!summary || !result
			? 'no_data'
			: summary.solarPercent < result.target.solarMinimumPercent
				? 'below_target'
				: summary.solarPercent > result.target.solarMaximumPercent
					? 'above_target'
					: 'within_target'
	);
	let refreshHref = $derived(data.customRange
		? `/energy-mix?period=${data.period}&from=${data.customRange.from}&to=${data.customRange.to}&refresh=true`
		: `/energy-mix?range=${data.preset ?? 'today'}&refresh=true`);
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
		no_data: 'No time-matched energy data'
	})[status] ?? 'Target status unavailable';

	const countdownLabel = (seconds: number): string =>
		`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
</script>

<svelte:head><title>Energy mix | MicroAccess Smart Metering</title></svelte:head>

<AppShell active="energy">
	<PageHeader
		eyebrow="Na-Aka Hub energy operations"
		title="Energy mix"
		description={gridIncludesGenerator
			? 'Compare solar with the currently measured conventional supply. Until the dedicated generator meter is installed, the conventional meter combines AEDC and generator energy.'
			: 'Compare solar, AEDC grid and separately metered generator energy across the selected reporting window.'}
		{refreshHref}
	/>

	<nav class="periods" aria-label="Energy comparison presets">
		{#each rangeOptions as option (option.key)}
			<a class:active={data.preset === option.key && !data.customRange} href={`/energy-mix?range=${option.key}`}>
				<strong>{option.label}</strong><span>{option.detail}</span><small>Grouped {option.grouping.toLowerCase()}</small>
			</a>
		{/each}
	</nav>

	{#if result}
		<section class="window-summary" aria-label="Active reporting window">
			<div><CalendarRange size={19} /><span><small>Active reporting window</small><strong>{data.rangeLabel}</strong></span></div>
			<p>{formatDateTime(result.range.from)} <span>to</span> {formatDateTime(result.range.to)} <small>Africa/Lagos</small></p>
			<strong>Grouped {data.groupingLabel}</strong>
		</section>
	{/if}

	<section class="filter-panel" aria-label="Custom energy data filter">
		<div class="filter-title"><CalendarRange size={18} /><div><strong>Custom analysis window</strong><span>Choose exact dates and how the results should be grouped.</span></div></div>
		<form method="GET" action="/energy-mix">
			<label>From<input type="date" name="from" value={data.customRange?.from ?? ''} max={data.today} required /></label>
			<label>To<input type="date" name="to" value={data.customRange?.to ?? ''} max={data.today} required /></label>
			<label>Group by<select name="period" value={data.period}>
				{#each groupingOptions as option (option.key)}<option value={option.key}>{option.label}</option>{/each}
			</select></label>
			<button type="submit">Apply filter</button>
			{#if data.customRange}<a href="/energy-mix?range=today">Clear custom dates</a>{/if}
		</form>
		<div class="sync-status">
			<InfoPopover title="Data refresh schedule" label="Explain data refresh" align="left"><p>Vendor readings normally arrive hourly. MSM checks this view every 15 minutes.</p></InfoPopover>
			<strong>Next check {countdownLabel(autoRefreshIn)}</strong>
			{#if result}<span>Last synced {formatDateTime(result.dataSource.retrievedAt)}{result.dataSource.cached ? ' · short cache used' : ' · provider checked'}</span>{/if}
		</div>
	</section>

	{#if data.error}
		<section class="state">{data.error.message}</section>
	{:else if result && summary}
		{#if missingIntervals > 0 || summary.registerRecoveredKwh > 0}
			<div class="coverage-summary" aria-label="Energy data coverage">
				<span><Activity size={15} /><strong>{summary.coveragePercent.toFixed(1)}% whole-window interval coverage</strong></span>
				<InfoPopover title="Energy coverage and recovered readings" label="Explain energy coverage">
					<p>{summary.matchedIntervals} of {summary.expectedIntervals} hours contain readings from every configured source. {missingIntervals} hourly detail {missingIntervals === 1 ? 'interval is' : 'intervals are'} unavailable.</p>
					<p>Whole-window totals still include {formatNumber(summary.registerRecoveredKwh)} kWh recovered from {summary.registerRecoveryEvents} cumulative-register {summary.registerRecoveryEvents === 1 ? 'movement' : 'movements'}. Matched-hour diagnostics exclude that recovered movement because its original timing is unknown; they are not used as the headline energy share.</p>
				</InfoPopover>
			</div>
		{/if}
		<section class="hero-grid">
			<article class="panel contribution">
				<div class="heading">
					<div><p>Whole-window accounted totals</p><h2>What powered Na-Aka Hub</h2></div>
					<div class="heading-actions"><span class="neutral">All accounted energy</span><InfoPopover title="How whole-window energy is calculated" label="Explain the whole-window energy mix">
						<ul>
							<li>Recorded intervals provide the timed detail; higher cumulative-register movement is recovered once when connectivity returns.</li>
							<li>Solar is separate. The conventional meter currently combines AEDC and generator energy until the generator has its own meter.</li>
							<li>This whole-window view includes recovered energy. Any matched-hour diagnostic excludes it because it cannot be assigned to its original hour reliably.</li>
						</ul>
					</InfoPopover></div>
				</div>
				<div class="energy-flow">
					<div class="source solar-source">
						<span class="icon"><SunMedium size={25} /></span>
						<p>Solar</p><strong>{formatNumber(summary.solarKwh)} kWh</strong><small>{summary.solarPercent.toFixed(1)}% of whole-window energy</small>
					</div>
					<div class="flow-line solar-line"><span></span></div>
					<div class="building">
						<span class="building-icon"><Building2 size={38} /></span>
						<p>Na-Aka Hub</p><strong>{formatNumber(summary.totalKwh)} kWh</strong><small>Ground floor + Floors 1–5</small>
					</div>
					<div class="right-sources">
						<div class="right-source">
							<div class="flow-line incoming grid-line"><span></span></div>
							<div class="source grid-source"><span class="icon"><UtilityPole size={23} /></span><p>{sharedSupplyLabel}</p><strong>{formatNumber(summary.gridKwh)} kWh</strong><small>{summary.gridPercent.toFixed(1)}% of whole-window energy</small></div>
						</div>
						<div class="right-source">
							<div class="flow-line incoming generator-line"><span></span></div>
							<div class:awaiting={!summary.generatorConfigured} class="source generator-source"><span class="icon"><Fuel size={23} /></span><p>Generator</p>
								{#if summary.generatorConfigured}<strong>{formatNumber(summary.generatorKwh)} kWh</strong><small>{summary.generatorPercent.toFixed(1)}% · {summary.generatorActiveIntervals ?? 0} active hourly intervals</small>
								{:else}<strong>{gridIncludesGenerator ? 'Included in shared meter' : 'Awaiting meter'}</strong><small>{gridIncludesGenerator ? 'Cannot be separated yet' : 'Excluded from totals until connected'}</small>{/if}
							</div>
						</div>
					</div>
				</div>
			</article>

			<aside class="performance-stack" aria-label="Whole-window energy shares">
				<article class="panel comparison-card">
					<div class="heading">
						<div><p>Whole-window energy mix</p><h2>Solar share of accounted energy</h2></div>
						<div class="comparison-heading-actions">
							<span class:good={wholeWindowSolarStatus === 'within_target'} class:warn={wholeWindowSolarStatus !== 'within_target'}>{targetLabel(wholeWindowSolarStatus)}</span>
							<InfoPopover title="How the solar share is calculated" label="Explain the whole-window solar share">
								<p>This percentage uses the same accounted totals shown in the main energy-flow panel: solar energy divided by all accounted energy in the selected window.</p>
								<p>The smaller matched-hour subset is retained only for data-quality diagnostics. It is not presented as the estate's headline solar share.</p>
							</InfoPopover>
						</div>
					</div>
					<div class="comparison-body">
						<EnergyMixGauge
							solarPercent={summary.solarPercent}
							minimum={result.target.solarMinimumPercent}
							maximum={result.target.solarMaximumPercent}
							label="Whole-window solar share"
							comparison="all accounted energy"
							compact
						/>
						<div class="comparison-details">
							<div><span class="solar-mark"></span><small>All solar</small><strong>{formatNumber(summary.solarKwh)} kWh</strong></div>
							<div><span class="grid-mark"></span><small>Other accounted supply</small><strong>{formatNumber(summary.totalKwh - summary.solarKwh)} kWh</strong></div>
							<p>Accounted total: {formatNumber(summary.totalKwh)} kWh · {summary.solarPercent.toFixed(1)}% solar</p>
						</div>
					</div>
				</article>

				<article class="panel comparison-card generator-comparison">
					<div class="heading">
						<div><p>Whole-window source split</p><h2>Generator share of accounted energy</h2></div>
						<div class="comparison-heading-actions">
							<InfoPopover title="Generator contribution" label="Explain the generator contribution"><p>This card uses the dedicated generator meter's whole-window energy. Until that meter is installed, generator energy remains included in the shared conventional-supply reading and cannot be separated reliably.</p></InfoPopover>
						</div>
					</div>
					{#if summary.generatorConfigured}
						<div class="source-share generator-share">
							<span><Fuel size={28} /></span>
							<strong>{summary.generatorPercent.toFixed(1)}%</strong>
							<p>{formatNumber(summary.generatorKwh)} kWh of {formatNumber(summary.totalKwh)} kWh accounted energy</p>
						</div>
					{:else if !summary.generatorConfigured}
						<div class="comparison-empty awaiting"><Fuel size={25} /><div><strong>Awaiting dedicated generator meter</strong><p>{gridIncludesGenerator ? 'Generator energy is currently included in the shared AEDC/generator reading. A separate percentage becomes available after the new meter is installed.' : 'No percentage is shown until a dedicated generator meter is installed and classified.'}</p></div></div>
					{/if}
				</article>
			</aside>
		</section>

		<section class="kpis">
			<article><span class="kpi-icon solar"><SunMedium size={18} /></span><div><p>Solar energy</p><strong>{formatNumber(summary.solarKwh)} <small>kWh</small></strong><span>{summary.solarPercent.toFixed(1)}% contribution</span></div></article>
			<article><span class="kpi-icon grid"><UtilityPole size={18} /></span><div><p>{sharedSupplyLabel}</p><strong>{formatNumber(summary.gridKwh)} <small>kWh</small></strong><span>{summary.gridPercent.toFixed(1)}% contribution</span></div></article>
			<article><span class="kpi-icon generator"><Fuel size={18} /></span><div><p>Generator energy</p><strong>{summary.generatorConfigured ? formatNumber(summary.generatorKwh) : gridIncludesGenerator ? 'Included above' : 'Not metered'} {#if summary.generatorConfigured}<small>kWh</small>{/if}</strong><span>{summary.generatorConfigured ? `${summary.generatorPercent.toFixed(1)}% contribution` : 'Dedicated source meter pending'}</span></div></article>
			<article><span class="kpi-icon"><Activity size={18} /></span><div><p>Whole-window interval coverage</p><strong>{summary.coveragePercent.toFixed(1)}<small>%</small></strong><span>{summary.matchedIntervals} of {summary.expectedIntervals} all-source hours</span></div></article>
			<article><span class="kpi-icon"><ShieldCheck size={18} /></span><div><p>Active-supply match coverage</p><strong>{summary.solarVsGrid.coveragePercent.toFixed(1)}<small>%</small></strong><span>{summary.solarVsGrid.matchedActiveIntervals} of {summary.solarVsGrid.companionActiveIntervals} active hours</span></div></article>
		</section>

		<section class="panel chart-panel">
			<div class="heading chart-heading">
				<div><p>Energy contribution trend</p><h2>Solar and measured supply usage</h2></div>
				<div class="heading-actions"><div class="legend"><span><i class="solar-dot"></i>Solar</span><span><i class="grid-dot"></i>{sharedSupplyLabel}</span>{#if summary.generatorConfigured}<span><i class="generator-dot"></i>Generator</span>{/if}<span><i class="missing-dot"></i>Missing data</span></div><InfoPopover title="How to read this chart" label="Explain the energy trend"><p>The number above each bar is total kWh; the percentage is matched-source coverage. A dash means a reading is missing, while zero means the configured sources reported no consumption.</p></InfoPopover></div>
			</div>
			<div class="chart-scroll"><EnergyMixChart buckets={result.buckets} period={result.period} {sharedSupplyLabel} /></div>
		</section>

		<section class="panel sources">
			<div class="heading"><div><p>Source meters</p><h2>Data feeding this analysis</h2></div><Zap size={18} /></div>
				<div class="source-list">
					{#each allSources as meter (meter.providerId)}
						<a href={`/meters/${meter.providerId}`}>
							<span class:solar-meter={meter.role === 'solar_source'} class:grid-meter={meter.role === 'grid_source'} class:generator-meter={meter.role === 'generator_source'}>
								{#if meter.role === 'solar_source'}<SunMedium size={17} />{:else if meter.role === 'grid_source'}<UtilityPole size={17} />{:else}<Fuel size={17} />{/if}
							</span>
							<div><strong>{meter.name}</strong><small>{meter.role === 'grid_source' ? `${sharedSupplyLabel} · ` : ''}{meter.meterNumber}</small></div>
							<div class="source-window"><strong>{meter.observedIntervals} readings</strong><small>{formatDateTime(meter.firstReadingAt)} – {formatDateTime(meter.latestReadingAt)}</small></div>
						</a>
					{/each}
					{#if !summary.generatorConfigured}
						<div class="pending-source"><span class="generator-meter"><Fuel size={17} /></span><div><strong>Dedicated generator source meter</strong><small>{gridIncludesGenerator ? 'Generator is currently included in the shared conventional meter' : 'Not installed or classified yet'}</small></div><em>Awaiting meter</em></div>
					{/if}
				</div>
		</section>
	{/if}
</AppShell>

<style>
	.state, .panel, .filter-panel, .window-summary { border: 1px solid var(--line); border-radius: 1rem; background: var(--surface); box-shadow: var(--shadow-sm); }
	.state { padding: 1rem; color: var(--danger); }
	.periods { display: grid; grid-template-columns: repeat(5, 1fr); gap: .55rem; margin-bottom: .65rem; }
	.periods a { padding: .68rem .8rem; border: 1px solid var(--line); border-radius: .78rem; background: color-mix(in srgb, var(--surface) 82%, transparent); color: var(--text); text-decoration: none; }
	.periods a:hover, .periods a.active { border-color: var(--sky); background: var(--surface); box-shadow: var(--shadow-sm); }
	.periods a.active { box-shadow: inset 0 -3px 0 var(--teal), var(--shadow-sm); }
	.periods strong, .periods span, .periods small { display: block; }.periods strong { color: var(--navy); font-size: .72rem; }.periods span { margin-top: .15rem; color: var(--text-muted); font-size: .55rem; }.periods small { margin-top: .3rem; color: var(--blue); font-size: .49rem; font-weight: 800; }
	.window-summary { display: grid; grid-template-columns: minmax(12rem,.7fr) minmax(20rem,1.6fr) auto; align-items: center; gap: .8rem 1.2rem; margin-bottom: .65rem; padding: .7rem 1rem; }
	.window-summary > div { display: flex; align-items: center; gap: .6rem; color: var(--blue); }.window-summary > div span small, .window-summary > div span strong { display: block; }.window-summary > div span small { color: var(--text-muted); font-size: .48rem; }.window-summary > div span strong { margin-top: .1rem; color: var(--navy); font-size: .68rem; }
	.window-summary p { margin: 0; color: var(--navy); font-size: .58rem; font-weight: 750; }.window-summary p span, .window-summary p small { color: var(--text-muted); font-weight: 500; }.window-summary > strong { padding: .38rem .6rem; border-radius: 999px; background: var(--pale-blue); color: var(--blue); font-size: .53rem; text-transform: capitalize; white-space: nowrap; }
	.filter-panel { display: grid; grid-template-columns: minmax(12rem,.7fr) minmax(31rem,1.5fr); gap: .8rem 1.2rem; margin-bottom: .8rem; padding: .85rem 1rem; }
	.filter-title { display: flex; align-items: center; gap: .65rem; color: var(--blue); }.filter-title div { min-width: 0; }.filter-title strong, .filter-title span { display: block; }.filter-title strong { color: var(--navy); font-size: .7rem; }.filter-title span { margin-top: .16rem; color: var(--text-muted); font-size: .53rem; }
	.filter-panel form { display: flex; align-items: flex-end; justify-content: flex-end; gap: .45rem; }.filter-panel label { display: grid; gap: .25rem; color: var(--text-muted); font-size: .5rem; font-weight: 750; }.filter-panel input, .filter-panel select { min-height: 2.15rem; box-sizing: border-box; padding: .45rem .55rem; border: 1px solid var(--line); border-radius: .55rem; background: var(--surface-soft); color: var(--text); font-size: .62rem; }.filter-panel button, .filter-panel form > a { display: inline-flex; min-height: 2.15rem; box-sizing: border-box; align-items: center; padding: .48rem .7rem; border: 0; border-radius: .55rem; background: var(--action); color: white; font-size: .58rem; font-weight: 800; text-decoration: none; cursor: pointer; }.filter-panel form > a { border: 1px solid var(--line); background: var(--surface-soft); color: var(--text); }
	.sync-status { display: flex; grid-column: 1 / -1; flex-wrap: wrap; align-items: center; gap: .45rem 1rem; padding-top: .65rem; border-top: 1px solid var(--line-soft); color: var(--text-muted); font-size: .54rem; }.sync-status span { display: inline-flex; align-items: center; gap: .35rem; }.sync-status strong { color: var(--blue); }
	.coverage-summary { display: flex; align-items: center; justify-content: flex-end; gap: .45rem; margin: -.2rem 0 .65rem; }.coverage-summary > span { display: inline-flex; align-items: center; gap: .35rem; padding: .32rem .5rem; border-radius: 999px; background: color-mix(in srgb, var(--warning) 12%, var(--surface)); color: var(--warning); font-size: .54rem; }
	.hero-grid { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(29rem, 1fr); gap: .8rem; }
	.panel { padding: 1rem; }
	.heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
	.heading p { margin: 0 0 .3rem; color: var(--steel); font-size: .58rem; font-weight: 850; letter-spacing: .06em; text-transform: uppercase; }
	.heading h2 { margin: 0; color: var(--navy); font-size: 1.02rem; }
	.heading-actions { display: flex; align-items: center; justify-content: flex-end; gap: .5rem; }.heading-actions > span { padding: .38rem .6rem; border-radius: 999px; font-size: .58rem; font-weight: 800; white-space: nowrap; }.heading-actions > span.neutral { background: var(--pale-blue); color: var(--blue); }
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
	.performance-stack { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .8rem; }
	.comparison-card { display: flex; min-width: 0; align-items: center; flex-direction: column; }
	.comparison-card .heading { width: 100%; min-height: 3.5rem; flex-direction: column; gap: .45rem; }
	.comparison-heading-actions { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: .5rem; }
	.comparison-heading-actions > span { padding: .3rem .48rem; border-radius: 999px; font-size: .48rem; font-weight: 800; white-space: nowrap; }
	.comparison-heading-actions > span.good { background: color-mix(in srgb, var(--success) 16%, var(--surface)); color: var(--success); }.comparison-heading-actions > span.warn { background: color-mix(in srgb, var(--warning) 18%, var(--surface)); color: var(--warning); }
	.comparison-card .heading h2 { font-size: .88rem; }
	.comparison-body { display: flex; width: 100%; flex: 1; align-items: center; flex-direction: column; justify-content: center; gap: .75rem; padding-top: .65rem; }
	.comparison-details { display: grid; width: 100%; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .45rem; }
	.comparison-details > div { display: grid; min-width: 0; grid-template-columns: auto 1fr; gap: .08rem .3rem; padding: .48rem; border: 1px solid var(--line-soft); border-radius: .55rem; background: var(--surface-soft); }
	.comparison-details > div > span { width: .42rem; height: .42rem; grid-row: 1 / 3; align-self: center; border-radius: 50%; }
	.solar-mark { background: var(--teal); }.grid-mark { background: var(--navy); }
	.comparison-details small { overflow: hidden; color: var(--text-muted); font-size: .47rem; text-overflow: ellipsis; white-space: nowrap; }
	.comparison-details strong { overflow: hidden; color: var(--navy); font-size: .62rem; text-overflow: ellipsis; white-space: nowrap; }
	.comparison-details p { grid-column: 1 / -1; margin: 0; color: var(--text-muted); font-size: .49rem; line-height: 1.45; text-align: center; }
	.comparison-empty { display: flex; min-height: 11rem; align-items: center; flex-direction: column; justify-content: center; gap: .65rem; color: var(--blue); text-align: center; }
	.comparison-empty > div { max-width: 12rem; }.comparison-empty strong { display: block; color: var(--navy); font-size: .76rem; }.comparison-empty p { margin: .28rem 0 0; color: var(--text-muted); font-size: .53rem; line-height: 1.5; }
	.comparison-empty.awaiting { color: var(--generator); }
	.source-share { display: flex; min-height: 11rem; width: 100%; box-sizing: border-box; align-items: center; flex-direction: column; justify-content: center; gap: .45rem; color: var(--navy); text-align: center; }
	.source-share > span { display: grid; width: 3.4rem; height: 3.4rem; place-items: center; border-radius: 50%; background: color-mix(in srgb, var(--generator) 16%, var(--surface)); color: var(--generator); }
	.source-share strong { font-size: 2rem; line-height: 1; }
	.source-share p { max-width: 13rem; margin: 0; color: var(--text-muted); font-size: .58rem; line-height: 1.45; }
	.kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: .65rem; margin: .8rem 0; }
	.kpis article { display: flex; min-width: 0; align-items: center; gap: .7rem; padding: .8rem; border: 1px solid var(--line); border-radius: .85rem; background: var(--surface); box-shadow: var(--shadow-sm); }
	.kpi-icon { display: grid; width: 2.35rem; height: 2.35rem; flex: 0 0 auto; place-items: center; border-radius: .66rem; background: var(--pale-blue); color: var(--blue); }.kpi-icon.solar { background: color-mix(in srgb, var(--teal) 15%, var(--surface)); color: var(--teal); }.kpi-icon.grid { background: color-mix(in srgb, var(--blue) 14%, var(--surface)); color: var(--blue); }.kpi-icon.generator { background: color-mix(in srgb, var(--generator) 16%, var(--surface)); color: var(--generator); }
	.kpis p, .kpis strong, .kpis div > span { display: block; }.kpis p { margin: 0; color: var(--text-muted); font-size: .55rem; }.kpis strong { overflow: hidden; margin-top: .18rem; color: var(--navy); font-size: .92rem; text-overflow: ellipsis; white-space: nowrap; }.kpis strong small { font-size: .58rem; }.kpis div > span { margin-top: .12rem; color: var(--text-muted); font-size: .49rem; }
	.chart-panel { margin-bottom: .8rem; }.chart-heading { align-items: center; margin-bottom: 1rem; }.legend { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: .75rem; }.legend span { display: flex; align-items: center; gap: .3rem; color: var(--text-muted); font-size: .55rem; }.legend i { width: .55rem; height: .55rem; border-radius: .16rem; }.solar-dot { background: var(--teal); }.grid-dot { background: #001d39; }.generator-dot { background: var(--generator); }.missing-dot { border: 1px dashed var(--text-muted); background: transparent; }
	.chart-scroll { overflow-x: auto; padding: .4rem .2rem .55rem; scrollbar-gutter: stable; overscroll-behavior-inline: contain; }
	.sources .heading { margin-bottom: .8rem; }.sources .heading > :global(svg) { color: var(--teal); }
	.source-list { display: grid; gap: .45rem; }.source-list a, .pending-source { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: .65rem; padding: .7rem; border: 1px solid var(--line-soft); border-radius: .75rem; color: inherit; text-decoration: none; }.source-list a:hover { border-color: var(--sky); background: var(--surface-soft); }.source-list a > span, .pending-source > span { display: grid; width: 2.15rem; height: 2.15rem; place-items: center; border-radius: .6rem; }.solar-meter { background: color-mix(in srgb, var(--teal) 15%, var(--surface)); color: var(--teal); }.grid-meter { background: color-mix(in srgb, var(--blue) 14%, var(--surface)); color: var(--blue); }.generator-meter { background: color-mix(in srgb, var(--generator) 16%, var(--surface)); color: var(--generator); }.source-list strong, .source-list small { display: block; }.source-list strong { color: var(--navy); font-size: .66rem; }.source-list small { margin-top: .14rem; color: var(--text-muted); font-size: .52rem; }.source-window { text-align: right; }.pending-source { border-style: dashed; }.pending-source em { color: var(--generator); font-size: .54rem; font-style: normal; font-weight: 800; }
	@media (max-width: 1250px) { .periods { grid-template-columns: repeat(3, 1fr); }.window-summary { grid-template-columns: 1fr auto; }.window-summary p { grid-column: 1 / -1; grid-row: 2; }.hero-grid { grid-template-columns: 1fr; }.kpis { grid-template-columns: repeat(3, 1fr); }.filter-panel { grid-template-columns: 1fr; }.filter-panel form { justify-content: flex-start; }.sync-status { grid-column: 1; } }
	@media (max-width: 899px) { .periods { grid-template-columns: repeat(2,1fr); }.kpis { grid-template-columns: repeat(2,minmax(0,1fr)); }.performance-stack { grid-template-columns: 1fr; }.chart-scroll { border-right: 1px solid var(--line-soft); border-left: 1px solid var(--line-soft); } }
	@media (max-width: 599px) { .periods, .window-summary { grid-template-columns: 1fr; }.window-summary p, .window-summary > strong { grid-column: 1; grid-row: auto; }.window-summary > strong { justify-self: start; }.filter-panel form { align-items: stretch; flex-direction: column; }.filter-panel form > a, .filter-panel button { min-height: 2.75rem; justify-content: center; }.energy-flow { grid-template-columns: 1fr; gap: .8rem; }.flow-line { width: 3px; height: 1.5rem; margin: 0 auto; }.solar-line { background: linear-gradient(var(--sky), var(--teal)); }.flow-line span { top: auto; right: 50%; bottom: -.05rem; transform: translateX(50%) rotate(135deg); }.right-sources { width: 100%; }.right-source { grid-template-columns: 1fr; }.incoming { transform: none; }.building { order: 3; }.solar-source { order: 1; }.solar-line { order: 2; }.right-sources { order: 4; }.kpis { grid-template-columns: 1fr; }.chart-heading { align-items: flex-start; flex-direction: column; }.heading-actions { align-items:flex-start; }.chart-heading .heading-actions { width:100%; }.legend { justify-content:flex-start; }.source-list a, .pending-source { grid-template-columns:auto 1fr; }.source-window, .pending-source em { grid-column:2; text-align:left; } }
</style>
