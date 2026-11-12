<script lang="ts">
	import { AlertTriangle, ClipboardCheck, CloudOff, Gauge, Radio, Users, Zap } from '@lucide/svelte';
	import AppShell from '#lib/components/AppShell.svelte';
	import HorizontalBarChart from '#lib/components/HorizontalBarChart.svelte';
	import KpiCard from '#lib/components/KpiCard.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import StatusPill from '#lib/components/StatusPill.svelte';
	import { formatDateTime, formatNumber } from '#lib/format.js';
	import type { MeterConnectivity, MeterOperationalRole } from '#lib/types.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let overview = $derived(data.overview);
	let sourceMeters = $derived(
		(overview?.meters ?? []).filter((meter) =>
			['grid_source', 'solar_source', 'generator_source', 'distribution_or_bulk'].includes(meter.operationalRole)
		)
	);
	const percentage = (value: number, total: number) => total === 0 ? 0 : Math.round((value / total) * 100);
	const roleLabels: Record<MeterOperationalRole, string> = {
		grid_source: 'Grid source', solar_source: 'Solar source', generator_source: 'Generator source',
		distribution_or_bulk: 'Distribution / bulk', customer_load: 'Customer load', unknown: 'Unclassified'
	};
	const tone = (value: MeterConnectivity): 'success' | 'danger' | 'warning' | 'neutral' =>
		value === 'online' ? 'success' : value === 'never_online' ? 'danger' : value === 'offline' ? 'warning' : 'neutral';
</script>

<svelte:head><title>Command centre | MicroAccess Smart Metering</title></svelte:head>

