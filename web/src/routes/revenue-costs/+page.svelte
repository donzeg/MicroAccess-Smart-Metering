<script lang="ts">
	import {
		Activity,
		CalendarRange,
		CircleDollarSign,
		Clock3,
		Database,
		Fuel,
		Landmark,
		ReceiptText,
		Scale,
		ShieldAlert,
		SunMedium,
		UtilityPole,
		WalletCards,
		Zap
	} from '@lucide/svelte';
	import { onMount } from 'svelte';
	import AppShell from '#lib/components/AppShell.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import RevenueAllocationChart from '#lib/components/RevenueAllocationChart.svelte';
	import { formatDateTime, formatNaira, formatNumber } from '#lib/format.js';
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
	let result = $derived(data.revenue);
	let summary = $derived(result?.summary ?? null);
	let sharedSupplyLabel = $derived(result?.sourceTopology.sharedSupplyLabel ?? 'AEDC grid');
	let generatorSeparatelyMetered = $derived(result?.sourceTopology.generatorSeparatelyMetered ?? false);
	let missingIntervals = $derived(summary ? Math.max(0, summary.expectedIntervals - summary.matchedIntervals) : 0);
	let refreshHref = $derived(data.customRange
		? `/revenue-costs?period=${data.period}&from=${data.customRange.from}&to=${data.customRange.to}&refresh=true`
		: `/revenue-costs?range=${data.preset ?? 'today'}&refresh=true`);
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

	const countdownLabel = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
</script>

<svelte:head><title>Revenue & energy valuation | MicroAccess Smart Metering</title></svelte:head>

