<script lang="ts">
	import {
		AlertTriangle,
		Building2,
		CalendarRange,
		ChevronRight,
		CircleDollarSign,
		Clock3,
		Database,
		Gauge,
		Layers3,
		RadioTower,
		Users
	} from '@lucide/svelte';
	import { onMount } from 'svelte';
	import AppShell from '#lib/components/AppShell.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import { formatDateTime, formatNaira, formatNumber } from '#lib/format.js';
	import type { EnergyMixPeriod, FloorKey } from '#lib/types.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const periodOptions: Array<{ key: EnergyMixPeriod; label: string; detail: string }> = [
		{ key: 'hourly', label: 'Hourly', detail: 'Last 24 hours' },
		{ key: 'daily', label: 'Daily', detail: 'Last 30 days' },
		{ key: 'weekly', label: 'Weekly', detail: 'Last 12 weeks' },
		{ key: 'monthly', label: 'Monthly', detail: 'Last 12 months' }
	];
	let result = $derived(data.floorAnalysis);
	let summary = $derived(result?.summary ?? null);
	let estateFloors = $derived((result?.floors ?? []).filter((floor) => floor.key !== 'unclassified'));
	let towerFloors = $derived([...estateFloors].sort((left, right) => (right.level ?? -1) - (left.level ?? -1)));
	let maximumUsage = $derived(Math.max(1, ...estateFloors.map((floor) => floor.usageKwh)));
	let rangeQuery = $derived(data.customRange
		? `period=${data.period}&from=${data.customRange.from}&to=${data.customRange.to}`
		: `period=${data.period}`);
	let refreshHref = $derived(`/floors?${rangeQuery}&refresh=true`);
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

	const floorHref = (key: FloorKey): string => `/floors/${key}?${rangeQuery}`;
	const countdownLabel = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
</script>

<svelte:head><title>Floor operations | MicroAccess Smart Metering</title></svelte:head>

