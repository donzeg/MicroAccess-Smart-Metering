<script lang="ts">
	import {
		Activity,
		CalendarRange,
		CircleDollarSign,
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
	import InfoPopover from '#lib/components/InfoPopover.svelte';
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
			<InfoPopover title="Data refresh schedule" label="Explain data refresh" align="left"><p>Meter readings and provider ledgers normally arrive hourly. MSM checks this view every 15 minutes.</p></InfoPopover>
			<strong>Next check {countdownLabel(autoRefreshIn)}</strong>
			{#if result}<span>Last synced {formatDateTime(result.dataSource.retrievedAt)}{result.dataSource.cached ? ' · short cache used' : ' · provider checked'}</span>{/if}
		</div>
	</section>

	{#if data.error}
		<section class="state">{data.error.message}</section>
	{:else if result && summary}
		{#if missingIntervals > 0 || summary.registerRecoveredKwh > 0}
			<div class="coverage-summary" aria-label="Revenue data coverage">
				<span><Activity size={15} /><strong>{summary.coveragePercent.toFixed(1)}% interval detail</strong></span>
				<InfoPopover title="Coverage and recovered valuation" label="Explain revenue coverage">
					<p>{missingIntervals} hourly detail {missingIntervals === 1 ? 'interval is' : 'intervals are'} unavailable in this window.</p>
					<p>The valuation still includes {formatNumber(summary.registerRecoveredKwh)} kWh recovered from cumulative-register movement after connectivity returned. Recovery changes totals without inventing missing hourly timestamps.</p>
				</InfoPopover>
			</div>
		{/if}

		<section class="kpis">
			<article><span class="kpi-icon"><Zap size={18} /></span><div class="kpi-copy"><p>Accrued energy revenue</p><div class="kpi-energy"><strong>{formatNumber(summary.totalKwh)} <small>kWh</small></strong></div><div class="kpi-commercial"><span>100%</span><strong>{formatNaira(summary.accruedEnergyRevenueNgn)}</strong></div><small class="kpi-note">Across {result.tariff.versionsApplied} effective tariff version(s)</small></div></article>
			<article><span class="kpi-icon solar"><SunMedium size={18} /></span><div class="kpi-copy"><p>Solar energy revenue</p><div class="kpi-energy"><strong>{formatNumber(summary.solarKwh)} <small>kWh</small></strong></div><div class="kpi-commercial"><span>{summary.solarPercent.toFixed(1)}%</span><strong>{formatNaira(summary.solarAccruedRevenueNgn)}</strong></div></div></article>
			<article><span class="kpi-icon grid"><UtilityPole size={18} /></span><div class="kpi-copy"><p>{sharedSupplyLabel} revenue</p><div class="kpi-energy"><strong>{formatNumber(summary.gridKwh)} <small>kWh</small></strong></div><div class="kpi-commercial"><span>{summary.gridPercent.toFixed(1)}%</span><strong>{formatNaira(summary.sharedSupplyAccruedRevenueNgn)}</strong></div></div></article>
			<article><span class="kpi-icon generator"><Fuel size={18} /></span><div class="kpi-copy"><p>Generator revenue</p>{#if generatorSeparatelyMetered}<div class="kpi-energy"><strong>{formatNumber(summary.generatorKwh)} <small>kWh</small></strong></div><div class="kpi-commercial"><span>{summary.generatorPercent.toFixed(1)}%</span><strong>{formatNaira(summary.generatorAccruedRevenueNgn)}</strong></div>{:else}<strong class="kpi-status">Included in shared supply</strong><small class="kpi-note">Dedicated generator meter pending</small>{/if}</div></article>
			<article><span class="kpi-icon payment"><WalletCards size={18} /></span><div class="kpi-copy"><p>Actual collections</p><strong class="kpi-status">{summary.collectionsAvailable ? formatNaira(summary.recordedPaymentNgn) : 'Not available'}</strong><small class="kpi-note">{summary.collectionsAvailable ? `${summary.paymentTransactions} PAY entries` : 'Credit-purchase/payment module pending'}</small></div></article>
		</section>

		<section class="hero-grid">
			<article class="panel allocation">
				<div class="heading"><div><p>Energy-used revenue split</p><h2>What the consumed energy generated</h2></div><div class="heading-actions"><span>{summary.coveragePercent.toFixed(1)}% hourly detail</span><InfoPopover title="How accrued energy revenue is calculated" label="Explain accrued revenue">
					<p>Revenue follows energy consumed, not the date a customer purchased credit. Every register-accounted kWh is valued with the tariff effective on that date.</p>
					<p>The current Band {result.tariff.tariffBand} rate is {formatNaira(result.tariff.retailNgnPerKwh)} and {result.tariff.versionsApplied} tariff version(s) apply in this window. Collections and operating costs remain separate.</p>
				</InfoPopover></div></div>
				<div class="allocation-total"><span>Accrued revenue from register-accounted consumption</span><strong>{formatNumber(summary.totalKwh)} kWh</strong><div><b>100%</b><em>{formatNaira(summary.accruedEnergyRevenueNgn)}</em></div><small>Valued at the configured Band A tariff, including recovered connectivity-gap movement</small></div>
				<div class="allocation-bar" aria-label="Accrued energy revenue by supply source">
					{#if summary.accruedEnergyRevenueNgn > 0}
						<span class="solar-segment" style={`width:${summary.solarPercent}%`}></span>
						<span class="grid-segment" style={`width:${summary.gridPercent}%`}></span>
						<span class="generator-segment" style={`width:${summary.generatorPercent}%`}></span>
					{/if}
				</div>
				<div class="allocation-legend">
					<div><i class="solar-dot"></i><span>Solar energy</span><strong>{formatNumber(summary.solarKwh)} kWh</strong><small><b>{summary.solarPercent.toFixed(1)}%</b><em>{formatNaira(summary.solarAccruedRevenueNgn)}</em></small></div>
					<div><i class="grid-dot"></i><span>{sharedSupplyLabel}</span><strong>{formatNumber(summary.gridKwh)} kWh</strong><small><b>{summary.gridPercent.toFixed(1)}%</b><em>{formatNaira(summary.sharedSupplyAccruedRevenueNgn)}</em></small></div>
					{#if generatorSeparatelyMetered}<div><i class="generator-dot"></i><span>Generator energy</span><strong>{formatNumber(summary.generatorKwh)} kWh</strong><small><b>{summary.generatorPercent.toFixed(1)}%</b><em>{formatNaira(summary.generatorAccruedRevenueNgn)}</em></small></div>{/if}
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
			<div class="heading chart-heading"><div><p>Commercial trend</p><h2>Accrued energy revenue by source</h2></div><div class="heading-actions"><div class="legend"><span><i class="solar-dot"></i>Solar</span><span><i class="grid-dot"></i>{sharedSupplyLabel}</span>{#if generatorSeparatelyMetered}<span><i class="generator-dot"></i>Generator</span>{/if}</div><InfoPopover title="How to read this chart" label="Explain the commercial trend"><p>Each bar is consumed kWh multiplied by the tariff effective for that period. Every reporting bucket remains visible, and missing source readings are not converted to zero.</p></InfoPopover></div></div>
			<div class="chart-scroll"><RevenueAllocationChart buckets={result.buckets} period={result.period} {sharedSupplyLabel} /></div>
		</section>

		<section class="panel reconciliation">
				<div class="heading"><div><p>Commercial reconciliation</p><h2>Revenue, collections and costs</h2></div><div class="heading-actions"><Scale size={18} /><InfoPopover title="Commercial calculation boundaries" label="Explain commercial reconciliation">
					<ul>
						<li><strong>Revenue:</strong> register-accounted consumed energy multiplied by its effective tariff, including recovered connectivity-gap movement.</li>
						<li><strong>Source split:</strong> solar is separate; AEDC and generator remain combined until the generator meter is installed.</li>
						<li><strong>Collections:</strong> credit purchases and unused balances are recorded separately and never determine energy-used revenue.</li>
						<li><strong>Profit:</strong> available only after actual AEDC, generator and solar costs are recorded.</li>
					</ul>
					<p>Latest customer charge: <strong>{summary.latestCustomerUsageChargeAt ? formatDateTime(summary.latestCustomerUsageChargeAt) : 'none in window'}</strong>. Latest source-account charge: <strong>{summary.latestSourceAccountChargeAt ? formatDateTime(summary.latestSourceAccountChargeAt) : 'none in window'}</strong>.</p>
				</InfoPopover></div></div>
				<div class="recon-row"><span><Zap size={16} />Accrued energy-used revenue</span><strong>{formatNaira(summary.accruedEnergyRevenueNgn)}</strong><em>{formatNumber(summary.totalKwh)} kWh</em></div>
				<div class="recon-row"><span><ReceiptText size={16} />Provider customer-account UCH ledger</span><strong>{formatNaira(summary.customerUsageChargeNgn)}</strong><em>{summary.usageChargeTransactions} reference entries</em></div>
				<div class="recon-row"><span><Database size={16} />Source-account UCH ledger retained</span><strong>{formatNaira(summary.sourceAccountChargeNgn)}</strong><em class="missing">Not used as revenue or supplier cost</em></div>
				{#if summary.unclassifiedUsageChargeTransactions > 0}<div class="recon-row"><span><ShieldAlert size={16} />Unclassified UCH entries excluded</span><strong>{formatNaira(summary.unclassifiedUsageChargeNgn)}</strong><em class="missing">Needs account mapping</em></div>{/if}
				<div class="recon-row"><span><WalletCards size={16} />Customer credit purchases / collections</span><strong>{summary.collectionsAvailable ? formatNaira(summary.recordedPaymentNgn) : 'Not available'}</strong><em class:missing={!summary.collectionsAvailable}>{summary.collectionsAvailable ? 'Recorded separately' : 'Payment module pending'}</em></div>
				<div class="recon-row"><span><Landmark size={16} />Actual AEDC, generator and solar costs</span><strong>Not configured</strong><em class="missing">Invoices/cost inputs required</em></div>
				<div class="recon-row"><span><CircleDollarSign size={16} />Estimated operating profit</span><strong>Not available</strong><em class="missing">Requires actual source costs</em></div>
		</section>
	{/if}
</AppShell>

<style>
	.state, .panel, .filter-panel, .window-summary { border: 1px solid var(--line); border-radius: 1rem; background: var(--surface); box-shadow: var(--shadow-sm); }
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
	.coverage-summary { display: flex; align-items: center; justify-content: flex-end; gap: .45rem; margin: -.2rem 0 .65rem; }.coverage-summary > span { display: inline-flex; align-items: center; gap: .35rem; padding: .32rem .5rem; border-radius: 999px; background: color-mix(in srgb, var(--warning) 12%, var(--surface)); color: var(--warning); font-size: .54rem; }
	.kpis { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: .65rem; margin-bottom: .8rem; }
	.kpis article { display: flex; min-width: 0; align-items: flex-start; gap: .72rem; padding: .85rem; border: 1px solid var(--line); border-radius: .85rem; background: var(--surface); box-shadow: var(--shadow-sm); }
	.kpi-copy { min-width: 0; flex: 1; }
	.kpi-icon { display: grid; width: 2.45rem; height: 2.45rem; flex: 0 0 auto; place-items: center; border-radius: .68rem; background: var(--pale-blue); color: var(--blue); }
	.kpi-icon.solar { background: color-mix(in srgb, var(--teal) 15%, var(--surface)); color: var(--teal); }.kpi-icon.grid { background: color-mix(in srgb, var(--blue) 14%, var(--surface)); color: var(--blue); }.kpi-icon.generator { background: color-mix(in srgb, var(--generator) 16%, var(--surface)); color: var(--generator); }.kpi-icon.payment { background: color-mix(in srgb, var(--success) 14%, var(--surface)); color: var(--success); }
	.kpis p { margin: 0; color: var(--text); font-size: .64rem; font-weight: 700; line-height: 1.35; }
	.kpi-energy strong { display: block; margin-top: .32rem; color: var(--navy); font-size: 1.08rem; line-height: 1.15; white-space: nowrap; }
	.kpi-energy strong small { font-size: .65rem; font-weight: 750; }
	.kpi-commercial { display: flex; min-width: 0; align-items: center; justify-content: space-between; gap: .38rem; margin-top: .42rem; padding-top: .42rem; border-top: 1px solid var(--line-soft); }
	.kpi-commercial span { flex: 0 0 auto; padding: .2rem .38rem; border-radius: 999px; background: var(--pale-blue); color: var(--blue); font-size: .6rem; font-weight: 850; }
	.kpi-commercial strong { min-width: 0; overflow: hidden; color: var(--navy); font-size: .8rem; text-overflow: ellipsis; white-space: nowrap; }
	.kpi-status { display: block; margin-top: .42rem; overflow-wrap: anywhere; color: var(--navy); font-size: .82rem; line-height: 1.25; }
	.kpi-note { display: block; margin-top: .32rem; color: var(--text); font-size: .58rem; line-height: 1.4; }
	.hero-grid { display: grid; grid-template-columns: minmax(0,1.7fr) minmax(18rem,.65fr); gap: .8rem; margin-bottom: .8rem; }.panel { padding: 1rem; }.heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }.heading p { margin: 0 0 .3rem; color: var(--steel); font-size: .58rem; font-weight: 850; letter-spacing: .06em; text-transform: uppercase; }.heading h2 { margin: 0; color: var(--navy); font-size: 1rem; }.heading > :global(svg) { color: var(--teal); }
	.heading-actions { display: flex; align-items: center; justify-content: flex-end; gap: .5rem; }.heading-actions > span { padding: .38rem .6rem; border-radius: 999px; background: var(--pale-blue); color: var(--blue); font-size: .56rem; font-weight: 800; white-space: nowrap; }.heading-actions > :global(svg) { color: var(--teal); }
	.allocation-total { margin: 1.25rem 0 .75rem; }
	.allocation-total > span { display: block; color: var(--text); font-size: .66rem; font-weight: 650; }
	.allocation-total > strong { display: block; margin: .28rem 0; color: var(--navy); font-size: 1.72rem; }
	.allocation-total > div { display: flex; align-items: center; gap: .55rem; margin-bottom: .35rem; }
	.allocation-total b { padding: .22rem .44rem; border-radius: 999px; background: var(--pale-blue); color: var(--blue); font-size: .66rem; }
	.allocation-total em { color: var(--navy); font-size: 1rem; font-style: normal; font-weight: 850; }
	.allocation-total small { display: block; color: var(--text); font-size: .62rem; line-height: 1.4; }
	.allocation-bar { display: flex; height: 1.1rem; overflow: hidden; border-radius: 999px; background: var(--line-soft); }.solar-segment { background: linear-gradient(90deg,var(--teal),var(--sky)); }.grid-segment { background: linear-gradient(90deg,var(--nav-surface),var(--blue)); }.generator-segment { background: var(--generator); }
	.allocation-legend { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: .5rem; margin-top: 1rem; }
	.allocation-legend div { display: grid; min-width: 0; grid-template-columns: auto minmax(0,1fr) auto; gap: .35rem .5rem; align-items: center; padding: .72rem; border: 1px solid var(--line-soft); border-radius: .72rem; background: var(--surface-soft); }
	.allocation-legend i, .legend i { width: .65rem; height: .65rem; border-radius: .18rem; }
	.allocation-legend span { min-width: 0; color: var(--text); font-size: .64rem; font-weight: 700; }
	.allocation-legend > div > strong { color: var(--navy); font-size: .78rem; white-space: nowrap; }
	.allocation-legend small { display: flex; grid-column: 2 / -1; align-items: center; justify-content: space-between; gap: .5rem; color: var(--text); font-size: .62rem; }
	.allocation-legend small b { padding: .18rem .36rem; border-radius: 999px; background: var(--pale-blue); color: var(--blue); }
	.allocation-legend small em { color: var(--navy); font-size: .72rem; font-style: normal; font-weight: 850; }
	.solar-dot { background: var(--teal); }.grid-dot { background: var(--nav-surface); }.generator-dot { background: var(--generator); }
	.valuation { display: flex; flex-direction: column; }.value-ring { display: grid; min-height: 8rem; margin: 1rem 0; place-content: center; border-radius: .9rem; background: radial-gradient(circle at 50% 50%,var(--surface) 0 42%,transparent 43%), conic-gradient(var(--teal) 0 var(--solar-share),var(--nav-surface) var(--solar-share) var(--grid-share),var(--generator) var(--grid-share) 100%); text-align: center; }.value-ring strong { color: var(--navy); font-size: 1.3rem; }.value-ring span { margin-top: .24rem; color: var(--text); font-size: .62rem; font-weight: 650; }.value-row { display: flex; align-items: center; justify-content: space-between; gap: .5rem; padding: .65rem 0; border-top: 1px solid var(--line-soft); }.value-row span { display: flex; align-items: center; gap: .4rem; color: var(--text); font-size: .64rem; }.value-row strong { color: var(--navy); font-size: .72rem; }
	.chart-panel { margin-bottom: .8rem; }.chart-heading { align-items: center; margin-bottom: 1rem; }.legend { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: .7rem; }.legend span { display: flex; align-items: center; gap: .3rem; color: var(--text-muted); font-size: .66rem; }.chart-scroll { overflow-x: auto; padding: .4rem .2rem .55rem; scrollbar-gutter: stable; overscroll-behavior-inline: contain; }
	.reconciliation .heading { margin-bottom: .8rem; }.recon-row { display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: .6rem; padding: .75rem 0; border-top: 1px solid var(--line-soft); }.recon-row span { display: flex; align-items: center; gap: .45rem; color: var(--text); font-size: .66rem; }.recon-row strong { color: var(--navy); font-size: .72rem; }.recon-row em { padding: .28rem .46rem; border-radius: 999px; background: color-mix(in srgb,var(--success) 12%,var(--surface)); color: var(--success); font-size: .56rem; font-style: normal; font-weight: 800; }.recon-row em.missing { background: color-mix(in srgb,var(--warning) 15%,var(--surface)); color: var(--warning); }
	@media (max-width: 1300px) { .periods { grid-template-columns: repeat(3,1fr); }.window-summary { grid-template-columns: 1fr auto; }.window-summary p { grid-column: 1 / -1; grid-row: 2; }.kpis { grid-template-columns: repeat(3,1fr); }.filter-panel { grid-template-columns: 1fr; }.filter-panel form { justify-content: flex-start; }.sync-status { grid-column: 1; } }
	@media (max-width: 1050px) { .hero-grid { grid-template-columns: 1fr; } }
	@media (max-width: 899px) { .periods { grid-template-columns: repeat(2,1fr); }.kpis { grid-template-columns: repeat(2,minmax(0,1fr)); }.chart-scroll { border-right: 1px solid var(--line-soft); border-left: 1px solid var(--line-soft); } }
	@media (max-width: 599px) { .periods, .window-summary { grid-template-columns: 1fr; }.window-summary p, .window-summary > strong { grid-column: 1; grid-row: auto; }.window-summary > strong { justify-self: start; }.filter-panel form { align-items: stretch; flex-direction: column; }.filter-panel form > a, .filter-panel button { min-height: 2.75rem; justify-content: center; }.kpis, .allocation-legend { grid-template-columns: 1fr; }.chart-heading { align-items: flex-start; flex-direction: column; }.heading-actions { align-items: flex-start; }.chart-heading .heading-actions { width: 100%; }.legend { justify-content: flex-start; }.recon-row { grid-template-columns: 1fr auto; }.recon-row em { grid-column: 2; } }
</style>
