<script lang="ts">
	import { AlertTriangle, ArrowLeft, Clock3, Gauge, Radio, Zap } from '@lucide/svelte';
	import AppShell from '#lib/components/AppShell.svelte';
	import LineChart from '#lib/components/LineChart.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import StatusPill from '#lib/components/StatusPill.svelte';
	import { formatDateTime, formatNumber } from '#lib/format.js';
	import type { MeterConnectivity, MeterOperationalRole } from '#lib/types.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let chartValues = $derived((data.history?.readings ?? []).map((reading) => reading.readingKwh).filter((value): value is number => value !== null));
	const roles: Record<MeterOperationalRole, string> = { grid_source: 'Grid source', solar_source: 'Solar source', generator_source: 'Generator source', distribution_or_bulk: 'Distribution / bulk', customer_load: 'Customer load', unknown: 'Unclassified' };
	const tone = (value: MeterConnectivity): 'success' | 'danger' | 'warning' | 'neutral' => value === 'online' ? 'success' : value === 'never_online' ? 'danger' : value === 'offline' ? 'warning' : 'neutral';
</script>

<svelte:head><title>{data.meter?.meterNumber ?? 'Meter'} | MicroAccess Smart Metering</title></svelte:head>
<AppShell active="meters">
	<PageHeader eyebrow="Meter operations · detail" title={data.meter?.meterNumber ?? 'Meter unavailable'} description="Live device state, assignment, communications metadata and the dated provider reading window." refreshHref={`?refresh=true`} />
	<a class="back" href="/meters"><ArrowLeft size={15} />Back to meter register</a>
	{#if data.error || !data.meter || !data.history}
		<section class="state"><AlertTriangle size={20} />{data.error?.message ?? 'The meter detail could not be loaded.'}</section>
	{:else}
		{@const meter = data.meter}{@const history = data.history}
		<section class="identity panel">
			<div><p>Meter identity</p><h2>{meter.name}</h2><span>{meter.model} · {meter.manufacturer} · {meter.phase} phase</span></div>
			<StatusPill label={meter.connectivityLabel} tone={tone(meter.connectivity)} />
		</section>

		<section class="kpis">
			<article><Gauge size={18} /><span>Latest cumulative register</span><strong>{formatNumber(history.summary.latestReadingKwh)} <small>kWh</small></strong><p>Lifetime meter register</p></article>
			<article><Zap size={18} /><span>Usage in returned window</span><strong>{formatNumber(history.summary.intervalUsageKwh)} <small>kWh</small></strong><p>Sum of interval usage returned by provider</p></article>
			<article><Clock3 size={18} /><span>History coverage</span><strong>{history.coverage.readingCount} <small>readings</small></strong><p>{formatDateTime(history.coverage.from)} – {formatDateTime(history.coverage.to)}</p></article>
			<article><Radio size={18} /><span>Last communication</span><strong>{formatDateTime(meter.lastReadingAt)}</strong><p>{meter.communicationMethod} · {meter.simProvider}</p></article>
		</section>

		<section class="content-grid">
			<article class="panel chart-panel">
				<div class="heading"><div><p>Reading history</p><h2>Cumulative kWh register trend</h2></div><span>Provider recent window</span></div>
				<LineChart values={chartValues} label={`Cumulative meter readings for ${meter.meterNumber}`} unit="kWh" />
				<div class="range"><span>First: <strong>{formatNumber(history.summary.firstReadingKwh)} kWh</strong></span><span>Latest: <strong>{formatNumber(history.summary.latestReadingKwh)} kWh</strong></span><span>Change: <strong>{formatNumber(history.summary.registerChangeKwh)} kWh</strong></span></div>
			</article>

			<aside class="panel details">
				<div class="heading"><div><p>Operational context</p><h2>Meter profile</h2></div></div>
				<dl>
					<div><dt>Role</dt><dd>{roles[meter.operationalRole]}</dd></div><div><dt>Customer</dt><dd>{meter.customerName ?? 'Unassigned'}</dd></div>
					<div><dt>Site</dt><dd>{meter.siteName}</dd></div><div><dt>Relay state</dt><dd>{meter.relayOn === null ? 'Not reported' : meter.relayOn ? 'On' : 'Off'}</dd></div>
					<div><dt>SIM provider</dt><dd>{meter.simProvider}</dd></div><div><dt>SIM ICCID</dt><dd>{meter.simIccid || 'Not provided'}</dd></div>
					<div><dt>Signal</dt><dd>{formatNumber(meter.signalStrength)}</dd></div><div><dt>Anomalies in window</dt><dd>{history.summary.anomalyCount}</dd></div>
				</dl>
			</aside>
		</section>

		{#each history.warnings as warning}
			<div class="warning"><AlertTriangle size={16} /><span>{warning}</span></div>
		{/each}

		<section class="panel readings">
			<div class="heading"><div><p>Audit view</p><h2>Dated reading records</h2></div><span>{history.readings.length} rows</span></div>
			<div class="table-wrap"><table><thead><tr><th>Timestamp</th><th>Cumulative reading</th><th>Interval usage</th><th>Customer</th><th>Quality</th></tr></thead><tbody>
				{#each [...history.readings].reverse() as reading (reading.timestamp)}<tr><td>{formatDateTime(reading.timestamp)}</td><td>{formatNumber(reading.readingKwh)} kWh</td><td>{formatNumber(reading.usageKwh)} kWh</td><td>{reading.customerName ?? 'Not assigned in reading'}</td><td>{reading.anomalous ? 'Provider flagged anomaly' : 'Not flagged'}</td></tr>{:else}<tr><td colspan="5" class="empty">No readings were returned for this meter in the current provider window.</td></tr>{/each}
			</tbody></table></div>
		</section>
	{/if}
</AppShell>

<style>
	.back { display: inline-flex; align-items: center; gap: .35rem; margin: -.4rem 0 .8rem; color: var(--blue); font-size: .7rem; font-weight: 800; text-decoration: none; }
	.panel, .state { border: 1px solid var(--line); border-radius: 1rem; background: var(--surface); box-shadow: var(--shadow-sm); }
	.state { display: flex; gap: .6rem; padding: 1rem; color: var(--danger); }
	.identity { display: flex; align-items: center; justify-content: space-between; padding: 1rem; }
	.identity p, .heading p { margin: 0 0 .3rem; color: var(--steel); font-size: .62rem; font-weight: 850; letter-spacing: .09em; text-transform: uppercase; }
	.identity h2, .heading h2 { margin: 0; color: var(--navy); font-size: 1.05rem; }
	.identity span { display: block; margin-top: .25rem; color: var(--text-muted); font-size: .66rem; }
	.kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .75rem; margin: .75rem 0; }
	.kpis article { padding: .9rem; border: 1px solid var(--line); border-radius: .9rem; background: var(--surface); }
	.kpis :global(svg) { color: var(--teal); }
	.kpis span, .kpis strong, .kpis p { display: block; }
	.kpis span { margin-top: .65rem; color: var(--text-muted); font-size: .62rem; }
	.kpis strong { margin-top: .3rem; color: var(--navy); font-size: 1rem; }
	.kpis small { font-size: .62rem; }
	.kpis p { margin: .3rem 0 0; color: var(--text-muted); font-size: .58rem; line-height: 1.35; }
	.content-grid { display: grid; grid-template-columns: minmax(0, 2fr) minmax(18rem, .8fr); gap: .75rem; }
	.chart-panel, .details, .readings { padding: 1rem; }
	.heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; }
	.heading > span { color: var(--text-muted); font-size: .62rem; }
	.range { display: flex; justify-content: space-between; gap: 1rem; padding-top: .75rem; color: var(--text-muted); font-size: .63rem; }
	.range strong { color: var(--navy); }
	dl { margin: 0; }
	dl div { display: grid; grid-template-columns: 1fr 1.2fr; gap: .7rem; padding: .7rem 0; border-top: 1px solid var(--line-soft); font-size: .67rem; }
	dt { color: var(--text-muted); } dd { margin: 0; color: var(--navy); font-weight: 750; text-align: right; overflow-wrap: anywhere; }
	.warning { display: flex; align-items: center; gap: .55rem; margin-top: .75rem; padding: .72rem .85rem; border: 1px solid #f1dfb5; border-radius: .75rem; background: #fffaf0; color: #855600; font-size: .67rem; }
	.readings { margin-top: .75rem; }
	.table-wrap { max-height: 30rem; overflow: auto; border: 1px solid var(--line-soft); border-radius: .75rem; }
	table { width: 100%; border-collapse: collapse; font-size: .67rem; }
	th { position: sticky; top: 0; padding: .68rem; background: var(--surface-soft); color: var(--text-muted); font-size: .59rem; text-align: left; text-transform: uppercase; }
	td { padding: .7rem; border-top: 1px solid var(--line-soft); white-space: nowrap; }
	.empty { padding: 2rem; text-align: center; color: var(--text-muted); }
	@media (max-width: 1100px) { .kpis { grid-template-columns: repeat(2, 1fr); } .content-grid { grid-template-columns: 1fr; } }
	@media (max-width: 620px) { .kpis { grid-template-columns: 1fr; } .range { flex-direction: column; } }
</style>