<AppShell active="dashboard">
	<PageHeader
		eyebrow="Na-Aka Hub · electricity operations"
		title="Operations command centre"
		description="Current estate position and the priority decisions that need attention. Detailed work now lives in dedicated pages."
		refreshHref="/?refresh=true"
	/>

	{#if data.error}
		<section class="error-card"><AlertTriangle size={24} /><div><h2>Live data is temporarily unavailable</h2><p>{data.error.message}</p></div></section>
	{:else if overview}
		<section class="live-banner"><div><span></span><strong>Live SteamaCo data</strong><small>Read-only and interpreted by MSM</small></div><p>Retrieved {formatDateTime(overview.dataSource.retrievedAt)}</p></section>

		<section class="kpi-grid" aria-label="Operational key figures">
			<KpiCard label="Meter estate" value={overview.summary.totalMeters} note={`${overview.summary.sourceMeters} source / bulk classified`} icon={Gauge} />
			<KpiCard label="Online now" value={overview.summary.onlineMeters} note={`${percentage(overview.summary.onlineMeters, overview.summary.totalMeters)}% of observed meters`} icon={Radio} tone="green" />
			<KpiCard label="Never online" value={overview.summary.neverOnlineMeters} note="Requires commissioning evidence" icon={CloudOff} tone="red" />
			<KpiCard label="Assigned meters" value={overview.summary.assignedMeters} note={`${overview.summary.unassignedMeters} need disposition`} icon={ClipboardCheck} tone="teal" />
			<KpiCard label="Provider customers" value={overview.summary.totalCustomers} note={`${overview.summary.customersWithoutMeter} without observed meter`} icon={Users} tone="amber" />
		</section>

		<section class="dashboard-grid">
			<article class="panel">
				<div class="heading"><div><p>Communications health</p><h2>Meter freshness distribution</h2></div><a href="/meters">Open meter register</a></div>
				<HorizontalBarChart items={overview.freshnessDistribution} accent="linear-gradient(90deg, var(--blue), var(--sky))" />
			</article>

			<article class="panel source-panel">
				<div class="heading"><div><p>Incoming energy</p><h2>Source and bulk meters</h2></div><a href="/energy-mix">Open energy mix</a></div>
				<div class="source-list">
					{#each sourceMeters as meter (meter.providerId)}
						<a href={`/meters/${meter.providerId}`}>
							<span class="source-icon"><Zap size={15} /></span>
							<span><strong>{meter.name}</strong><small>{meter.meterNumber} · {roleLabels[meter.operationalRole]}</small></span>
							<span class="reading"><strong>{formatNumber(meter.latestReadingKwh)}</strong><small>latest cumulative register</small></span>
							<StatusPill label={meter.connectivityLabel} tone={tone(meter.connectivity)} />
						</a>
					{/each}
				</div>
			</article>
		</section>

		<section class="panel exceptions">
			<div class="heading"><div><p>Action queue</p><h2>Priority operational exceptions</h2></div><a href="/exceptions">Open exception workspace</a></div>
			<div class="exception-grid">
				{#each overview.exceptions.slice(0, 5) as item (item.key)}
					<a href={`/exceptions?type=${item.key}`}><span>{item.severity}</span><strong>{item.count}</strong><h3>{item.label}</h3><p>{item.action}</p></a>
				{/each}
			</div>
		</section>

		<section class="boundary-grid">
			<a class="boundary ready" href="/energy-mix"><strong>Solar and grid contribution</strong><span>Compare matched hourly, daily, weekly and monthly source usage against the 90–95% solar target.</span></a>
			<a class="boundary ready" href="/floors"><strong>Floor-by-floor operations</strong><span>Compare tenant-meter usage across Ground Floor and Floors 1–5, then inspect each permanent unit position.</span></a>
			<a class="boundary ready" href="/reports"><strong>Reports and recent history</strong><span>Review dated kWh readings, usage trends and account ledger movement.</span></a>
			<a class="boundary" href="/customers"><strong>Customer account operations</strong><span>Separate monetary account balances from meter energy readings.</span></a>
			<div class="boundary blocked"><strong>Payment automation remains controlled</strong><span>Credit posting and remote commands remain disabled until the vendor contract is certified.</span></div>
		</section>
	{/if}
</AppShell>

<style>
	.live-banner, .error-card, .panel, .boundary { border: 1px solid var(--line); border-radius: 1rem; background: var(--surface); box-shadow: var(--shadow-sm); }
	.live-banner { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: .85rem; padding: .75rem .9rem; }
	.live-banner > div { display: flex; align-items: center; gap: .5rem; }
	.live-banner > div > span { width: .46rem; height: .46rem; border-radius: 50%; background: var(--success); }
	.live-banner strong { color: var(--navy); font-size: .74rem; }
	.live-banner small, .live-banner p { margin: 0; color: var(--text-muted); font-size: .66rem; }
	.error-card { display: flex; gap: 1rem; padding: 1.4rem; color: var(--danger); }
	.error-card h2 { margin: 0; color: var(--navy); }
	.error-card p { color: var(--text-muted); }
	.kpi-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: .75rem; margin-bottom: .75rem; }
	.dashboard-grid { display: grid; grid-template-columns: 1.35fr 1fr; gap: .75rem; }
	.panel { min-width: 0; padding: 1rem; }
	.heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; }
	.heading p { margin: 0 0 .35rem; color: var(--steel); font-size: .62rem; font-weight: 850; letter-spacing: .09em; text-transform: uppercase; }
	.heading h2 { margin: 0; color: var(--navy); font-size: 1.03rem; }
	.heading a { color: var(--blue); font-size: .68rem; font-weight: 800; text-decoration: none; }
	.source-list { display: grid; gap: .45rem; }
	.source-list a { display: grid; grid-template-columns: 2rem minmax(9rem, 1.3fr) minmax(7rem, .8fr) auto; align-items: center; gap: .65rem; padding: .67rem; border: 1px solid var(--line-soft); border-radius: .72rem; color: inherit; text-decoration: none; }
	.source-list a:hover { border-color: var(--sky); background: var(--surface-soft); }
	.source-icon { display: grid; width: 2rem; height: 2rem; place-items: center; border-radius: .6rem; background: var(--pale-blue); color: var(--blue); }
	.source-list strong, .source-list small { display: block; }
	.source-list strong { color: var(--navy); font-size: .73rem; }
	.source-list small { margin-top: .16rem; color: var(--text-muted); font-size: .59rem; }
	.reading { text-align: right; }
	.exceptions { margin-top: .75rem; }
	.exception-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: .65rem; }
	.exception-grid a { padding: .8rem; border: 1px solid var(--line-soft); border-radius: .78rem; color: inherit; text-decoration: none; }
	.exception-grid a:hover { border-color: var(--sky); }
	.exception-grid a > span { color: var(--warning); font-size: .58rem; font-weight: 800; text-transform: uppercase; }
	.exception-grid a > strong { float: right; color: var(--navy); font-size: 1.3rem; }
	.exception-grid h3 { margin: .8rem 0 .35rem; color: var(--navy); font-size: .75rem; }
	.exception-grid p { margin: 0; color: var(--text-muted); font-size: .64rem; line-height: 1.45; }
	.boundary-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: .75rem; margin-top: .75rem; }
	.boundary { display: block; padding: 1rem; color: inherit; text-decoration: none; }
	.boundary strong, .boundary span { display: block; }
	.boundary strong { color: var(--navy); font-size: .78rem; }
	.boundary span { margin-top: .35rem; color: var(--text-muted); font-size: .66rem; line-height: 1.5; }
	.boundary.ready { border-color: #bfe3d4; }
	.boundary.blocked { border-color: #f1dfb5; }
	@media (max-width: 1200px) { .kpi-grid { grid-template-columns: repeat(3, 1fr); } .exception-grid { grid-template-columns: repeat(3, 1fr); } }
	@media (max-width: 900px) { .dashboard-grid, .boundary-grid { grid-template-columns: 1fr; } }
	@media (max-width: 650px) { .kpi-grid, .exception-grid { grid-template-columns: 1fr; } .source-list a { grid-template-columns: 2rem 1fr auto; } .reading { display: none; } }
</style>
