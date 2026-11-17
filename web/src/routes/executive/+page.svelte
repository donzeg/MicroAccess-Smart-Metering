<script lang="ts">
	import {
		Activity,
		AlertTriangle,
		CalendarRange,
		CircleDollarSign,
		Gauge,
		Printer,
		Radio,
		SunMedium,
		Zap
	} from '@lucide/svelte';
	import AppShell from '#lib/components/AppShell.svelte';
	import InfoPopover from '#lib/components/InfoPopover.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import { formatDateTime, formatNaira, formatNumber } from '#lib/format.js';
	import type { OperationsException } from '#lib/types.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let operations = $derived(data.operations);
	let energyMix = $derived(data.energyMix);
	let revenue = $derived(data.revenue);
	let floorAnalysis = $derived(data.floorAnalysis);
	let energy = $derived(revenue?.summary ?? energyMix?.summary ?? null);
	let sharedSupplyLabel = $derived(
		revenue?.sourceTopology.sharedSupplyLabel ?? energyMix?.sourceTopology.sharedSupplyLabel ?? 'AEDC grid'
	);
	let generatorSeparatelyMetered = $derived(
		revenue?.sourceTopology.generatorSeparatelyMetered ?? energyMix?.sourceTopology.generatorSeparatelyMetered ?? false
	);
	let detailQuery = $derived(new URLSearchParams({
		period: data.period,
		from: data.range.from,
		to: data.range.to
	}).toString());
	let refreshHref = $derived(`/executive?${new URLSearchParams({
		...(data.preset ? { range: data.preset } : {
			period: data.period,
			from: data.range.from,
			to: data.range.to
		}),
		refresh: 'true'
	}).toString()}`);

	const severityRank: Record<OperationsException['severity'], number> = {
		critical: 0,
		high: 1,
		medium: 2,
		low: 3
	};

	type AttentionItem = {
		key: string;
		label: string;
		severity: OperationsException['severity'];
		count: number;
		action: string;
		href: string;
	};

	let attentionItems = $derived.by((): AttentionItem[] => {
		const items: AttentionItem[] = (operations?.exceptions ?? [])
			.filter((item) => item.count > 0)
			.map((item) => ({ ...item, href: `/exceptions?type=${item.key}` }));
		if ((energyMix || revenue) && !generatorSeparatelyMetered) {
			items.push({
				key: 'generator-meter-gap',
				label: 'Generator measurement gap',
				severity: 'high',
				count: 1,
				action: 'Install the dedicated generator meter before separate generator cost and contribution reporting.',
				href: `/energy-mix?${detailQuery}`
			});
		}
		return items.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || b.count - a.count).slice(0, 4);
	});

	let rankedFloors = $derived.by(() =>
		[...(floorAnalysis?.floors ?? [])]
			.filter((floor) => floor.positionCount > 0)
			.sort((a, b) => b.usageKwh - a.usageKwh)
			.slice(0, 5)
	);
	let maximumFloorUsage = $derived(Math.max(1, ...rankedFloors.map((floor) => floor.usageKwh)));
	let buckets = $derived(revenue?.buckets ?? energyMix?.buckets ?? []);
	let maximumBucketUsage = $derived(Math.max(1, ...buckets.map((bucket) => bucket.totalKwh)));
	let chartWidth = $derived(Math.max(520, buckets.length * 40));
	let retrievedAt = $derived.by(() => {
		const values = [operations?.dataSource.retrievedAt, energyMix?.dataSource.retrievedAt, revenue?.dataSource.retrievedAt, floorAnalysis?.dataSource.retrievedAt]
			.filter((value): value is string => Boolean(value))
			.map((value) => new Date(value).getTime())
			.filter(Number.isFinite);
		return values.length > 0 ? new Date(Math.max(...values)).toISOString() : null;
	});
	let managementSummary = $derived.by(() => {
		const statements: string[] = [];
		if (energy) {
			statements.push(`Solar supplied ${energy.solarPercent.toFixed(1)}% of ${formatNumber(energy.totalKwh)} kWh of accounted energy.`);
		}
		if (revenue) {
			statements.push(`Consumed energy is valued at ${formatNaira(revenue.summary.accruedEnergyRevenueNgn)} for this period.`);
		}
		const highestPriority = attentionItems[0];
		if (highestPriority) statements.push(`Management attention: ${highestPriority.count} ${highestPriority.label.toLowerCase()}.`);
		return statements.length > 0 ? statements.join(' ') : 'Executive measures are temporarily unavailable.';
	});

	const heightPercent = (value: number): number => Math.max(value > 0 ? 3 : 0, (value / maximumBucketUsage) * 100);
	const floorWidth = (value: number): number => Math.max(value > 0 ? 3 : 0, (value / maximumFloorUsage) * 100);
	const printPage = () => window.print();