<AppShell active="floors">
	<PageHeader
		eyebrow="Na-Aka Hub tenant energy operations"
		title="Floor-by-floor energy"
		description="Compare consumption across Ground Floor and Floors 1–5, then open a floor to inspect its permanent unit positions, current tenants and assigned meters."
		{refreshHref}
	/>

	<nav class="periods" aria-label="Floor analysis presets">
		{#each periodOptions as option (option.key)}
			<a class:active={data.period === option.key && !data.customRange} href={`/floors?period=${option.key}`}><strong>{option.label}</strong><span>{option.detail}</span></a>
		{/each}
	</nav>

	<section class="filter-panel" aria-label="Custom floor analysis filter">
		<div class="filter-title"><CalendarRange size={18} /><div><strong>Custom consumption window</strong><span>Choose exact dates and the chart grouping used across every floor.</span></div></div>
		<form method="GET" action="/floors">
			<label>From<input type="date" name="from" value={data.customRange?.from ?? ''} max={data.today} required /></label>
			<label>To<input type="date" name="to" value={data.customRange?.to ?? ''} max={data.today} required /></label>
			<label>Group by<select name="period" value={data.period}>{#each periodOptions as option (option.key)}<option value={option.key}>{option.label}</option>{/each}</select></label>
			<button type="submit">Apply filter</button>
			{#if data.customRange}<a href={`/floors?period=${data.period}`}>Clear custom dates</a>{/if}
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
		<section class="kpis">
			<article><span class="kpi-icon"><Gauge size={18} /></span><div><p>Tenant-meter usage</p><strong>{formatNumber(summary.totalUsageKwh)} <small>kWh</small></strong><span>Interval consumption only</span></div></article>
			<article><span class="kpi-icon money"><CircleDollarSign size={18} /></span><div><p>Provisional energy value</p><strong>{formatNaira(summary.estimatedValueNgn)}</strong><span>{formatNaira(result.tariff.retailNgnPerKwh)} per kWh</span></div></article>
			<article><span class="kpi-icon"><Layers3 size={18} /></span><div><p>Permanent positions</p><strong>{summary.classifiedPositions} <small>of {summary.totalPositions}</small></strong><span>{summary.unclassifiedPositions} unclassified</span></div></article>
			<article><span class="kpi-icon"><Users size={18} /></span><div><p>Metered positions</p><strong>{summary.meteredPositions} <small>of {summary.totalPositions}</small></strong><span>{summary.reportingPositions} reported in this window</span></div></article>
			<article><span class="kpi-icon signal"><RadioTower size={18} /></span><div><p>Reading coverage</p><strong>{summary.coveragePercent.toFixed(1)}<small>%</small></strong><span>{summary.onlineMeters} of {summary.totalMeters} meters online now</span></div></article>
		</section>

		<section class="hero-grid">
			<article class="panel tower-panel">
				<div class="heading"><div><p>Plaza view</p><h2>Na-Aka Hub floor stack</h2></div><Building2 size={19} /></div>
				<div class="tower" aria-label="Na-Aka Hub floors from fifth floor to ground floor">
					{#each towerFloors as floor (floor.key)}
						<a href={floorHref(floor.key)} class:quiet={floor.usageKwh === 0}>
							<span class="level">{floor.level === 0 ? 'G' : floor.level}</span>
							<div><strong>{floor.label}</strong><small>{floor.positionCount} positions · {floor.meteredPositionCount} metered</small></div>
							<div class="floor-value"><strong>{formatNumber(floor.usageKwh)} kWh</strong><small>{floor.sharePercent.toFixed(1)}% of recorded tenant usage</small></div>
							<ChevronRight size={17} />
						</a>
					{/each}
				</div>
			</article>

			<aside class="panel comparison">
				<div class="heading"><div><p>Consumption comparison</p><h2>Which floor used the energy</h2></div><span>{formatNumber(summary.classifiedUsageKwh)} kWh classified</span></div>
				<div class="bars">
					{#each estateFloors as floor (floor.key)}
						<a href={floorHref(floor.key)}>
							<div><strong>{floor.label}</strong><span>{formatNumber(floor.usageKwh)} kWh</span></div>
							<div class="track"><span style={`width:${floor.usageKwh > 0 ? Math.max(2, (floor.usageKwh / maximumUsage) * 100) : 0}%`}></span></div>
							<small>{floor.coveragePercent.toFixed(1)}% reading coverage · {formatNaira(floor.estimatedValueNgn)}</small>
						</a>
					{/each}
				</div>
			</aside>
		</section>

		<section class="panel readiness">
			<div class="heading"><div><p>Operational readiness</p><h2>Floor position and meter coverage</h2></div><span>{summary.reportingPositions} reporting positions</span></div>
			<div class="table-wrap"><table>
				<thead><tr><th>Floor</th><th>Positions</th><th>Meter assigned</th><th>Reporting</th><th>Meters online</th><th>Consumption</th><th>Data coverage</th><th></th></tr></thead>
				<tbody>{#each result.floors as floor (floor.key)}<tr>
					<td><strong>{floor.label}</strong></td><td>{floor.positionCount}</td><td>{floor.meteredPositionCount}</td><td>{floor.reportingPositionCount}</td>
					<td>{floor.onlineMeterCount} / {floor.meterCount}</td><td>{formatNumber(floor.usageKwh)} kWh</td><td><span class="coverage"><i style={`width:${Math.min(100, floor.coveragePercent)}%`}></i></span><small>{floor.coveragePercent.toFixed(1)}%</small></td>
					<td><a class="open" href={floorHref(floor.key)}>Open <ChevronRight size={14} /></a></td>
				</tr>{/each}</tbody>
			</table></div>
		</section>

		<section class="detail-grid">
			<article class="panel method">
				<div class="heading"><div><p>Position model</p><h2>Floors stay; tenants can change</h2></div><Database size={18} /></div>
				<div class="method-row"><span>1</span><p><strong>Permanent identity:</strong> SteamaCo first name is interpreted as the floor and unit position.</p></div>
				<div class="method-row"><span>2</span><p><strong>Current occupant:</strong> last name is displayed as the tenant snapshot and can change without changing the unit.</p></div>
				<div class="method-row"><span>3</span><p><strong>Consumption:</strong> only hourly usage on an assigned customer meter is totalled; register readings are never added together.</p></div>
				<div class="method-row"><span>4</span><p><strong>Unknowns:</strong> names that do not match an approved pattern stay Unclassified until corrected.</p></div>
			</article>
			<aside class="panel warnings">
				<div class="heading"><div><p>Data-quality boundary</p><h2>What management should know</h2></div><AlertTriangle size={18} /></div>
				<ul>{#each result.warnings as warning}<li>{warning}</li>{/each}</ul>
				<p>Analysis window: <strong>{formatDateTime(result.range.from)}</strong> to <strong>{formatDateTime(result.range.to)}</strong> (Africa/Lagos).</p>
			</aside>
		</section>
	{/if}
</AppShell>

<style>
	.state, .panel, .filter-panel { border: 1px solid var(--line); border-radius: 1rem; background: var(--surface); box-shadow: var(--shadow-sm); }.state { padding: 1rem; color: var(--danger); }
	.periods { display: grid; grid-template-columns: repeat(4,1fr); gap: .55rem; margin-bottom: .65rem; }.periods a { padding: .68rem .8rem; border: 1px solid var(--line); border-radius: .78rem; background: color-mix(in srgb,var(--surface) 82%,transparent); color: var(--text); text-decoration: none; }.periods a:hover,.periods a.active { border-color: var(--sky); background: var(--surface); box-shadow: var(--shadow-sm); }.periods a.active { box-shadow: inset 0 -3px 0 var(--teal),var(--shadow-sm); }.periods strong,.periods span { display: block; }.periods strong { color: var(--navy); font-size: .72rem; }.periods span { margin-top: .15rem; color: var(--text-muted); font-size: .55rem; }
	.filter-panel { display: grid; grid-template-columns: minmax(12rem,.7fr) minmax(31rem,1.5fr); gap: .8rem 1.2rem; margin-bottom: .8rem; padding: .85rem 1rem; }.filter-title { display: flex; align-items: center; gap: .65rem; color: var(--blue); }.filter-title strong,.filter-title span { display: block; }.filter-title strong { color: var(--navy); font-size: .7rem; }.filter-title span { margin-top: .16rem; color: var(--text-muted); font-size: .53rem; }.filter-panel form { display: flex; align-items: flex-end; justify-content: flex-end; gap: .45rem; }.filter-panel label { display: grid; gap: .25rem; color: var(--text-muted); font-size: .5rem; font-weight: 750; }.filter-panel input,.filter-panel select { min-height: 2.15rem; box-sizing: border-box; padding: .45rem .55rem; border: 1px solid var(--line); border-radius: .55rem; background: var(--surface-soft); color: var(--text); font-size: .62rem; }.filter-panel button,.filter-panel form>a { display: inline-flex; min-height: 2.15rem; box-sizing: border-box; align-items: center; padding: .48rem .7rem; border: 0; border-radius: .55rem; background: var(--action); color: white; font-size: .58rem; font-weight: 800; text-decoration: none; cursor: pointer; }.filter-panel form>a { border: 1px solid var(--line); background: var(--surface-soft); color: var(--text); }.sync-status { display: flex; grid-column: 1/-1; flex-wrap: wrap; align-items: center; gap: .45rem 1rem; padding-top: .65rem; border-top: 1px solid var(--line-soft); color: var(--text-muted); font-size: .54rem; }.sync-status span { display: inline-flex; align-items: center; gap: .35rem; }.sync-status strong { color: var(--blue); }
	.kpis { display: grid; grid-template-columns: repeat(5,1fr); gap: .65rem; margin-bottom: .8rem; }.kpis article { display: flex; min-width: 0; align-items: center; gap: .7rem; padding: .8rem; border: 1px solid var(--line); border-radius: .85rem; background: var(--surface); box-shadow: var(--shadow-sm); }.kpi-icon { display: grid; width: 2.35rem; height: 2.35rem; flex: 0 0 auto; place-items: center; border-radius: .66rem; background: var(--pale-blue); color: var(--blue); }.kpi-icon.money { background: color-mix(in srgb,var(--success) 14%,var(--surface)); color: var(--success); }.kpi-icon.signal { background: color-mix(in srgb,var(--teal) 15%,var(--surface)); color: var(--teal); }.kpis p,.kpis strong,.kpis div>span { display: block; }.kpis p { margin: 0; color: var(--text-muted); font-size: .53rem; }.kpis strong { overflow: hidden; margin-top: .18rem; color: var(--navy); font-size: .88rem; text-overflow: ellipsis; white-space: nowrap; }.kpis strong small { font-size: .58rem; }.kpis div>span { margin-top: .12rem; color: var(--text-muted); font-size: .48rem; }
	.hero-grid { display: grid; grid-template-columns: minmax(20rem,.75fr) minmax(0,1.25fr); gap: .8rem; margin-bottom: .8rem; }.panel { padding: 1rem; }.heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }.heading p { margin: 0 0 .3rem; color: var(--steel); font-size: .58rem; font-weight: 850; letter-spacing: .06em; text-transform: uppercase; }.heading h2 { margin: 0; color: var(--navy); font-size: 1rem; }.heading>:global(svg) { color: var(--teal); }.heading>span { padding: .35rem .58rem; border-radius: 999px; background: var(--pale-blue); color: var(--blue); font-size: .55rem; font-weight: 800; }
	.tower { display: grid; gap: .34rem; margin: 1rem auto 0; }.tower a { display: grid; grid-template-columns: auto 1fr auto auto; align-items: center; gap: .65rem; padding: .7rem .8rem; border: 1px solid var(--line-soft); border-radius: .72rem; background: linear-gradient(90deg,color-mix(in srgb,var(--blue) 7%,var(--surface)),var(--surface)); color: inherit; text-decoration: none; transition: transform .15s,border-color .15s; }.tower a:hover { transform: translateX(.2rem); border-color: var(--sky); }.tower a.quiet { background: var(--surface-soft); }.level { display: grid; width: 2rem; height: 2rem; place-items: center; border-radius: .55rem; background: var(--nav-surface); color: white; font-size: .66rem; font-weight: 850; }.tower strong,.tower small { display: block; }.tower strong { color: var(--navy); font-size: .66rem; }.tower small { margin-top: .12rem; color: var(--text-muted); font-size: .49rem; }.floor-value { text-align: right; }.floor-value strong { font-size: .7rem; }
	.comparison .heading { margin-bottom: 1rem; }.bars { display: grid; gap: .7rem; }.bars a { color: inherit; text-decoration: none; }.bars a>div:first-child { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }.bars strong { color: var(--navy); font-size: .61rem; }.bars span { color: var(--blue); font-size: .59rem; font-weight: 800; }.track { height: .65rem; overflow: hidden; margin: .28rem 0; border-radius: 999px; background: var(--line-soft); }.track span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg,var(--blue),var(--sky)); }.bars small { color: var(--text-muted); font-size: .49rem; }
	.readiness { margin-bottom: .8rem; }.readiness .heading { margin-bottom: .85rem; }.table-wrap { overflow: auto; border: 1px solid var(--line-soft); border-radius: .75rem; }table { width: 100%; border-collapse: collapse; font-size: .62rem; }th { padding: .62rem; background: var(--surface-soft); color: var(--text-muted); font-size: .52rem; letter-spacing: .04em; text-align: left; text-transform: uppercase; white-space: nowrap; }td { padding: .65rem .62rem; border-top: 1px solid var(--line-soft); color: var(--text); white-space: nowrap; }td strong { color: var(--navy); }.coverage { display: inline-block; width: 4rem; height: .4rem; overflow: hidden; margin-right: .3rem; border-radius: 999px; background: var(--line-soft); vertical-align: middle; }.coverage i { display: block; height: 100%; border-radius: inherit; background: var(--teal); }.table-wrap small { color: var(--text-muted); }.open { display: inline-flex; align-items: center; gap: .2rem; color: var(--blue); font-weight: 800; text-decoration: none; }
	.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .8rem; }.method .heading,.warnings .heading { margin-bottom: .8rem; }.method-row { display: grid; grid-template-columns: auto 1fr; gap: .55rem; margin-bottom: .55rem; }.method-row>span { display: grid; width: 1.5rem; height: 1.5rem; place-items: center; border-radius: 50%; background: var(--pale-blue); color: var(--blue); font-size: .55rem; font-weight: 850; }.method-row p { margin: 0; color: var(--text-muted); font-size: .59rem; line-height: 1.5; }.method-row strong { color: var(--navy); }.warnings ul { margin: 0; padding-left: 1rem; color: var(--text-muted); font-size: .57rem; line-height: 1.5; }.warnings li+li { margin-top: .35rem; }.warnings>p { margin: .8rem 0 0; padding: .65rem; border-radius: .65rem; background: var(--surface-soft); color: var(--text-muted); font-size: .54rem; line-height: 1.5; }.warnings>p strong { color: var(--navy); }
	@media(max-width:1300px){.kpis{grid-template-columns:repeat(3,1fr)}.filter-panel{grid-template-columns:1fr}.filter-panel form{justify-content:flex-start}.sync-status{grid-column:1}}@media(max-width:1000px){.hero-grid,.detail-grid{grid-template-columns:1fr}}@media(max-width:700px){.periods{grid-template-columns:repeat(2,1fr)}.filter-panel form{align-items:stretch;flex-direction:column}.filter-panel form>a,.filter-panel button{justify-content:center}.kpis{grid-template-columns:1fr}.tower a{grid-template-columns:auto 1fr auto}.floor-value{grid-column:2;text-align:left}.tower a>:global(svg){grid-column:3;grid-row:1/3}}
</style>
