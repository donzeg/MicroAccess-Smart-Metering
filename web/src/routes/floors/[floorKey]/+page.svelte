<script lang="ts">
	import {
		ArrowLeft,
		CalendarRange,
		CircleDollarSign,
		Clock3,
		Database,
		Gauge,
		MapPinned,
		RadioTower,
		Store,
		Users
	} from '@lucide/svelte';
	import { onMount } from 'svelte';
	import AppShell from '#lib/components/AppShell.svelte';
	import FloorTrendChart from '#lib/components/FloorTrendChart.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import { formatDateTime, formatNaira, formatNumber } from '#lib/format.js';
	import type { EnergyMixPeriod } from '#lib/types.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const periodOptions: Array<{ key: EnergyMixPeriod; label: string; detail: string }> = [
		{ key: 'hourly', label: 'Hourly', detail: 'Last 24 hours' },
		{ key: 'daily', label: 'Daily', detail: 'Last 30 days' },
		{ key: 'weekly', label: 'Weekly', detail: 'Last 12 weeks' },
		{ key: 'monthly', label: 'Monthly', detail: 'Last 12 months' }
	];
	let result = $derived(data.floorAnalysis);
	let floor = $derived(result?.floors.find((item) => item.key === data.floorKey) ?? null);
	let positions = $derived((result?.positions ?? []).filter((position) => position.floorKey === data.floorKey));
	let namedTenants = $derived(positions.filter((position) => position.occupancyStatus === 'named_tenant').length);
	let rangeQuery = $derived(data.customRange
		? `period=${data.period}&from=${data.customRange.from}&to=${data.customRange.to}`
		: `period=${data.period}`);
	let refreshHref = $derived(`/floors/${data.floorKey}?${rangeQuery}&refresh=true`);
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
	const occupancyLabel = (status: string): string => status === 'named_tenant'
		? 'Named tenant'
		: status === 'estate_placeholder'
			? 'Estate placeholder'
			: 'Tenant not recorded';
	const mappingLabel = (evidence: string): string => evidence === 'structured_name'
		? 'Descriptive floor name'
		: evidence === 'legacy_code'
			? 'Legacy position code'
				: 'Needs classification';
	const tenancySourceLabel = (source: string | null): string => source === 'management_record'
		? 'Management-confirmed'
		: source === 'provider_snapshot'
			? 'Observed from SteamaCo'
			: 'Not tracked';
</script>

<svelte:head><title>{floor?.label ?? 'Floor'} | MicroAccess Smart Metering</title></svelte:head>