</script>

<svelte:head><title>Executive overview | MicroAccess Smart Metering</title></svelte:head>

<AppShell active="executive">
	<PageHeader
		eyebrow="Na-Aka Hub · management and energy intelligence"
		title="Executive overview"
		description="A concise view of energy performance, commercial value and the decisions requiring management attention."
		{refreshHref}
	/>

	<div class="executive-actions">
		<nav class="periods" aria-label="Executive reporting periods">
			<a class:active={data.preset === 'today'} href="/executive?range=today"><strong>Today</strong><span>Latest completed hours</span></a>
			<a class:active={data.preset === 'mtd'} href="/executive?range=mtd"><strong>Month to Date</strong><span>Current calendar month</span></a>
			<a class:active={data.preset === 'ytd'} href="/executive?range=ytd"><strong>Year to Date</strong><span>January 1 to today</span></a>
		</nav>
		<button class="print-button" type="button" onclick={printPage}><Printer size={16} /> Print / PDF</button>
	</div>

	<section class="range-panel" aria-label="Custom executive reporting window">
		<div class="range-label"><CalendarRange size={18} /><div><span>Reporting window</span><strong>{data.rangeLabel}</strong></div></div>
		<p>{data.range.from} <span>to</span> {data.range.to}</p>
		<form method="GET" action="/executive">
			<label>From<input type="date" name="from" value={data.customRange?.from ?? ''} max={data.today} required /></label>
			<label>To<input type="date" name="to" value={data.customRange?.to ?? ''} max={data.today} required /></label>
			<label>Group by<select name="period" value={data.period}><option value="hourly">Hourly</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
			<button type="submit">Apply</button>
		</form>
	</section>

	{#if data.errors.length > 0}
		<section class="partial-warning" aria-label="Unavailable executive data">
			<AlertTriangle size={18} />
			<div><strong>Some executive measures could not be refreshed</strong><span>{data.errors.map((item) => item.source).join(', ')}. Available sections remain live.</span></div>
			<InfoPopover title="Unavailable data" label="Explain unavailable executive data">
				<ul>{#each data.errors as item}<li><strong>{item.source}:</strong> {item.error.message}</li>{/each}</ul>
			</InfoPopover>
		</section>
	{/if}

	<section class="management-summary" aria-label="Management summary">
		<span class="summary-icon"><Zap size={18} /></span>
		<div><p>Management summary</p><strong>{managementSummary}</strong></div>
		<div class="summary-asof"><span>Data as of</span><strong>{formatDateTime(retrievedAt)}</strong></div>
	</section>

	<section class="kpis" aria-label="Executive key performance indicators">
		<article>
			<span class="kpi-icon"><Zap size={19} /></span>
			<div><p>Accounted energy</p><strong>{energy ? formatNumber(energy.totalKwh) : 'Not available'} <small>{energy ? 'kWh' : ''}</small></strong><span>Register-accounted consumption</span></div>
		</article>
		<article>
			<span class="kpi-icon solar"><SunMedium size={19} /></span>
			<div><p>Solar contribution</p><strong>{energy ? energy.solarPercent.toFixed(1) : '—'}<small>{energy ? '%' : ''}</small></strong><span>{energy ? `${formatNumber(energy.solarKwh)} kWh` : 'Energy mix unavailable'}</span></div>
		</article>
		<article>
			<span class="kpi-icon money"><CircleDollarSign size={19} /></span>
			<div><p>Accrued energy value</p><strong>{revenue ? formatNaira(revenue.summary.accruedEnergyRevenueNgn) : 'Not available'}</strong><span>{revenue ? `Band ${revenue.tariff.tariffBand} · ${revenue.tariff.versionsApplied} tariff version(s)` : 'Valuation unavailable'}</span></div>
		</article>
		<article>
			<span class="kpi-icon signal"><Radio size={19} /></span>
			<div><p>Meter availability</p><strong>{operations ? operations.summary.onlineMeters : '—'} <small>{operations ? `of ${operations.summary.totalMeters} online` : ''}</small></strong><span>{energy ? `${energy.coveragePercent.toFixed(1)}% interval detail` : 'Coverage unavailable'}</span></div>
		</article>
	</section>

	<section class="primary-grid">
		<article class="panel supply-panel">
			<div class="heading">
				<div><p>Supply position</p><h2>What powered the hub</h2></div>
				<div class="heading-actions"><a href={`/energy-mix?${detailQuery}`}>Open energy mix</a><InfoPopover title="How to interpret this mix" label="Explain executive supply mix"><p>Each source shows energy, contribution and accrued energy value for the same reporting window. Energy value is not cash collected or profit.</p>{#if !generatorSeparatelyMetered}<p>Generator energy remains included in the shared AEDC / generator meter until a dedicated generator meter is commissioned.</p>{/if}</InfoPopover></div>
			</div>
			{#if energy && revenue}
				<div class="supply-total"><span>Accounted energy</span><strong>{formatNumber(energy.totalKwh)} kWh</strong><em>{formatNaira(revenue.summary.accruedEnergyRevenueNgn)}</em></div>
				<div class="mix-bar" aria-label={`Solar ${energy.solarPercent.toFixed(1)} percent, ${sharedSupplyLabel} ${energy.gridPercent.toFixed(1)} percent`}>
					<span class="solar-segment" style={`width:${energy.solarPercent}%`}></span>
					<span class="grid-segment" style={`width:${energy.gridPercent}%`}></span>
					{#if generatorSeparatelyMetered}<span class="generator-segment" style={`width:${energy.generatorPercent}%`}></span>{/if}
				</div>
				<div class="source-rows">
					<div><i class="solar-dot"></i><span><strong>Solar energy</strong><small>{formatNumber(energy.solarKwh)} kWh · {energy.solarPercent.toFixed(1)}%</small></span><b>{formatNaira(revenue.summary.solarAccruedRevenueNgn)}</b></div>
					<div><i class="grid-dot"></i><span><strong>{sharedSupplyLabel}</strong><small>{formatNumber(energy.gridKwh)} kWh · {energy.gridPercent.toFixed(1)}%</small></span><b>{formatNaira(revenue.summary.sharedSupplyAccruedRevenueNgn)}</b></div>
					{#if generatorSeparatelyMetered}<div><i class="generator-dot"></i><span><strong>Generator energy</strong><small>{formatNumber(energy.generatorKwh)} kWh · {energy.generatorPercent.toFixed(1)}%</small></span><b>{formatNaira(revenue.summary.generatorAccruedRevenueNgn)}</b></div>{/if}
				</div>
			{:else}
				<div class="empty-state">Energy contribution and valuation are not available for this window.</div>
			{/if}
		</article>

		<article class="panel trend-panel">
			<div class="heading">
				<div><p>Trajectory</p><h2>Energy by source</h2></div>
				<div class="heading-actions"><a href={`/revenue-costs?${detailQuery}`}>Open valuation</a><InfoPopover title="About this trend" label="Explain executive trend"><p>The bars use the same selected reporting window. Solar and conventional supply are stacked so management can see both total consumption and source contribution.</p></InfoPopover></div>
			</div>
			{#if buckets.length > 0}
				<div class="chart-scroll">
					<div class="trend-chart" style={`width:${chartWidth}px`}>
						{#each buckets as bucket, index (bucket.key)}
							<div class="bar-column" title={`${bucket.label}: ${formatNumber(bucket.totalKwh)} kWh`} aria-label={`${bucket.label}: ${formatNumber(bucket.totalKwh)} kilowatt hours`}>
								<div class="bar-stack">
									<span class="grid-bar" style={`height:${heightPercent(bucket.gridKwh)}%`}></span>
									{#if generatorSeparatelyMetered}<span class="generator-bar" style={`height:${heightPercent(bucket.generatorKwh)}%`}></span>{/if}
									<span class="solar-bar" style={`height:${heightPercent(bucket.solarKwh)}%`}></span>
								</div>
								<small>{buckets.length <= 12 || index === 0 || index === buckets.length - 1 || index % Math.ceil(buckets.length / 6) === 0 ? bucket.label : ''}</small>
							</div>
						{/each}
					</div>
				</div>
				<div class="legend"><span><i class="solar-dot"></i>Solar</span><span><i class="grid-dot"></i>{sharedSupplyLabel}</span>{#if generatorSeparatelyMetered}<span><i class="generator-dot"></i>Generator</span>{/if}</div>
			{:else}
				<div class="empty-state">At least one dated energy bucket is required to draw the trend.</div>
			{/if}
		</article>
	</section>

	<section class="secondary-grid">
		<article class="panel floor-panel">
			<div class="heading">
				<div><p>Consumption concentration</p><h2>Highest-usage floors</h2></div>
				<div class="heading-actions"><a href={`/floors?${detailQuery}`}>Open floor operations</a><InfoPopover title="Floor performance boundary" label="Explain floor ranking"><p>This ranking uses customer and tenant meters assigned to permanent floor positions. It is not the same as whole-site incoming supply.</p></InfoPopover></div>
			</div>
			{#if rankedFloors.length > 0}
				<div class="floor-list">
					{#each rankedFloors as floor, index (floor.key)}
						<a href={`/floors/${floor.key}?${detailQuery}`}>
							<span class="rank">{index + 1}</span>
							<span class="floor-name"><strong>{floor.label}</strong><small>{floor.reportingPositionCount} reporting position(s)</small></span>
							<span class="floor-bar"><i style={`width:${floorWidth(floor.usageKwh)}%`}></i></span>
							<span class="floor-value"><strong>{formatNumber(floor.usageKwh)} kWh</strong><small>{formatNaira(floor.estimatedValueNgn)}</small></span>
						</a>
					{/each}
				</div>
			{:else}
				<div class="empty-state">No classified floor consumption is available for this window.</div>
			{/if}
		</article>

		<article class="panel attention-panel">
			<div class="heading">
				<div><p>Decision queue</p><h2>Management attention</h2></div>
				<a href="/exceptions">Open exceptions</a>
			</div>
			{#if attentionItems.length > 0}
				<div class="attention-list">
					{#each attentionItems as item (item.key)}
						<a href={item.href} class:critical={item.severity === 'critical'}>
							<strong>{item.count}</strong>
							<span><b>{item.label}</b><small>{item.action}</small></span>
							<em>{item.severity}</em>
						</a>
					{/each}
				</div>
			{:else}
				<div class="empty-state success"><Gauge size={18} /> No material management exceptions are currently reported.</div>
			{/if}
		</article>
	</section>

	<section class="confidence-strip" aria-label="Executive data confidence">
		<Activity size={17} />
		<div><strong>Data confidence</strong><span>{energy ? `${energy.coveragePercent.toFixed(1)}% interval detail` : 'Coverage unavailable'}{energy && energy.registerRecoveredKwh > 0 ? ` · ${formatNumber(energy.registerRecoveredKwh)} kWh recovered from register movement` : ''}{revenue ? ` · ${revenue.tariff.versionsApplied} effective tariff version(s)` : ''}</span></div>
		<InfoPopover title="What management can trust" label="Explain executive data confidence"><p>Energy totals can include recovered cumulative-register movement after connectivity returns. Recovery preserves total consumption without inventing missing hourly timestamps.</p><p>Energy value is calculated from the tariff effective on each date. Collections, supplier costs and profit remain unavailable until their own verified data sources are integrated.</p></InfoPopover>
	</section>
</AppShell>

<style>
	.executive-actions { display: flex; align-items: stretch; justify-content: space-between; gap: .7rem; margin-bottom: .7rem; }
	.periods { display: grid; flex: 1; grid-template-columns: repeat(3, minmax(0,1fr)); gap: .55rem; }.periods a { padding: .68rem .8rem; border: 1px solid var(--line); border-radius: .78rem; background: color-mix(in srgb,var(--surface) 82%,transparent); color: var(--text); text-decoration: none; }.periods a:hover,.periods a.active { border-color: var(--sky); background: var(--surface); box-shadow: var(--shadow-sm); }.periods a.active { box-shadow: inset 0 -3px 0 var(--teal),var(--shadow-sm); }.periods strong,.periods span { display:block; }.periods strong { color:var(--navy); font-size:.72rem; }.periods span { margin-top:.15rem; color:var(--text-muted); font-size:.55rem; }
	.print-button { display:inline-flex; min-width:7.5rem; align-items:center; justify-content:center; gap:.4rem; padding:.65rem .8rem; border:1px solid var(--line); border-radius:.78rem; background:var(--surface); color:var(--blue); font-size:.66rem; font-weight:800; cursor:pointer; }.print-button:hover { border-color:var(--sky); background:var(--pale-blue); }
	.range-panel,.partial-warning,.management-summary,.panel,.confidence-strip,.kpis article { border:1px solid var(--line); background:var(--surface); box-shadow:var(--shadow-sm); }
	.range-panel { display:grid; grid-template-columns:minmax(10rem,.5fr) auto minmax(28rem,1fr); align-items:end; gap:.8rem 1rem; margin-bottom:.7rem; padding:.78rem .9rem; border-radius:.9rem; }.range-label { display:flex; align-items:center; gap:.55rem; color:var(--blue); }.range-label span,.range-label strong { display:block; }.range-label span { color:var(--text-muted); font-size:.5rem; }.range-label strong { margin-top:.1rem; color:var(--navy); font-size:.7rem; }.range-panel>p { margin:0 0 .42rem; color:var(--text); font-size:.6rem; font-weight:750; }.range-panel>p span { color:var(--text-muted); font-weight:500; }.range-panel form { display:flex; align-items:flex-end; justify-content:flex-end; gap:.4rem; }.range-panel label { display:grid; gap:.22rem; color:var(--text-muted); font-size:.48rem; font-weight:750; }.range-panel input,.range-panel select { min-height:2.05rem; box-sizing:border-box; padding:.4rem .5rem; border:1px solid var(--line); border-radius:.5rem; background:var(--surface-soft); color:var(--text); font-size:.58rem; }.range-panel button { min-height:2.05rem; padding:.4rem .7rem; border:0; border-radius:.5rem; background:var(--action); color:#fff; font-size:.58rem; font-weight:800; cursor:pointer; }
	.partial-warning { display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:.65rem; margin-bottom:.7rem; padding:.7rem .8rem; border-color:color-mix(in srgb,var(--warning) 32%,var(--line)); border-radius:.8rem; color:var(--warning); }.partial-warning strong,.partial-warning span { display:block; }.partial-warning strong { color:var(--navy); font-size:.68rem; }.partial-warning span { margin-top:.12rem; color:var(--text-muted); font-size:.56rem; }
	.management-summary { display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:.75rem; margin-bottom:.7rem; padding:.82rem .9rem; border-radius:.9rem; }.summary-icon { display:grid; width:2.35rem; height:2.35rem; place-items:center; border-radius:.65rem; background:var(--nav-surface); color:#fff; }.management-summary p { margin:0 0 .18rem; color:var(--steel); font-size:.52rem; font-weight:850; letter-spacing:.07em; text-transform:uppercase; }.management-summary>div>strong { display:block; color:var(--navy); font-size:.68rem; line-height:1.5; }.summary-asof { text-align:right; }.summary-asof span { display:block; color:var(--text-muted); font-size:.5rem; }.summary-asof strong { margin-top:.12rem; font-size:.58rem !important; white-space:nowrap; }
	.kpis { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:.65rem; margin-bottom:.7rem; }.kpis article { display:flex; min-width:0; align-items:center; gap:.65rem; padding:.78rem; border-radius:.82rem; }.kpi-icon { display:grid; width:2.35rem; height:2.35rem; flex:0 0 auto; place-items:center; border-radius:.65rem; background:var(--pale-blue); color:var(--blue); }.kpi-icon.solar { background:color-mix(in srgb,var(--sky) 18%,var(--surface)); color:var(--teal); }.kpi-icon.money { background:color-mix(in srgb,var(--success) 13%,var(--surface)); color:var(--success); }.kpi-icon.signal { background:color-mix(in srgb,var(--warning) 12%,var(--surface)); color:var(--warning); }.kpis p,.kpis strong,.kpis div>span { display:block; }.kpis p { margin:0; color:var(--text-muted); font-size:.51rem; }.kpis strong { overflow-wrap:anywhere; margin-top:.16rem; color:var(--navy); font-size:.9rem; line-height:1.2; }.kpis strong small { font-size:.55rem; }.kpis div>span { margin-top:.14rem; color:var(--text-muted); font-size:.49rem; }
	.primary-grid,.secondary-grid { display:grid; gap:.7rem; margin-bottom:.7rem; }.primary-grid { grid-template-columns:minmax(0,1.08fr) minmax(20rem,.92fr); }.secondary-grid { grid-template-columns:minmax(0,1.05fr) minmax(20rem,.95fr); }.panel { min-width:0; padding:.95rem; border-radius:1rem; }.heading { display:flex; align-items:flex-start; justify-content:space-between; gap:.75rem; margin-bottom:.85rem; }.heading p { margin:0 0 .28rem; color:var(--steel); font-size:.54rem; font-weight:850; letter-spacing:.07em; text-transform:uppercase; }.heading h2 { margin:0; color:var(--navy); font-size:1rem; }.heading a { color:var(--blue); font-size:.58rem; font-weight:800; text-decoration:none; }.heading-actions { display:flex; align-items:center; justify-content:flex-end; gap:.35rem; }
	.supply-total { display:grid; grid-template-columns:1fr auto auto; align-items:baseline; gap:.7rem; padding:.65rem .7rem; border-radius:.68rem; background:var(--surface-soft); }.supply-total span { color:var(--text-muted); font-size:.55rem; }.supply-total strong { color:var(--navy); font-size:.78rem; }.supply-total em { color:var(--success); font-size:.76rem; font-style:normal; font-weight:850; }.mix-bar { display:flex; height:.78rem; overflow:hidden; margin:.7rem 0; border-radius:999px; background:var(--line-soft); }.mix-bar span { display:block; height:100%; }.solar-segment,.solar-bar { background:var(--teal); }.grid-segment,.grid-bar { background:var(--nav-surface); }.generator-segment,.generator-bar { background:var(--generator); }.source-rows { display:grid; gap:.28rem; }.source-rows>div { display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:.5rem; padding:.52rem .25rem; border-top:1px solid var(--line-soft); }.source-rows i,.legend i { display:inline-block; width:.58rem; height:.58rem; border-radius:.18rem; }.solar-dot { background:var(--teal); }.grid-dot { background:var(--nav-surface); }.generator-dot { background:var(--generator); }.source-rows strong,.source-rows small { display:block; }.source-rows strong { color:var(--navy); font-size:.63rem; }.source-rows small { margin-top:.08rem; color:var(--text-muted); font-size:.49rem; }.source-rows b { color:var(--navy); font-size:.66rem; }
	.chart-scroll { overflow-x:auto; padding-bottom:.3rem; scrollbar-width:thin; }.trend-chart { display:grid; grid-template-columns:repeat(auto-fit,minmax(1.4rem,1fr)); align-items:end; gap:.25rem; height:11.5rem; padding:.5rem .25rem 0; border-bottom:1px solid var(--line); background:repeating-linear-gradient(to bottom,transparent 0 3.55rem,var(--line-soft) 3.55rem 3.6rem); }.bar-column { display:grid; grid-template-rows:1fr 1.3rem; align-items:end; height:100%; min-width:1.4rem; }.bar-stack { display:flex; width:min(1.2rem,82%); height:100%; flex-direction:column-reverse; justify-self:center; }.bar-stack span { display:block; width:100%; min-height:0; }.bar-stack span:last-child { border-radius:.25rem .25rem 0 0; }.bar-column small { overflow:hidden; color:var(--text-muted); font-size:.42rem; text-align:center; text-overflow:ellipsis; white-space:nowrap; }.legend { display:flex; flex-wrap:wrap; gap:.7rem; margin-top:.55rem; color:var(--text-muted); font-size:.48rem; }.legend span { display:inline-flex; align-items:center; gap:.28rem; }
	.floor-list,.attention-list { display:grid; gap:.38rem; }.floor-list a { display:grid; grid-template-columns:1.65rem minmax(7rem,.8fr) minmax(6rem,1fr) minmax(6rem,.55fr); align-items:center; gap:.5rem; padding:.47rem .5rem; border:1px solid var(--line-soft); border-radius:.65rem; color:inherit; text-decoration:none; }.floor-list a:hover { border-color:var(--sky); background:var(--surface-soft); }.rank { display:grid; width:1.6rem; height:1.6rem; place-items:center; border-radius:.48rem; background:var(--pale-blue); color:var(--blue); font-size:.55rem; font-weight:850; }.floor-name strong,.floor-name small,.floor-value strong,.floor-value small { display:block; }.floor-name strong,.floor-value strong { color:var(--navy); font-size:.58rem; }.floor-name small,.floor-value small { margin-top:.08rem; color:var(--text-muted); font-size:.45rem; }.floor-bar { height:.48rem; overflow:hidden; border-radius:999px; background:var(--line-soft); }.floor-bar i { display:block; height:100%; border-radius:inherit; background:linear-gradient(90deg,var(--blue),var(--sky)); }.floor-value { text-align:right; }
	.attention-list a { display:grid; grid-template-columns:2rem minmax(0,1fr) auto; align-items:center; gap:.55rem; padding:.5rem; border:1px solid var(--line-soft); border-radius:.65rem; color:inherit; text-decoration:none; }.attention-list a:hover { border-color:var(--sky); background:var(--surface-soft); }.attention-list>a>strong { display:grid; width:2rem; height:2rem; place-items:center; border-radius:.58rem; background:color-mix(in srgb,var(--warning) 18%,var(--surface)); color:var(--warning); font-size:.68rem; }.attention-list>a.critical>strong { background:color-mix(in srgb,var(--danger) 15%,var(--surface)); color:var(--danger); }.attention-list b,.attention-list small { display:block; }.attention-list b { color:var(--navy); font-size:.59rem; }.attention-list small { margin-top:.1rem; color:var(--text-muted); font-size:.47rem; line-height:1.35; }.attention-list em { color:var(--warning); font-size:.45rem; font-style:normal; font-weight:850; text-transform:uppercase; }.attention-list a.critical em { color:var(--danger); }
	.empty-state { display:grid; min-height:8rem; place-items:center; padding:1rem; border:1px dashed var(--line); border-radius:.75rem; color:var(--text-muted); font-size:.62rem; text-align:center; }.empty-state.success { min-height:5rem; grid-template-columns:auto auto; justify-content:center; color:var(--success); }
	.confidence-strip { display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:.6rem; padding:.7rem .8rem; border-radius:.8rem; color:var(--blue); }.confidence-strip strong,.confidence-strip span { display:block; }.confidence-strip strong { color:var(--navy); font-size:.62rem; }.confidence-strip span { margin-top:.1rem; color:var(--text-muted); font-size:.5rem; line-height:1.4; }
	@media(max-width:1250px){.range-panel{grid-template-columns:1fr auto}.range-panel form{grid-column:1/-1;justify-content:flex-start}.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.primary-grid,.secondary-grid{grid-template-columns:1fr}}
	@media(max-width:760px){.executive-actions{align-items:stretch;flex-direction:column}.periods{grid-template-columns:1fr}.print-button{min-height:2.75rem}.range-panel{grid-template-columns:1fr}.range-panel>p{margin:0}.range-panel form{align-items:stretch;flex-direction:column}.range-panel input,.range-panel select,.range-panel button{min-height:2.75rem;font-size:.75rem}.management-summary{grid-template-columns:auto minmax(0,1fr)}.summary-asof{grid-column:2;text-align:left}.kpis{grid-template-columns:1fr}.floor-list a{grid-template-columns:1.65rem minmax(0,1fr) auto}.floor-bar{grid-column:2/-1}.floor-value{grid-column:3;grid-row:1;text-align:right}.supply-total{grid-template-columns:1fr auto}.supply-total em{grid-column:1/-1}.heading{align-items:flex-start}.heading-actions{align-items:flex-end;flex-direction:column-reverse}.partial-warning{grid-template-columns:auto minmax(0,1fr)}.partial-warning>:global(.info-popover){grid-column:2}}
	@media(max-width:470px){.management-summary{grid-template-columns:1fr}.summary-icon{display:none}.summary-asof{grid-column:1}.source-rows>div{grid-template-columns:auto minmax(0,1fr)}.source-rows b{grid-column:2}.floor-list a{grid-template-columns:1.65rem minmax(0,1fr)}.floor-value{grid-column:2;grid-row:auto;text-align:left}.floor-bar{grid-column:2}.attention-list a{grid-template-columns:2rem minmax(0,1fr)}.attention-list em{grid-column:2}.confidence-strip{grid-template-columns:auto minmax(0,1fr)}.confidence-strip>:global(.info-popover){grid-column:2}}
	@media print{.executive-actions,.range-panel :global(form),.heading-actions,.print-button{display:none!important}.range-panel{grid-template-columns:1fr auto}.panel,.kpis article,.management-summary,.range-panel,.confidence-strip{box-shadow:none;break-inside:avoid}.primary-grid,.secondary-grid{grid-template-columns:1fr 1fr}:global(.sidebar),:global(.mobile-header){display:none!important}}
</style>