<AppShell active="revenue">
	<PageHeader
		eyebrow="Na-Aka Hub commercial analytics"
		title="Revenue & energy valuation"
		description="Value consumed energy at the Band A retail rate, split it by measured supply source, and keep credit purchases, collections and operating costs as separate commercial measures."
		{refreshHref}
	/>

	<nav class="periods" aria-label="Revenue analysis presets">
		{#each rangeOptions as option (option.key)}
			<a class:active={data.preset === option.key && !data.customRange} href={`/revenue-costs?range=${option.key}`}><strong>{option.label}</strong><span>{option.detail}</span><small>Grouped {option.grouping.toLowerCase()}</small></a>
		{/each}
	</nav>

	{#if result}
		<section class="window-summary" aria-label="Active reporting window">
			<div><CalendarRange size={19} /><span><small>Active reporting window</small><strong>{data.rangeLabel}</strong></span></div>
			<p>{formatDateTime(result.range.from)} <span>to</span> {formatDateTime(result.range.to)} <small>Africa/Lagos</small></p>
			<strong>Grouped {data.groupingLabel}</strong>
		</section>
	{/if}

	<section class="filter-panel" aria-label="Custom revenue filter">
		<div class="filter-title"><CalendarRange size={18} /><div><strong>Custom commercial window</strong><span>Choose exact dates and the level of detail for the charts.</span></div></div>
		<form method="GET" action="/revenue-costs">
			<label>From<input type="date" name="from" value={data.customRange?.from ?? ''} max={data.today} required /></label>
			<label>To<input type="date" name="to" value={data.customRange?.to ?? ''} max={data.today} required /></label>
			<label>Group by<select name="period" value={data.period}>{#each groupingOptions as option (option.key)}<option value={option.key}>{option.label}</option>{/each}</select></label>
			<button type="submit">Apply filter</button>
			{#if data.customRange}<a href="/revenue-costs?range=today">Clear custom dates</a>{/if}
		</form>
		<div class="sync-status">
			<span><Clock3 size={15} /> Meter readings and provider ledgers normally arrive hourly. MSM checks every 15 minutes.</span>
			<strong>Next check {countdownLabel(autoRefreshIn)}</strong>
			{#if result}<span>Last synced {formatDateTime(result.dataSource.retrievedAt)}{result.dataSource.cached ? ' · short cache used' : ' · provider checked'}</span>{/if}
		</div>
	</section>

	{#if data.error}
		<section class="state">{data.error.message}</section>
	{:else if result && summary}
		{#if missingIntervals > 0 || summary.registerRecoveredKwh > 0}
			<section class="coverage-alert" aria-label="Incomplete source-meter coverage warning">
				<Activity size={20} />
				<div><strong>{missingIntervals} hourly detail {missingIntervals === 1 ? 'interval is' : 'intervals are'} unavailable in this window</strong><span>The valuation still includes {formatNumber(summary.registerRecoveredKwh)} kWh recovered from cumulative-register movement after connectivity returned. Recovery changes energy and revenue totals without inventing missing hourly timestamps.</span></div>
				<b>{summary.coveragePercent.toFixed(1)}% interval coverage</b>
			</section>
		{/if}
		<section class="truth-banner">
			<ShieldAlert size={19} />
			<div><strong>Revenue follows energy consumed—not the timing of customer credit purchases</strong><span>Every register-accounted kWh is valued using the effective-dated tariff. The current Band {result.tariff.tariffBand} rate is {formatNaira(result.tariff.retailNgnPerKwh)} and {result.tariff.versionsApplied} tariff version(s) apply in this window. Collections and actual operating costs remain separate.</span></div>
		</section>

		<section class="kpis">
			<article><span class="kpi-icon"><Zap size={18} /></span><div><p>Accrued energy revenue</p><strong>{formatNaira(summary.accruedEnergyRevenueNgn)}</strong><span>{formatNumber(summary.totalKwh)} kWh across {result.tariff.versionsApplied} effective tariff version(s)</span></div></article>
			<article><span class="kpi-icon solar"><SunMedium size={18} /></span><div><p>Solar energy revenue</p><strong>{formatNaira(summary.solarAccruedRevenueNgn)}</strong><span>{formatNumber(summary.solarKwh)} kWh · {summary.solarPercent.toFixed(1)}%</span></div></article>
			<article><span class="kpi-icon grid"><UtilityPole size={18} /></span><div><p>{sharedSupplyLabel} revenue</p><strong>{formatNaira(summary.sharedSupplyAccruedRevenueNgn)}</strong><span>{formatNumber(summary.gridKwh)} kWh · {summary.gridPercent.toFixed(1)}%</span></div></article>
			<article><span class="kpi-icon generator"><Fuel size={18} /></span><div><p>Generator revenue</p><strong>{generatorSeparatelyMetered ? formatNaira(summary.generatorAccruedRevenueNgn) : 'Included above'}</strong><span>{generatorSeparatelyMetered ? `${formatNumber(summary.generatorKwh)} kWh separately metered` : 'Dedicated generator meter pending'}</span></div></article>
			<article><span class="kpi-icon payment"><WalletCards size={18} /></span><div><p>Actual collections</p><strong>{summary.collectionsAvailable ? formatNaira(summary.recordedPaymentNgn) : 'Not available'}</strong><span>{summary.collectionsAvailable ? `${summary.paymentTransactions} PAY entries` : 'Credit-purchase/payment module pending'}</span></div></article>
		</section>

		<section class="hero-grid">
			<article class="panel allocation">
				<div class="heading"><div><p>Energy-used revenue split</p><h2>What the consumed energy generated</h2></div><span>{summary.coveragePercent.toFixed(1)}% hourly detail</span></div>
				<div class="allocation-total"><span>Accrued revenue from register-accounted consumption</span><strong>{formatNaira(summary.accruedEnergyRevenueNgn)}</strong><small>{formatNumber(summary.totalKwh)} kWh valued at the configured Band A tariff, including recovered connectivity-gap movement</small></div>
				<div class="allocation-bar" aria-label="Accrued energy revenue by supply source">
					{#if summary.accruedEnergyRevenueNgn > 0}
						<span class="solar-segment" style={`width:${summary.solarPercent}%`}></span>
						<span class="grid-segment" style={`width:${summary.gridPercent}%`}></span>
						<span class="generator-segment" style={`width:${summary.generatorPercent}%`}></span>
					{/if}
				</div>
				<div class="allocation-legend">
					<div><i class="solar-dot"></i><span>Solar energy revenue</span><strong>{formatNaira(summary.solarAccruedRevenueNgn)}</strong><small>{summary.solarPercent.toFixed(1)}% of accounted energy</small></div>
					<div><i class="grid-dot"></i><span>{sharedSupplyLabel} revenue</span><strong>{formatNaira(summary.sharedSupplyAccruedRevenueNgn)}</strong><small>{summary.gridPercent.toFixed(1)}% of accounted energy</small></div>
					{#if generatorSeparatelyMetered}<div><i class="generator-dot"></i><span>Generator energy revenue</span><strong>{formatNaira(summary.generatorAccruedRevenueNgn)}</strong><small>{summary.generatorPercent.toFixed(1)}% of accounted energy</small></div>{/if}
				</div>
			</article>

			<aside class="panel valuation">
				<div class="heading"><div><p>Consumption basis</p><h2>Register-accounted energy at Band A rate</h2></div><Zap size={18} /></div>
				<div class="value-ring" style={`--solar-share:${summary.solarPercent}%;--grid-share:${summary.solarPercent + summary.gridPercent}%`}><strong>{formatNumber(summary.totalKwh)} kWh</strong><span>{formatNaira(result.tariff.retailNgnPerKwh)} per consumed kWh</span></div>
				<div class="value-row"><span><SunMedium size={15} />Solar consumption</span><strong>{formatNumber(summary.solarKwh)} kWh</strong></div>
				<div class="value-row"><span><UtilityPole size={15} />{sharedSupplyLabel}</span><strong>{formatNumber(summary.gridKwh)} kWh</strong></div>
				<div class="value-row"><span><Fuel size={15} />Generator, separately metered</span><strong>{generatorSeparatelyMetered ? `${formatNumber(summary.generatorKwh)} kWh` : 'Pending'}</strong></div>
			</aside>
		</section>

		<section class="panel chart-panel">
			<div class="heading chart-heading"><div><p>Commercial trend</p><h2>Accrued energy revenue by source</h2></div><div class="legend"><span><i class="solar-dot"></i>Solar</span><span><i class="grid-dot"></i>{sharedSupplyLabel}</span>{#if generatorSeparatelyMetered}<span><i class="generator-dot"></i>Generator</span>{/if}</div></div>
			<div class="chart-scroll"><RevenueAllocationChart buckets={result.buckets} period={result.period} {sharedSupplyLabel} /></div>
			<div class="chart-note"><Clock3 size={15} /><span>Every reporting bucket remains visible. Each bar is consumed kWh × the configured Band A tariff; missing source readings remain visibly missing.</span></div>
		</section>

		<section class="detail-grid">
			<article class="panel reconciliation">
				<div class="heading"><div><p>Commercial reconciliation</p><h2>Revenue, collections and costs kept separate</h2></div><Scale size={18} /></div>
				<div class="recon-row"><span><Zap size={16} />Accrued energy-used revenue</span><strong>{formatNaira(summary.accruedEnergyRevenueNgn)}</strong><em>{formatNumber(summary.totalKwh)} kWh</em></div>
				<div class="recon-row"><span><ReceiptText size={16} />Provider customer-account UCH ledger</span><strong>{formatNaira(summary.customerUsageChargeNgn)}</strong><em>{summary.usageChargeTransactions} reference entries</em></div>
				<div class="recon-row"><span><Database size={16} />Source-account UCH ledger retained</span><strong>{formatNaira(summary.sourceAccountChargeNgn)}</strong><em class="missing">Not used as revenue or supplier cost</em></div>
				{#if summary.unclassifiedUsageChargeTransactions > 0}<div class="recon-row"><span><ShieldAlert size={16} />Unclassified UCH entries excluded</span><strong>{formatNaira(summary.unclassifiedUsageChargeNgn)}</strong><em class="missing">Needs account mapping</em></div>{/if}
				<div class="recon-row"><span><WalletCards size={16} />Customer credit purchases / collections</span><strong>{summary.collectionsAvailable ? formatNaira(summary.recordedPaymentNgn) : 'Not available'}</strong><em class:missing={!summary.collectionsAvailable}>{summary.collectionsAvailable ? 'Recorded separately' : 'Payment module pending'}</em></div>
				<div class="recon-row"><span><Landmark size={16} />Actual AEDC, generator and solar costs</span><strong>Not configured</strong><em class="missing">Invoices/cost inputs required</em></div>
				<div class="recon-row"><span><CircleDollarSign size={16} />Estimated operating profit</span><strong>Not available</strong><em class="missing">Requires actual source costs</em></div>
			</article>

			<aside class="panel method-panel">
				<div class="heading"><div><p>Calculation controls</p><h2>Why management can trust the boundary</h2></div><Database size={18} /></div>
				<div class="method"><span>1</span><p><strong>Revenue basis:</strong> accrued revenue is register-accounted consumed energy multiplied by the configured Band A tariff, including recovered movements after connectivity gaps.</p></div>
				<div class="method"><span>2</span><p><strong>Current source split:</strong> solar is measured separately; AEDC and generator remain combined in the conventional-supply meter until the generator meter is installed.</p></div>
				<div class="method"><span>3</span><p><strong>Collections boundary:</strong> customer credit purchases, payments and unused balances are tracked separately and never determine energy-used revenue.</p></div>
				<div class="method"><span>4</span><p><strong>Profit boundary:</strong> profit becomes available only after actual AEDC billing, generator fuel/operations and solar costs are recorded.</p></div>
				<p class="range">Future meter control: once the generator has its dedicated meter, this view will separate generator revenue and treat the internal AEDC meter as grid-only, ready for comparison with the external AEDC MD meter.</p>
				<p class="range">Ledger freshness: customer charge <strong>{summary.latestCustomerUsageChargeAt ? formatDateTime(summary.latestCustomerUsageChargeAt) : 'none in window'}</strong>; source-account charge <strong>{summary.latestSourceAccountChargeAt ? formatDateTime(summary.latestSourceAccountChargeAt) : 'none in window'}</strong>.</p>
				<p class="range">Analysis window: <strong>{formatDateTime(result.range.from)}</strong> to <strong>{formatDateTime(result.range.to)}</strong> (Africa/Lagos).</p>
			</aside>
		</section>
	{/if}
</AppShell>

<style>
	.state, .panel, .filter-panel, .truth-banner, .window-summary { border: 1px solid var(--line); border-radius: 1rem; background: var(--surface); box-shadow: var(--shadow-sm); }
	.state { padding: 1rem; color: var(--danger); }
	.periods { display: grid; grid-template-columns: repeat(5, 1fr); gap: .55rem; margin-bottom: .65rem; }
	.periods a { padding: .68rem .8rem; border: 1px solid var(--line); border-radius: .78rem; background: color-mix(in srgb, var(--surface) 82%, transparent); color: var(--text); text-decoration: none; }
	.periods a:hover, .periods a.active { border-color: var(--sky); background: var(--surface); box-shadow: var(--shadow-sm); }.periods a.active { box-shadow: inset 0 -3px 0 var(--teal), var(--shadow-sm); }
	.periods strong, .periods span, .periods small { display: block; }.periods strong { color: var(--navy); font-size: .72rem; }.periods span { margin-top: .15rem; color: var(--text-muted); font-size: .55rem; }.periods small { margin-top: .3rem; color: var(--blue); font-size: .49rem; font-weight: 800; }
	.window-summary { display: grid; grid-template-columns: minmax(12rem,.7fr) minmax(20rem,1.6fr) auto; align-items: center; gap: .8rem 1.2rem; margin-bottom: .65rem; padding: .7rem 1rem; }
	.window-summary > div { display: flex; align-items: center; gap: .6rem; color: var(--blue); }.window-summary > div span small, .window-summary > div span strong { display: block; }.window-summary > div span small { color: var(--text-muted); font-size: .48rem; }.window-summary > div span strong { margin-top: .1rem; color: var(--navy); font-size: .68rem; }
	.window-summary p { margin: 0; color: var(--navy); font-size: .58rem; font-weight: 750; }.window-summary p span, .window-summary p small { color: var(--text-muted); font-weight: 500; }.window-summary > strong { padding: .38rem .6rem; border-radius: 999px; background: var(--pale-blue); color: var(--blue); font-size: .53rem; text-transform: capitalize; white-space: nowrap; }
	.filter-panel { display: grid; grid-template-columns: minmax(12rem,.7fr) minmax(31rem,1.5fr); gap: .8rem 1.2rem; margin-bottom: .8rem; padding: .85rem 1rem; }
	.filter-title { display: flex; align-items: center; gap: .65rem; color: var(--blue); }.filter-title strong, .filter-title span { display: block; }.filter-title strong { color: var(--navy); font-size: .7rem; }.filter-title span { margin-top: .16rem; color: var(--text-muted); font-size: .53rem; }
	.filter-panel form { display: flex; align-items: flex-end; justify-content: flex-end; gap: .45rem; }.filter-panel label { display: grid; gap: .25rem; color: var(--text-muted); font-size: .5rem; font-weight: 750; }.filter-panel input, .filter-panel select { min-height: 2.15rem; box-sizing: border-box; padding: .45rem .55rem; border: 1px solid var(--line); border-radius: .55rem; background: var(--surface-soft); color: var(--text); font-size: .62rem; }.filter-panel button, .filter-panel form > a { display: inline-flex; min-height: 2.15rem; box-sizing: border-box; align-items: center; padding: .48rem .7rem; border: 0; border-radius: .55rem; background: var(--action); color: white; font-size: .58rem; font-weight: 800; text-decoration: none; cursor: pointer; }.filter-panel form > a { border: 1px solid var(--line); background: var(--surface-soft); color: var(--text); }
	.sync-status { display: flex; grid-column: 1 / -1; flex-wrap: wrap; align-items: center; gap: .45rem 1rem; padding-top: .65rem; border-top: 1px solid var(--line-soft); color: var(--text-muted); font-size: .54rem; }.sync-status span { display: inline-flex; align-items: center; gap: .35rem; }.sync-status strong { color: var(--blue); }
	.coverage-alert { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: .75rem; margin-bottom: .8rem; padding: .72rem .9rem; border: 1px solid color-mix(in srgb, var(--warning) 40%, var(--line)); border-radius: .85rem; background: color-mix(in srgb, var(--warning) 8%, var(--surface)); color: var(--warning); box-shadow: var(--shadow-sm); }.coverage-alert div strong, .coverage-alert div span { display: block; }.coverage-alert div strong { color: var(--navy); font-size: .65rem; }.coverage-alert div span { margin-top: .15rem; color: var(--text-muted); font-size: .54rem; line-height: 1.45; }.coverage-alert b { padding: .38rem .55rem; border-radius: 999px; background: color-mix(in srgb, var(--warning) 16%, var(--surface)); color: var(--warning); font-size: .54rem; white-space: nowrap; }
	.truth-banner { display: flex; align-items: center; gap: .7rem; margin-bottom: .8rem; padding: .75rem 1rem; border-color: color-mix(in srgb, var(--warning) 35%, var(--line)); background: color-mix(in srgb, var(--warning) 7%, var(--surface)); color: var(--warning); }.truth-banner strong, .truth-banner span { display: block; }.truth-banner strong { font-size: .68rem; }.truth-banner span { margin-top: .16rem; color: var(--text-muted); font-size: .56rem; line-height: 1.45; }
	.kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: .65rem; margin-bottom: .8rem; }.kpis article { display: flex; min-width: 0; align-items: center; gap: .7rem; padding: .8rem; border: 1px solid var(--line); border-radius: .85rem; background: var(--surface); box-shadow: var(--shadow-sm); }.kpi-icon { display: grid; width: 2.35rem; height: 2.35rem; flex: 0 0 auto; place-items: center; border-radius: .66rem; background: var(--pale-blue); color: var(--blue); }.kpi-icon.solar { background: color-mix(in srgb, var(--teal) 15%, var(--surface)); color: var(--teal); }.kpi-icon.grid { background: color-mix(in srgb, var(--blue) 14%, var(--surface)); color: var(--blue); }.kpi-icon.generator { background: color-mix(in srgb, var(--generator) 16%, var(--surface)); color: var(--generator); }.kpi-icon.payment { background: color-mix(in srgb, var(--success) 14%, var(--surface)); color: var(--success); }.kpis p, .kpis strong, .kpis div > span { display: block; }.kpis p { margin: 0; color: var(--text-muted); font-size: .53rem; }.kpis strong { overflow: hidden; margin-top: .18rem; color: var(--navy); font-size: .82rem; text-overflow: ellipsis; white-space: nowrap; }.kpis div > span { margin-top: .12rem; color: var(--text-muted); font-size: .48rem; }
	.hero-grid { display: grid; grid-template-columns: minmax(0,1.7fr) minmax(18rem,.65fr); gap: .8rem; margin-bottom: .8rem; }.panel { padding: 1rem; }.heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }.heading p { margin: 0 0 .3rem; color: var(--steel); font-size: .58rem; font-weight: 850; letter-spacing: .06em; text-transform: uppercase; }.heading h2 { margin: 0; color: var(--navy); font-size: 1rem; }.heading > span { padding: .38rem .6rem; border-radius: 999px; background: var(--pale-blue); color: var(--blue); font-size: .56rem; font-weight: 800; white-space: nowrap; }.heading > :global(svg) { color: var(--teal); }
	.allocation-total { margin: 1.4rem 0 .7rem; }.allocation-total span, .allocation-total small { display: block; color: var(--text-muted); font-size: .55rem; }.allocation-total strong { display: block; margin: .22rem 0; color: var(--navy); font-size: 1.65rem; }.allocation-bar { display: flex; height: 1.1rem; overflow: hidden; border-radius: 999px; background: var(--line-soft); }.solar-segment { background: linear-gradient(90deg,var(--teal),var(--sky)); }.grid-segment { background: linear-gradient(90deg,var(--nav-surface),var(--blue)); }.generator-segment { background: var(--generator); }
	.allocation-legend { display: grid; grid-template-columns: repeat(2,1fr); gap: .5rem; margin-top: 1rem; }.allocation-legend div { display: grid; grid-template-columns: auto 1fr auto; gap: .35rem .5rem; align-items: center; padding: .68rem; border: 1px solid var(--line-soft); border-radius: .72rem; }.allocation-legend i, .legend i { width: .6rem; height: .6rem; border-radius: .18rem; }.allocation-legend span { color: var(--text-muted); font-size: .55rem; }.allocation-legend strong { color: var(--navy); font-size: .67rem; }.allocation-legend small { grid-column: 2 / -1; color: var(--text-muted); font-size: .48rem; }
	.solar-dot { background: var(--teal); }.grid-dot { background: var(--nav-surface); }.generator-dot { background: var(--generator); }
	.valuation { display: flex; flex-direction: column; }.value-ring { display: grid; min-height: 8rem; margin: 1rem 0; place-content: center; border-radius: .9rem; background: radial-gradient(circle at 50% 50%,var(--surface) 0 42%,transparent 43%), conic-gradient(var(--teal) 0 var(--solar-share),var(--nav-surface) var(--solar-share) var(--grid-share),var(--generator) var(--grid-share) 100%); text-align: center; }.value-ring strong { color: var(--navy); font-size: 1.2rem; }.value-ring span { margin-top: .2rem; color: var(--text-muted); font-size: .5rem; }.value-row { display: flex; align-items: center; justify-content: space-between; gap: .5rem; padding: .55rem 0; border-top: 1px solid var(--line-soft); }.value-row span { display: flex; align-items: center; gap: .4rem; color: var(--text-muted); font-size: .55rem; }.value-row strong { color: var(--navy); font-size: .62rem; }
	.chart-panel { margin-bottom: .8rem; }.chart-heading { align-items: center; margin-bottom: 1rem; }.legend { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: .7rem; }.legend span { display: flex; align-items: center; gap: .3rem; color: var(--text-muted); font-size: .54rem; }.chart-scroll { overflow-x: auto; padding: .4rem .2rem .2rem; }.chart-note { display: flex; align-items: center; gap: .45rem; margin-top: .65rem; padding-top: .65rem; border-top: 1px solid var(--line-soft); color: var(--text-muted); font-size: .56rem; }
	.detail-grid { display: grid; grid-template-columns: 1.1fr 1fr; gap: .8rem; }.reconciliation .heading, .method-panel .heading { margin-bottom: .8rem; }.recon-row { display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: .6rem; padding: .7rem 0; border-top: 1px solid var(--line-soft); }.recon-row span { display: flex; align-items: center; gap: .45rem; color: var(--text-muted); font-size: .58rem; }.recon-row strong { color: var(--navy); font-size: .64rem; }.recon-row em { padding: .25rem .42rem; border-radius: 999px; background: color-mix(in srgb,var(--success) 12%,var(--surface)); color: var(--success); font-size: .48rem; font-style: normal; font-weight: 800; }.recon-row em.missing { background: color-mix(in srgb,var(--warning) 15%,var(--surface)); color: var(--warning); }
	.method { display: grid; grid-template-columns: auto 1fr; gap: .55rem; margin-bottom: .55rem; }.method > span { display: grid; width: 1.5rem; height: 1.5rem; place-items: center; border-radius: 50%; background: var(--pale-blue); color: var(--blue); font-size: .56rem; font-weight: 850; }.method p { margin: 0; color: var(--text-muted); font-size: .59rem; line-height: 1.5; }.method strong { color: var(--navy); }.range { margin: .75rem 0 0; padding: .65rem; border-radius: .65rem; background: var(--surface-soft); color: var(--text-muted); font-size: .55rem; line-height: 1.5; }.range strong { color: var(--navy); }
	@media (max-width: 1300px) { .periods { grid-template-columns: repeat(3,1fr); }.window-summary { grid-template-columns: 1fr auto; }.window-summary p { grid-column: 1 / -1; grid-row: 2; }.kpis { grid-template-columns: repeat(3,1fr); }.filter-panel { grid-template-columns: 1fr; }.filter-panel form { justify-content: flex-start; }.sync-status { grid-column: 1; } }
	@media (max-width: 1050px) { .hero-grid, .detail-grid { grid-template-columns: 1fr; } }
	@media (max-width: 700px) { .periods, .window-summary { grid-template-columns: 1fr; }.window-summary p, .window-summary > strong { grid-column: 1; grid-row: auto; }.window-summary > strong { justify-self: start; }.coverage-alert { grid-template-columns: auto 1fr; }.coverage-alert b { grid-column: 2; justify-self: start; }.filter-panel form { align-items: stretch; flex-direction: column; }.filter-panel form > a, .filter-panel button { justify-content: center; }.kpis, .allocation-legend { grid-template-columns: 1fr; }.chart-heading { align-items: flex-start; flex-direction: column; }.legend { justify-content: flex-start; }.recon-row { grid-template-columns: 1fr auto; }.recon-row em { grid-column: 2; } }
</style>