<AppShell active="floors">
	<div class="breadcrumb"><a href={`/floors?${rangeQuery}`}><ArrowLeft size={15} />All floors</a><span>/</span><strong>{floor?.label ?? 'Floor detail'}</strong></div>
	<PageHeader
		eyebrow="Na-Aka Hub floor operations"
		title={floor?.label ?? 'Floor detail'}
		description="Review the permanent unit positions on this floor, the current tenant recorded against each position, assigned meters and interval consumption."
		{refreshHref}
	/>

	<nav class="periods" aria-label="Floor detail presets">
		{#each periodOptions as option (option.key)}
			<a class:active={data.period === option.key && !data.customRange} href={`/floors/${data.floorKey}?period=${option.key}`}><strong>{option.label}</strong><span>{option.detail}</span></a>
		{/each}
	</nav>

	<section class="filter-panel" aria-label="Custom floor detail filter">
		<div class="filter-title"><CalendarRange size={18} /><div><strong>Custom floor window</strong><span>Choose exact dates and the trend grouping for this floor.</span></div></div>
		<form method="GET" action={`/floors/${data.floorKey}`}>
			<label>From<input type="date" name="from" value={data.customRange?.from ?? ''} max={data.today} required /></label>
			<label>To<input type="date" name="to" value={data.customRange?.to ?? ''} max={data.today} required /></label>
			<label>Group by<select name="period" value={data.period}>{#each periodOptions as option (option.key)}<option value={option.key}>{option.label}</option>{/each}</select></label>
			<button type="submit">Apply filter</button>
			{#if data.customRange}<a href={`/floors/${data.floorKey}?period=${data.period}`}>Clear custom dates</a>{/if}
		</form>
		<div class="sync-status"><span><Clock3 size={15} /> Hourly provider data; MSM checks every 15 minutes.</span><strong>Next check {countdownLabel(autoRefreshIn)}</strong>{#if result}<span>Last synced {formatDateTime(result.dataSource.retrievedAt)}{result.dataSource.cached ? ' · short cache used' : ' · provider checked'}</span>{/if}</div>
	</section>

	{#if data.error}
		<section class="state">{data.error.message}</section>
	{:else if result && floor}
		{#if form?.message}
			<div class:success={form.success} class="form-message">{form.message}</div>
		{/if}
		<section class="kpis">
			<article><span class="kpi-icon"><Gauge size={18} /></span><div><p>Floor consumption</p><strong>{formatNumber(floor.usageKwh)} <small>kWh</small></strong><span>{floor.sharePercent.toFixed(1)}% of recorded tenant usage</span></div></article>
			<article><span class="kpi-icon money"><CircleDollarSign size={18} /></span><div><p>Provisional value</p><strong>{formatNaira(floor.estimatedValueNgn)}</strong><span>{formatNaira(result.tariff.retailNgnPerKwh)} per kWh</span></div></article>
			<article><span class="kpi-icon"><Store size={18} /></span><div><p>Permanent positions</p><strong>{floor.positionCount}</strong><span>{namedTenants} named tenants recorded</span></div></article>
			<article><span class="kpi-icon"><RadioTower size={18} /></span><div><p>Assigned meters</p><strong>{floor.onlineMeterCount} <small>of {floor.meterCount} online</small></strong><span>{floor.meteredPositionCount} metered positions</span></div></article>
			<article><span class="kpi-icon"><Database size={18} /></span><div><p>Reading coverage</p><strong>{floor.coveragePercent.toFixed(1)}<small>%</small></strong><span>{floor.reportingPositionCount} positions reported</span></div></article>
		</section>

		<section class="panel trend-panel">
			<div class="heading"><div><p>Consumption trend</p><h2>{floor.label} interval usage</h2></div><span>{formatNumber(floor.usageKwh)} kWh total</span></div>
			<div class="chart-scroll"><FloorTrendChart buckets={result.buckets} floorKey={floor.key} period={result.period} /></div>
			<div class="chart-note"><Clock3 size={15} /><span>Each bar is the sum of interval usage from meters currently assigned to positions on this floor. A dash means no reading was returned for that bucket.</span></div>
		</section>

		<section class="panel positions-panel">
			<div class="heading"><div><p>Position register</p><h2>Units, current occupants and meters</h2></div><span>{positions.length} positions</span></div>
			<div class="table-wrap"><table>
				<thead><tr><th>Permanent position</th><th>Current tenant record</th><th>Assigned meter</th><th>Connectivity</th><th>Usage</th><th>Provisional value</th><th>Reading coverage</th><th>Provider naming</th></tr></thead>
				<tbody>{#each positions as position (position.customerId)}<tr>
					<td><a href={`/customers/${position.customerId}`}><strong>{position.positionLabel}</strong><span>{position.providerPositionName}</span></a></td>
					<td><a href={`#tenancy-${position.customerId}`}><strong>{position.tenantName}</strong><span class:tenant={position.occupancyStatus === 'named_tenant'}>{tenancySourceLabel(position.tenantRecordSource)}</span>{#if position.providerTenantDrift}<span class="drift">Provider name needs review</span>{/if}</a></td>
					<td>{#if position.meterCount > 0}<a href={`/meters/${position.meterIds[0]}`}><strong>{position.meterNumbers.join(', ')}</strong><span>{position.meterCount} assigned</span></a>{:else}<em>Not assigned</em>{/if}</td>
					<td><span class:online={position.onlineMeterCount > 0} class="status"><i></i>{position.onlineMeterCount} / {position.meterCount} online</span></td>
					<td><strong>{formatNumber(position.usageKwh)} kWh</strong><span>{position.observedIntervals} intervals</span></td>
					<td><strong>{formatNaira(position.estimatedValueNgn)}</strong><span>Provisional</span></td>
					<td><span class="coverage"><i style={`width:${Math.min(100, position.coveragePercent)}%`}></i></span><small>{position.coveragePercent.toFixed(1)}%</small></td>
					<td><span>{mappingLabel(position.mappingEvidence)}</span></td>
				</tr>{:else}<tr><td colspan="8" class="empty">No customer positions are currently classified on this floor.</td></tr>{/each}</tbody>
			</table></div>
		</section>

		<section class="panel tenancy-panel">
			<div class="heading"><div><p>Effective-dated tenant register</p><h2>Preserve occupant history by permanent position</h2></div><span>{positions.filter((position) => position.tenantRecordSource === 'management_record').length} management-confirmed</span></div>
			<p class="section-intro">A new entry starts at the effective date and automatically closes the previous occupant at that same time. This changes only MSM's local reporting history; it does not write to SteamaCo.</p>
			<div class="tenancy-grid">
				{#each positions as position (position.customerId)}
					<article id={`tenancy-${position.customerId}`} class:drift-card={position.providerTenantDrift}>
						<header><div><strong>{position.positionLabel}</strong><span>{position.providerPositionName}</span></div><span class="source">{tenancySourceLabel(position.tenantRecordSource)}</span></header>
						<div class="current-tenant"><span>Current MSM tenant</span><strong>{position.tenantName}</strong><small>SteamaCo now shows: {position.providerTenantName || 'blank'}</small></div>
						{#if position.providerTenantDrift}<div class="drift-notice">The provider name differs from the approved MSM record. Review before changing history.</div>{/if}
						<div class="attribution"><span><strong>{position.tenantAttributionCoveragePercent.toFixed(1)}%</strong> of selected usage is tenant-attributed</span><small>{formatNumber(position.attributedUsageKwh)} kWh attributed · {formatNumber(position.unattributedUsageKwh)} kWh unassigned</small></div>
						<div class="history">
							{#each [...position.tenancyHistory].reverse() as tenancy (tenancy.id)}
								<div><strong>{tenancy.tenantName}</strong><span>{formatDateTime(tenancy.effectiveFrom)} → {tenancy.effectiveTo ? formatDateTime(tenancy.effectiveTo) : 'Current'}</span><small>{tenancySourceLabel(tenancy.source)}</small></div>
							{:else}<em>No effective-dated history has been recorded.</em>{/each}
						</div>
						<form method="POST" action="?/recordTenancy">
							<input type="hidden" name="providerCustomerId" value={position.customerId} />
							<label>Tenant or organisation<input name="tenantName" value={position.providerTenantName || position.tenantName} maxlength="160" required /></label>
							<label>Effective from<input type="datetime-local" name="effectiveFrom" value={data.nowLocal} max={data.nowLocal} required /></label>
							<label>Evidence or note<input name="evidenceReference" value="management_confirmed" maxlength="240" required /></label>
							<button type="submit">Record tenant change</button>
						</form>
					</article>
				{/each}
			</div>
		</section>

		<section class="detail-grid">
			<article class="panel position-rule">
				<div class="heading"><div><p>Stable premises model</p><h2>How this floor will retain history</h2></div><MapPinned size={18} /></div>
				<p>The position stays permanent even when a tenant leaves. MSM now stores effective start and end dates locally, attributes readings only where the tenant period is known, and leaves earlier usage visibly unattributed instead of assigning it to the current occupant.</p>
			</article>
			<aside class="panel quality">
				<div class="heading"><div><p>Data boundary</p><h2>Interpretation for this view</h2></div><Users size={18} /></div>
				<ul><li>Source and Power Room meters are excluded from tenant floors.</li><li>Positions with no meter remain visible with zero recorded consumption.</li><li>Missing readings are not converted to zero usage.</li><li>Naira values are estimates, not payment collections.</li></ul>
				<p>Window: <strong>{formatDateTime(result.range.from)}</strong> to <strong>{formatDateTime(result.range.to)}</strong>.</p>
			</aside>
		</section>
	{:else}
		<section class="state">This floor is not present in the current provider position register.</section>
	{/if}
</AppShell>

<style>
	.breadcrumb { display: flex; align-items: center; gap: .4rem; padding-top: 1rem; color: var(--text-muted); font-size: .58rem; }.breadcrumb a { display: inline-flex; align-items: center; gap: .3rem; color: var(--blue); text-decoration: none; }.breadcrumb strong { color: var(--navy); }
	.state,.panel,.filter-panel { border: 1px solid var(--line); border-radius: 1rem; background: var(--surface); box-shadow: var(--shadow-sm); }.state { padding: 1rem; color: var(--danger); }
	.form-message { margin-bottom: .7rem; padding: .7rem .85rem; border: 1px solid color-mix(in srgb,var(--danger) 35%,var(--line)); border-radius: .7rem; background: color-mix(in srgb,var(--danger) 8%,var(--surface)); color: var(--danger); font-size: .6rem; font-weight: 750; }.form-message.success { border-color: color-mix(in srgb,var(--success) 35%,var(--line)); background: color-mix(in srgb,var(--success) 9%,var(--surface)); color: var(--success); }
	.periods { display: grid; grid-template-columns: repeat(4,1fr); gap: .55rem; margin-bottom: .65rem; }.periods a { padding: .68rem .8rem; border: 1px solid var(--line); border-radius: .78rem; background: color-mix(in srgb,var(--surface) 82%,transparent); color: var(--text); text-decoration: none; }.periods a:hover,.periods a.active { border-color: var(--sky); background: var(--surface); box-shadow: var(--shadow-sm); }.periods a.active { box-shadow: inset 0 -3px 0 var(--teal),var(--shadow-sm); }.periods strong,.periods span { display: block; }.periods strong { color: var(--navy); font-size: .72rem; }.periods span { margin-top: .15rem; color: var(--text-muted); font-size: .55rem; }
	.filter-panel { display: grid; grid-template-columns: minmax(12rem,.7fr) minmax(31rem,1.5fr); gap: .8rem 1.2rem; margin-bottom: .8rem; padding: .85rem 1rem; }.filter-title { display: flex; align-items: center; gap: .65rem; color: var(--blue); }.filter-title strong,.filter-title span { display: block; }.filter-title strong { color: var(--navy); font-size: .7rem; }.filter-title span { margin-top: .16rem; color: var(--text-muted); font-size: .53rem; }.filter-panel form { display: flex; align-items: flex-end; justify-content: flex-end; gap: .45rem; }.filter-panel label { display: grid; gap: .25rem; color: var(--text-muted); font-size: .5rem; font-weight: 750; }.filter-panel input,.filter-panel select { min-height: 2.15rem; box-sizing: border-box; padding: .45rem .55rem; border: 1px solid var(--line); border-radius: .55rem; background: var(--surface-soft); color: var(--text); font-size: .62rem; }.filter-panel button,.filter-panel form>a { display: inline-flex; min-height: 2.15rem; box-sizing: border-box; align-items: center; padding: .48rem .7rem; border: 0; border-radius: .55rem; background: var(--action); color: white; font-size: .58rem; font-weight: 800; text-decoration: none; cursor: pointer; }.filter-panel form>a { border: 1px solid var(--line); background: var(--surface-soft); color: var(--text); }.sync-status { display: flex; grid-column: 1/-1; flex-wrap: wrap; align-items: center; gap: .45rem 1rem; padding-top: .65rem; border-top: 1px solid var(--line-soft); color: var(--text-muted); font-size: .54rem; }.sync-status span { display: inline-flex; align-items: center; gap: .35rem; }.sync-status strong { color: var(--blue); }
	.kpis { display: grid; grid-template-columns: repeat(5,1fr); gap: .65rem; margin-bottom: .8rem; }.kpis article { display: flex; min-width: 0; align-items: center; gap: .7rem; padding: .8rem; border: 1px solid var(--line); border-radius: .85rem; background: var(--surface); box-shadow: var(--shadow-sm); }.kpi-icon { display: grid; width: 2.35rem; height: 2.35rem; flex: 0 0 auto; place-items: center; border-radius: .66rem; background: var(--pale-blue); color: var(--blue); }.kpi-icon.money { background: color-mix(in srgb,var(--success) 14%,var(--surface)); color: var(--success); }.kpis p,.kpis strong,.kpis div>span { display: block; }.kpis p { margin: 0; color: var(--text-muted); font-size: .53rem; }.kpis strong { overflow: hidden; margin-top: .18rem; color: var(--navy); font-size: .88rem; text-overflow: ellipsis; white-space: nowrap; }.kpis strong small { font-size: .56rem; }.kpis div>span { margin-top: .12rem; color: var(--text-muted); font-size: .48rem; }
	.panel { padding: 1rem; }.heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }.heading p { margin: 0 0 .3rem; color: var(--steel); font-size: .58rem; font-weight: 850; letter-spacing: .06em; text-transform: uppercase; }.heading h2 { margin: 0; color: var(--navy); font-size: 1rem; }.heading>span { padding: .35rem .58rem; border-radius: 999px; background: var(--pale-blue); color: var(--blue); font-size: .55rem; font-weight: 800; }.heading>:global(svg) { color: var(--teal); }
	.trend-panel { margin-bottom: .8rem; }.trend-panel .heading { margin-bottom: 1rem; }.chart-scroll { overflow-x: auto; padding: .2rem; }.chart-note { display: flex; align-items: center; gap: .45rem; margin-top: .7rem; padding-top: .65rem; border-top: 1px solid var(--line-soft); color: var(--text-muted); font-size: .56rem; }
	.positions-panel { margin-bottom: .8rem; }.positions-panel .heading { margin-bottom: .85rem; }.table-wrap { overflow: auto; border: 1px solid var(--line-soft); border-radius: .78rem; }table { width: 100%; border-collapse: collapse; font-size: .61rem; }th { padding: .65rem; background: var(--surface-soft); color: var(--text-muted); font-size: .5rem; letter-spacing: .04em; text-align: left; text-transform: uppercase; white-space: nowrap; }td { padding: .68rem .65rem; border-top: 1px solid var(--line-soft); color: var(--text); white-space: nowrap; }td a { color: inherit; text-decoration: none; }td strong,td span { display: block; }td strong { color: var(--navy); font-size: .63rem; }td span,td small { margin-top: .13rem; color: var(--text-muted); font-size: .49rem; }td span.tenant { color: var(--success); }td span.drift { color: var(--danger); }td em { color: var(--warning); font-size: .55rem; font-style: normal; font-weight: 800; }.status { display: inline-flex; align-items: center; gap: .3rem; padding: .28rem .42rem; border-radius: 999px; background: color-mix(in srgb,var(--warning) 14%,var(--surface)); color: var(--warning); font-weight: 800; }.status i { width: .38rem; height: .38rem; border-radius: 50%; background: currentColor; }.status.online { background: color-mix(in srgb,var(--success) 14%,var(--surface)); color: var(--success); }.coverage { display: inline-block; width: 4rem; height: .42rem; overflow: hidden; border-radius: 999px; background: var(--line-soft); }.coverage i { display: block; height: 100%; border-radius: inherit; background: var(--teal); }.empty { padding: 2rem; text-align: center; color: var(--text-muted); }
	.tenancy-panel { margin-bottom: .8rem; }.tenancy-panel>.heading { margin-bottom: .4rem; }.section-intro { max-width: 70rem; margin: 0 0 .9rem; color: var(--text-muted); font-size: .58rem; line-height: 1.5; }.tenancy-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: .7rem; }.tenancy-grid>article { padding: .8rem; border: 1px solid var(--line-soft); border-radius: .8rem; background: var(--surface-soft); scroll-margin-top: 1rem; }.tenancy-grid>article.drift-card { border-color: color-mix(in srgb,var(--danger) 35%,var(--line)); }.tenancy-grid header { display: flex; align-items: flex-start; justify-content: space-between; gap: .6rem; }.tenancy-grid header strong,.tenancy-grid header span { display: block; }.tenancy-grid header strong { color: var(--navy); font-size: .68rem; }.tenancy-grid header div>span { margin-top: .15rem; color: var(--text-muted); font-size: .48rem; }.source { padding: .25rem .42rem; border-radius: 999px; background: var(--pale-blue); color: var(--blue); font-size: .47rem; font-weight: 800; }.current-tenant { display: grid; gap: .14rem; margin-top: .65rem; padding: .6rem; border-radius: .6rem; background: var(--surface); }.current-tenant span,.current-tenant small { color: var(--text-muted); font-size: .48rem; }.current-tenant strong { color: var(--navy); font-size: .72rem; }.drift-notice { margin-top: .45rem; padding: .45rem .55rem; border-radius: .5rem; background: color-mix(in srgb,var(--danger) 9%,var(--surface)); color: var(--danger); font-size: .5rem; font-weight: 750; }.attribution { display: flex; flex-wrap: wrap; justify-content: space-between; gap: .3rem; margin-top: .55rem; color: var(--text-muted); font-size: .5rem; }.attribution strong { color: var(--teal); }.history { display: grid; gap: .3rem; max-height: 8rem; overflow: auto; margin-top: .6rem; }.history>div { display: grid; grid-template-columns: minmax(6rem,.8fr) 1.2fr auto; gap: .45rem; padding: .42rem .5rem; border: 1px solid var(--line-soft); border-radius: .45rem; background: var(--surface); font-size: .48rem; }.history strong { color: var(--navy); }.history span,.history small,.history em { color: var(--text-muted); }.history em { padding: .5rem; font-size: .5rem; }.tenancy-grid form { display: grid; grid-template-columns: 1fr 1fr; gap: .45rem; margin-top: .65rem; padding-top: .65rem; border-top: 1px solid var(--line); }.tenancy-grid form label { display: grid; gap: .2rem; color: var(--text-muted); font-size: .48rem; font-weight: 750; }.tenancy-grid form label:first-of-type { grid-column: 1/-1; }.tenancy-grid input { min-width: 0; padding: .48rem .52rem; border: 1px solid var(--line); border-radius: .5rem; background: var(--surface); color: var(--text); font-size: .56rem; }.tenancy-grid button { grid-column: 1/-1; padding: .55rem; border: 0; border-radius: .5rem; background: var(--action); color: #fff; font-size: .55rem; font-weight: 800; cursor: pointer; }
	.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .8rem; }.position-rule .heading,.quality .heading { margin-bottom: .75rem; }.position-rule>p,.quality ul,.quality>p { color: var(--text-muted); font-size: .59rem; line-height: 1.55; }.position-rule>p { margin: 0; }.quality ul { margin: 0; padding-left: 1rem; }.quality li+li { margin-top: .3rem; }.quality>p { margin: .7rem 0 0; padding: .6rem; border-radius: .6rem; background: var(--surface-soft); }.quality>p strong { color: var(--navy); }
	@media(max-width:1300px){.kpis{grid-template-columns:repeat(3,1fr)}.filter-panel{grid-template-columns:1fr}.filter-panel form{justify-content:flex-start}.sync-status{grid-column:1}}@media(max-width:900px){.detail-grid,.tenancy-grid{grid-template-columns:1fr}}@media(max-width:700px){.periods{grid-template-columns:repeat(2,1fr)}.filter-panel form{align-items:stretch;flex-direction:column}.filter-panel form>a,.filter-panel button{justify-content:center}.kpis{grid-template-columns:1fr}.tenancy-grid form{grid-template-columns:1fr}.tenancy-grid form label{grid-column:1}.history>div{grid-template-columns:1fr}}
</style>
