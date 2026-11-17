<script lang="ts">
	import { untrack } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { Download, FileBarChart2, FileSpreadsheet, FileText } from '@lucide/svelte';
	import AppShell from '#lib/components/AppShell.svelte';
	import InfoPopover from '#lib/components/InfoPopover.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Pagination from '#lib/components/Pagination.svelte';
	import { formatDateTime, formatNaira, formatNumber } from '#lib/format.js';
	import { downloadBrandedExcel, downloadBrandedPdf, type ReportExportDocument, type ReportExportSummary, type ReportExportValue } from '#lib/reporting/reportExport.js';
	import type { MeterOperationalRole, MeterReportScope, MeterSummary } from '#lib/types.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let selectedReport = $state(untrack(() => data.filters.reportType));
	let draftScope = $state<MeterReportScope>(untrack(() => data.filters.scope));
	let selectedMeterIds = $state<string[]>(untrack(() => [...data.filters.meterIds]));
	let page = $state(1);
	let pageSize = $state(10);
	let exporting = $state<'pdf' | 'excel' | null>(null);
	let exportError = $state('');
	const applySelectImmediately = (event: Event, clearMeters = false) => {
		const select = event.currentTarget as HTMLSelectElement;
		const form = select.form;
		if (!form) return;
		if (clearMeters) {
			selectedMeterIds = [];
			for (const input of form.querySelectorAll<HTMLInputElement>('input[name="meterId"]')) {
				input.checked = false;
			}
		}
		form.requestSubmit();
	};
	const roleLabels: Record<MeterOperationalRole, string> = {
		grid_source: 'Grid source',
		solar_source: 'Solar source',
		generator_source: 'Generator source',
		distribution_or_bulk: 'Distribution / bulk',
		customer_load: 'Customer load',
		unknown: 'Unclassified'
	};
	const reportLabels: Record<typeof data.filters.reportType, string> = {
		meter_usage: 'Meter consumption',
		data_quality: 'Meter data quality',
		source_mix: 'Energy-source mix',
		floor_consumption: 'Floor consumption',
		revenue_valuation: 'Revenue valuation',
		operational_status: 'Operational status',
		customer_accounts: 'Customer account snapshot'
	};
	const scopeLabels: Record<MeterReportScope, string> = {
		all: 'All meters — comparison only',
		source: 'Energy-source meters',
		bulk: 'Distribution / bulk meters',
		customer_load: 'Prepaid / customer meters',
		unclassified: 'Unclassified meters'
	};
	let dateBased = $derived(!['operational_status', 'customer_accounts'].includes(selectedReport));
	let meterBased = $derived(['meter_usage', 'data_quality'].includes(selectedReport));
	let grouped = $derived(['source_mix', 'floor_consumption', 'revenue_valuation'].includes(selectedReport));
	const meterMatchesScope = (meter: MeterSummary, scope: MeterReportScope): boolean => {
		if (scope === 'all') return true;
		if (scope === 'source') return ['grid_source', 'solar_source', 'generator_source'].includes(meter.operationalRole);
		if (scope === 'bulk') return meter.operationalRole === 'distribution_or_bulk';
		return scope === 'customer_load' ? meter.operationalRole === 'customer_load' : meter.operationalRole === 'unknown';
	};
	let allMeters = $derived(data.overview?.meters ?? []);
	let scopeCounts = $derived({
		all: allMeters.length,
		source: allMeters.filter((meter) => meterMatchesScope(meter, 'source')).length,
		bulk: allMeters.filter((meter) => meterMatchesScope(meter, 'bulk')).length,
		customer_load: allMeters.filter((meter) => meterMatchesScope(meter, 'customer_load')).length,
		unclassified: allMeters.filter((meter) => meterMatchesScope(meter, 'unclassified')).length
	});
	let availableMeters = $derived(allMeters.filter((meter) => meterMatchesScope(meter, draftScope)));
	let meterRows = $derived(data.filters.reportType === 'data_quality'
		? [...(data.meterReport?.rows ?? [])].sort((left, right) => left.coveragePercent - right.coveragePercent || left.meterNumber.localeCompare(right.meterNumber))
		: data.meterReport?.rows ?? []);
	let sourceRows = $derived(data.energyMix?.sourceMeters ?? []);
	let floorRows = $derived((data.floorAnalysis?.floors ?? []).filter((floor) => floor.key !== 'unclassified'));
	let revenueRows = $derived(data.revenueAnalysis?.buckets ?? []);
	let operationalRows = $derived(data.overview?.meters ?? []);
	let customerRows = $derived(data.overview?.customers ?? []);
	let activeRowCount = $derived((
		data.filters.reportType === 'meter_usage' || data.filters.reportType === 'data_quality' ? meterRows
			: data.filters.reportType === 'source_mix' ? sourceRows
				: data.filters.reportType === 'floor_consumption' ? floorRows
					: data.filters.reportType === 'revenue_valuation' ? revenueRows
						: data.filters.reportType === 'operational_status' ? operationalRows : customerRows
	).length);
	let visibleMeterRows = $derived(meterRows.slice((page - 1) * pageSize, page * pageSize));
	let visibleSourceRows = $derived(sourceRows.slice((page - 1) * pageSize, page * pageSize));
	let visibleFloorRows = $derived(floorRows.slice((page - 1) * pageSize, page * pageSize));
	let visibleRevenueRows = $derived(revenueRows.slice((page - 1) * pageSize, page * pageSize));
	let visibleOperationalRows = $derived(operationalRows.slice((page - 1) * pageSize, page * pageSize));
	let visibleCustomerRows = $derived(customerRows.slice((page - 1) * pageSize, page * pageSize));
	afterNavigate(() => {
		selectedReport = data.filters.reportType;
		draftScope = data.filters.scope;
		selectedMeterIds = [...data.filters.meterIds];
		page = 1;
	});
	let refreshHref = $derived.by(() => {
		const query = new URLSearchParams({
			report: data.filters.reportType,
			from: data.filters.from,
			to: data.filters.to,
			period: data.filters.period,
			scope: data.filters.scope,
			refresh: 'true'
		});
		for (const meterId of data.filters.meterIds) query.append('meterId', meterId);
		return `/reports?${query.toString()}`;
	});

	const changePageSize = (value: number) => { pageSize = value; page = 1; };
	const csvCell = (value: unknown): string => {
		let normalized = value === null || value === undefined ? '' : String(value);
		if (/^[=+@]/.test(normalized)) normalized = `'${normalized}`;
		return /[",\n]/.test(normalized) ? `"${normalized.replaceAll('"', '""')}"` : normalized;
	};
	const csvData = (): { headers: string[]; rows: ReportExportValue[][] } => {
		if (data.filters.reportType === 'meter_usage') return {
			headers: ['Meter', 'Name', 'Role', 'Customer', 'Opening register kWh', 'Closing register kWh', 'Recorded kWh', 'Recovered kWh', 'Total kWh', 'Estimated value NGN', 'Coverage %'],
			rows: meterRows.map((row) => [row.meterNumber, row.name, roleLabels[row.operationalRole], row.customerName, row.openingRegisterKwh, row.closingRegisterKwh, row.recordedUsageKwh, row.registerRecoveredKwh, row.usageKwh, row.estimatedValueNgn, row.coveragePercent])
		};
		if (data.filters.reportType === 'data_quality') return {
			headers: ['Meter', 'Role', 'Observed intervals', 'Expected intervals', 'Coverage %', 'Recovered kWh', 'Recovery events', 'Anomalies', 'Ignored register drops', 'Latest reading'],
			rows: meterRows.map((row) => [row.meterNumber, roleLabels[row.operationalRole], row.observedIntervals, row.expectedIntervals, row.coveragePercent, row.registerRecoveredKwh, row.recoveryEvents, row.anomalyCount, row.ignoredRegisterDrops, row.latestReadingAt])
		};
		if (data.filters.reportType === 'source_mix') return {
			headers: ['Meter', 'Role', 'Recorded kWh', 'Recovered kWh', 'Observed intervals', 'First reading', 'Latest reading'],
			rows: sourceRows.map((row) => [row.meterNumber, row.role, row.recordedUsageKwh, row.registerRecoveredKwh, row.observedIntervals, row.firstReadingAt, row.latestReadingAt])
		};
		if (data.filters.reportType === 'floor_consumption') return {
			headers: ['Floor', 'Positions', 'Metered positions', 'Reporting positions', 'Usage kWh', 'Recovered kWh', 'Estimated value NGN', 'Coverage %'],
			rows: floorRows.map((row) => [row.label, row.positionCount, row.meteredPositionCount, row.reportingPositionCount, row.usageKwh, row.registerRecoveredKwh, row.estimatedValueNgn, row.coveragePercent])
		};
		if (data.filters.reportType === 'revenue_valuation') return {
			headers: ['Period', 'Total kWh', 'Solar kWh', 'Grid/shared supply kWh', 'Generator kWh', 'Accrued revenue NGN', 'Solar revenue NGN', 'Shared supply revenue NGN', 'Coverage %'],
			rows: revenueRows.map((row) => [row.label, row.totalKwh, row.solarKwh, row.gridKwh, row.generatorKwh, row.accruedEnergyRevenueNgn, row.solarAccruedRevenueNgn, row.sharedSupplyAccruedRevenueNgn, row.coveragePercent])
		};
		if (data.filters.reportType === 'operational_status') return {
			headers: ['Meter', 'Name', 'Role', 'Customer', 'Connectivity', 'Last reading', 'Latest register kWh', 'Relay state', 'SIM provider'],
			rows: operationalRows.map((row) => [row.meterNumber, row.name, roleLabels[row.operationalRole], row.customerName, row.connectivityLabel, row.lastReadingAt, row.latestReadingKwh, row.relayOn, row.simProvider])
		};
		return {
			headers: ['Customer', 'Account', 'Assigned meter', 'Naira balance', 'Energy balance kWh', 'Tariff band', 'Rate NGN/kWh', 'Site'],
			rows: customerRows.map((row) => [row.displayName, row.accountNumber, row.assignedMeterNumber, row.accountBalance, row.energyBalanceKwh, row.tariffBand, row.energyPrice, row.siteName])
		};
	};
	const reportFileName = (): string => `microaccess-${data.filters.reportType.replaceAll('_', '-')}-${data.filters.from}-${data.filters.to}`;
	const downloadCsv = () => {
		const report = csvData();
		const csv = [report.headers, ...report.rows].map((row) => row.map(csvCell).join(',')).join('\n');
		const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
		const href = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = href;
		anchor.download = `${reportFileName()}.csv`;
		anchor.click();
		setTimeout(() => URL.revokeObjectURL(href), 1_000);
	};
	const ngn = (value: number | null): string => value === null ? 'Not provided' : `NGN ${formatNumber(value)}`;
	const exportSummary = (): ReportExportSummary[] => {
		if (data.meterReport) {
			const summary = data.meterReport.summary;
			return [
				{ label: 'Meters selected', value: String(summary.meterCount), detail: `${summary.reportingMeterCount} reporting` },
				{ label: 'Energy used', value: summary.aggregateComparable ? `${formatNumber(summary.totalUsageKwh)} kWh` : 'Not combined', detail: summary.aggregateComparable ? `${formatNumber(summary.registerRecoveredKwh)} kWh recovered` : 'Mixed meter roles' },
				{ label: 'Energy value', value: summary.aggregateComparable ? ngn(summary.estimatedValueNgn) : 'Not combined', detail: `${data.meterReport.tariff.versionsApplied} tariff version(s)` },
				{ label: 'Reading coverage', value: `${summary.coveragePercent.toFixed(1)}%`, detail: `${summary.observedIntervals} of ${summary.expectedIntervals} intervals` }
			];
		}
		if (data.energyMix) {
			const summary = data.energyMix.summary;
			return [
				{ label: 'Total source energy', value: `${formatNumber(summary.totalKwh)} kWh`, detail: `${formatNumber(summary.registerRecoveredKwh)} kWh recovered` },
				{ label: 'Solar', value: `${formatNumber(summary.solarKwh)} kWh`, detail: `${summary.solarPercent.toFixed(1)}% of source energy` },
				{ label: 'Grid / shared supply', value: `${formatNumber(summary.gridKwh)} kWh`, detail: `${summary.gridPercent.toFixed(1)}% of source energy` },
				{ label: 'Reading coverage', value: `${summary.coveragePercent.toFixed(1)}%`, detail: `${summary.matchedIntervals} matched intervals` }
			];
		}
		if (data.floorAnalysis) {
			const summary = data.floorAnalysis.summary;
			return [
				{ label: 'Tenant energy', value: `${formatNumber(summary.totalUsageKwh)} kWh`, detail: `${formatNumber(summary.registerRecoveredKwh)} kWh recovered` },
				{ label: 'Energy value', value: ngn(summary.estimatedValueNgn), detail: 'Effective tariff valuation' },
				{ label: 'Reporting positions', value: String(summary.reportingPositions), detail: `${summary.meteredPositions} metered positions` },
				{ label: 'Reading coverage', value: `${summary.coveragePercent.toFixed(1)}%`, detail: `${formatNumber(summary.unattributedUsageKwh)} kWh unattributed` }
			];
		}
		if (data.revenueAnalysis) {
			const summary = data.revenueAnalysis.summary;
			return [
				{ label: 'Accrued energy revenue', value: ngn(summary.accruedEnergyRevenueNgn), detail: `${formatNumber(summary.totalKwh)} kWh valued` },
				{ label: 'Solar revenue', value: ngn(summary.solarAccruedRevenueNgn), detail: `${formatNumber(summary.solarKwh)} kWh` },
				{ label: 'Shared supply revenue', value: ngn(summary.sharedSupplyAccruedRevenueNgn), detail: `${formatNumber(summary.gridKwh)} kWh` },
				{ label: 'Reading coverage', value: `${summary.coveragePercent.toFixed(1)}%`, detail: 'Collections remain separate' }
			];
		}
		if (data.filters.reportType === 'operational_status' && data.overview) {
			const summary = data.overview.summary;
			return [
				{ label: 'Total meters', value: String(summary.totalMeters), detail: `${summary.sourceMeters} source meters` },
				{ label: 'Online now', value: String(summary.onlineMeters), detail: 'Current provider status' },
				{ label: 'Never online', value: String(summary.neverOnlineMeters), detail: 'Commissioning evidence required' },
				{ label: 'Unassigned', value: String(summary.unassignedMeters), detail: 'No observed customer' }
			];
		}
		if (data.overview) {
			const summary = data.overview.summary;
			return [
				{ label: 'Customers', value: String(summary.totalCustomers), detail: 'Provider accounts' },
				{ label: 'With observed meter', value: String(summary.totalCustomers - summary.customersWithoutMeter), detail: 'Current assignments' },
				{ label: 'Without meter', value: String(summary.customersWithoutMeter), detail: 'Assignment required' },
				{ label: 'Current rows', value: String(customerRows.length), detail: 'Complete filtered snapshot' }
			];
		}
		return [];
	};
	const exportNotes = (): string[] => {
		const notes = ['This document contains every filtered row; screen pagination does not limit the export.'];
		if (data.filters.reportType === 'data_quality') notes.push('Reading coverage is the proportion of expected reporting intervals that contain an observed meter reading.');
		if (data.filters.reportType === 'revenue_valuation') notes.push('Accrued energy revenue is valued from register-accounted consumption at the effective tariff. Recorded collections remain a separate commercial measure.');
		if (data.filters.reportType === 'source_mix') notes.push('Source, bulk and downstream meters are kept as separate scopes to prevent energy from being counted twice.');
		for (const warning of data.meterReport?.warnings ?? data.energyMix?.warnings ?? data.floorAnalysis?.warnings ?? data.revenueAnalysis?.warnings ?? []) notes.push(warning);
		return notes;
	};
	const buildExportDocument = (): ReportExportDocument => {
		const table = csvData();
		const isSnapshot = ['operational_status', 'customer_accounts'].includes(data.filters.reportType);
		const specificMeters = data.filters.meterIds.length > 0 ? ` · ${data.filters.meterIds.length} specific meter(s)` : '';
		const retrievedAt = data.meterReport?.dataSource.retrievedAt
			?? data.energyMix?.dataSource.retrievedAt
			?? data.floorAnalysis?.dataSource.retrievedAt
			?? data.revenueAnalysis?.dataSource.retrievedAt
			?? data.overview?.dataSource.retrievedAt
			?? null;
		return {
			fileName: reportFileName(),
			title: reportLabels[data.filters.reportType],
			reportingWindow: isSnapshot
				? `Current provider snapshot · ${formatDateTime(data.overview?.dataSource.retrievedAt ?? null)}`
				: `${data.filters.from} to ${data.filters.to} · Africa/Lagos`,
			scope: meterBased ? `${scopeLabels[data.filters.scope]}${specificMeters}` : grouped ? `Na-Aka Hub · grouped ${data.filters.period}` : 'Na-Aka Hub · complete provider snapshot',
			generatedAt: new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' }).format(new Date()),
			source: `SteamaCo live read-only via MSM · ${formatDateTime(retrievedAt)}`,
			summary: exportSummary(),
			headers: table.headers,
			rows: table.rows,
			notes: exportNotes()
		};
	};
	const runExport = async (format: 'pdf' | 'excel') => {
		exportError = '';
		exporting = format;
		try {
			const report = buildExportDocument();
			if (format === 'pdf') await downloadBrandedPdf(report);
			else await downloadBrandedExcel(report);
		} catch (error) {
			exportError = error instanceof Error ? error.message : 'The report export could not be created.';
		} finally {
			exporting = null;
		}
	};
</script>

<svelte:head><title>Reports & analytics | MicroAccess Smart Metering</title></svelte:head>
<AppShell active="reports">
	<PageHeader eyebrow="Management and energy intelligence" title="Reports & analytics" description="Generate filtered operational, consumption, source, floor, customer and revenue reports from retained MSM data." {refreshHref} />

	<section class="builder panel">
		<div class="heading"><div><p>Report builder</p><h2>Choose the report and its data boundary</h2></div><FileBarChart2 size={20} /></div>
		<form method="GET" action="/reports">
			<label>Report type<select name="report" bind:value={selectedReport} onchange={(event) => applySelectImmediately(event, true)}>{#each Object.entries(reportLabels) as [key, label]}<option value={key}>{label}</option>{/each}</select></label>
			{#if dateBased}
				<label>From<input type="date" name="from" value={data.filters.from} max={data.today} required /></label>
				<label>To<input type="date" name="to" value={data.filters.to} max={data.today} required /></label>
			{/if}
			{#if grouped}<label>Group by<select name="period" value={data.filters.period}><option value="hourly">Hourly</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>{/if}
			{#if meterBased}<label>Meter category<select name="scope" bind:value={draftScope} onchange={(event) => applySelectImmediately(event, true)}><option value="customer_load">Prepaid / customer meters ({scopeCounts.customer_load})</option><option value="source">Energy-source meters ({scopeCounts.source})</option><option value="bulk">Distribution / bulk meters ({scopeCounts.bulk})</option><option value="unclassified">Unclassified meters ({scopeCounts.unclassified})</option><option value="all">All meters ({scopeCounts.all}) — comparison only</option></select></label>{/if}
			<button type="submit">Generate report</button>
			<a href="/reports">Reset</a>
			{#if meterBased}
				<details class="meter-picker">
					<summary>{selectedMeterIds.length > 0 ? `${selectedMeterIds.length} specific meter(s) selected` : `All ${availableMeters.length} meters in this category`}</summary>
					<div class="meter-options">{#each availableMeters as meter (meter.providerId)}<label><input type="checkbox" name="meterId" value={meter.providerId} bind:group={selectedMeterIds} /><span><strong>{meter.meterNumber}</strong><small>{meter.name} · {meter.customerName ?? roleLabels[meter.operationalRole]}</small></span></label>{/each}</div>
					<p>Leave every box clear to include all meters in the selected scope.</p>
				</details>
			{/if}
		</form>
	</section>

	{#if data.error}
		<section class="state">{data.error.message}</section>
	{:else}
		<section class="report-heading panel">
			<div><p>Generated report</p><h2>{reportLabels[data.filters.reportType]}</h2><span>{!['operational_status', 'customer_accounts'].includes(data.filters.reportType) ? `${data.filters.from} to ${data.filters.to}` : `Current provider snapshot · ${formatDateTime(data.overview?.dataSource.retrievedAt ?? null)}`}</span></div>
			<div class="actions">
				<button type="button" class="primary-export" disabled={exporting !== null} onclick={() => runExport('pdf')}><FileText size={15} />{exporting === 'pdf' ? 'Building PDF…' : 'Download PDF'}</button>
				<button type="button" disabled={exporting !== null} onclick={() => runExport('excel')}><FileSpreadsheet size={15} />{exporting === 'excel' ? 'Building Excel…' : 'Download Excel'}</button>
				<button type="button" disabled={exporting !== null} onclick={downloadCsv}><Download size={15} />Data CSV</button>
				<InfoPopover title="Export formats" label="Explain report exports"><p>PDF is a branded, print-ready report. Excel contains the same complete data set with branding, filters and spreadsheet formatting. CSV remains a plain, system-friendly file because the format cannot store logos, colours or page design.</p>{#if data.meterReport?.warnings.length}<ul>{#each data.meterReport.warnings as warning}<li>{warning}</li>{/each}</ul>{/if}</InfoPopover>
			</div>
		</section>
		{#if exportError}<p class="export-error" role="alert">{exportError}</p>{/if}

		{#if data.meterReport}
			{@const summary = data.meterReport.summary}
			<section class="kpis"><article><span>Meters selected</span><strong>{summary.meterCount}</strong><small>{summary.reportingMeterCount} reporting</small></article><article><span>Energy used</span><strong>{summary.aggregateComparable ? `${formatNumber(summary.totalUsageKwh)} kWh` : 'Not combined'}</strong><small>{summary.aggregateComparable ? `${formatNumber(summary.registerRecoveredKwh)} kWh recovered` : 'Mixed meter roles'}</small></article><article><span>Energy value</span><strong>{summary.aggregateComparable ? formatNaira(summary.estimatedValueNgn) : 'Not combined'}</strong><small>{data.meterReport.tariff.versionsApplied} tariff version(s)</small></article><article><span>Reading coverage</span><strong>{summary.coveragePercent.toFixed(1)}%</strong><small>{summary.observedIntervals} of {summary.expectedIntervals} intervals</small></article></section>
		{:else if data.energyMix}
			{@const summary = data.energyMix.summary}
			<section class="kpis"><article><span>Total source energy</span><strong>{formatNumber(summary.totalKwh)} kWh</strong><small>{formatNumber(summary.registerRecoveredKwh)} kWh recovered</small></article><article><span>Solar</span><strong>{formatNumber(summary.solarKwh)} kWh</strong><small>{summary.solarPercent.toFixed(1)}%</small></article><article><span>Grid / shared supply</span><strong>{formatNumber(summary.gridKwh)} kWh</strong><small>{summary.gridPercent.toFixed(1)}%</small></article><article><span>Coverage</span><strong>{summary.coveragePercent.toFixed(1)}%</strong><small>{summary.matchedIntervals} matched intervals</small></article></section>
		{:else if data.floorAnalysis}
			{@const summary = data.floorAnalysis.summary}
			<section class="kpis"><article><span>Tenant energy</span><strong>{formatNumber(summary.totalUsageKwh)} kWh</strong><small>{formatNumber(summary.registerRecoveredKwh)} kWh recovered</small></article><article><span>Energy value</span><strong>{formatNaira(summary.estimatedValueNgn)}</strong><small>Effective tariff valuation</small></article><article><span>Reporting positions</span><strong>{summary.reportingPositions}</strong><small>{summary.meteredPositions} metered</small></article><article><span>Coverage</span><strong>{summary.coveragePercent.toFixed(1)}%</strong><small>{summary.unattributedUsageKwh} kWh unattributed</small></article></section>
		{:else if data.revenueAnalysis}
			{@const summary = data.revenueAnalysis.summary}
			<section class="kpis"><article><span>Accrued energy revenue</span><strong>{formatNaira(summary.accruedEnergyRevenueNgn)}</strong><small>{formatNumber(summary.totalKwh)} kWh</small></article><article><span>Solar revenue</span><strong>{formatNaira(summary.solarAccruedRevenueNgn)}</strong><small>{formatNumber(summary.solarKwh)} kWh</small></article><article><span>Shared supply revenue</span><strong>{formatNaira(summary.sharedSupplyAccruedRevenueNgn)}</strong><small>{formatNumber(summary.gridKwh)} kWh</small></article><article><span>Coverage</span><strong>{summary.coveragePercent.toFixed(1)}%</strong><small>Collections remain separate</small></article></section>
		{:else if data.filters.reportType === 'operational_status' && data.overview}
			{@const summary = data.overview.summary}<section class="kpis"><article><span>Total meters</span><strong>{summary.totalMeters}</strong><small>{summary.sourceMeters} source meters</small></article><article><span>Online now</span><strong>{summary.onlineMeters}</strong><small>Current provider status</small></article><article><span>Never online</span><strong>{summary.neverOnlineMeters}</strong><small>Requires commissioning</small></article><article><span>Unassigned</span><strong>{summary.unassignedMeters}</strong><small>No observed customer</small></article></section>
		{:else if data.overview}
			{@const summary = data.overview.summary}<section class="kpis"><article><span>Customers</span><strong>{summary.totalCustomers}</strong><small>Provider accounts</small></article><article><span>With observed meter</span><strong>{summary.totalCustomers - summary.customersWithoutMeter}</strong><small>Current assignments</small></article><article><span>Without meter</span><strong>{summary.customersWithoutMeter}</strong><small>Assignment required</small></article><article><span>Tariff</span><strong>Effective rate</strong><small>Shown per customer row</small></article></section>
		{/if}

		<section class="results panel">
			<div class="heading"><div><p>Report results</p><h2>{activeRowCount} row{activeRowCount === 1 ? '' : 's'}</h2></div></div>
			<div class="table-wrap"><table>
				{#if data.filters.reportType === 'meter_usage'}
					<thead><tr><th>Meter</th><th>Role / customer</th><th>Opening register</th><th>Closing register</th><th>Energy used</th><th>Estimated value</th><th>Coverage</th></tr></thead><tbody>{#each visibleMeterRows as row (row.providerId)}<tr><td data-label="Meter"><a href={`/meters/${row.providerId}`}><strong>{row.meterNumber}</strong><span>{row.name}</span></a></td><td data-label="Role / customer">{roleLabels[row.operationalRole]}<span>{row.customerName ?? 'No customer'}</span></td><td data-label="Opening register">{formatNumber(row.openingRegisterKwh)} kWh</td><td data-label="Closing register">{formatNumber(row.closingRegisterKwh)} kWh</td><td data-label="Energy used"><strong>{formatNumber(row.usageKwh)} kWh</strong><span>{formatNumber(row.registerRecoveredKwh)} recovered</span></td><td data-label="Estimated value">{formatNaira(row.estimatedValueNgn)}</td><td data-label="Coverage">{row.coveragePercent.toFixed(1)}%</td></tr>{/each}</tbody>
				{:else if data.filters.reportType === 'data_quality'}
					<thead><tr><th>Meter</th><th>Coverage</th><th>Observed / expected</th><th>Recovered energy</th><th>Recovery events</th><th>Anomalies</th><th>Register drops</th></tr></thead><tbody>{#each visibleMeterRows as row (row.providerId)}<tr><td data-label="Meter"><a href={`/meters/${row.providerId}`}><strong>{row.meterNumber}</strong><span>{roleLabels[row.operationalRole]}</span></a></td><td data-label="Coverage">{row.coveragePercent.toFixed(1)}%</td><td data-label="Observed / expected">{row.observedIntervals} / {row.expectedIntervals}</td><td data-label="Recovered energy">{formatNumber(row.registerRecoveredKwh)} kWh</td><td data-label="Recovery events">{row.recoveryEvents}</td><td data-label="Anomalies">{row.anomalyCount}</td><td data-label="Register drops">{row.ignoredRegisterDrops}</td></tr>{/each}</tbody>
				{:else if data.filters.reportType === 'source_mix'}
					<thead><tr><th>Meter</th><th>Role</th><th>Recorded usage</th><th>Recovered usage</th><th>Intervals</th><th>Reading window</th></tr></thead><tbody>{#each visibleSourceRows as row (row.providerId)}<tr><td data-label="Meter"><a href={`/meters/${row.providerId}`}><strong>{row.meterNumber}</strong><span>{row.name}</span></a></td><td data-label="Role">{roleLabels[row.role]}</td><td data-label="Recorded usage">{formatNumber(row.recordedUsageKwh)} kWh</td><td data-label="Recovered usage">{formatNumber(row.registerRecoveredKwh)} kWh</td><td data-label="Intervals">{row.observedIntervals}</td><td data-label="Reading window">{formatDateTime(row.firstReadingAt)}<span>to {formatDateTime(row.latestReadingAt)}</span></td></tr>{/each}</tbody>
				{:else if data.filters.reportType === 'floor_consumption'}
					<thead><tr><th>Floor</th><th>Positions</th><th>Metered</th><th>Reporting</th><th>Energy used</th><th>Recovered</th><th>Value</th><th>Coverage</th></tr></thead><tbody>{#each visibleFloorRows as row (row.key)}<tr><td data-label="Floor"><a href={`/floors/${row.key}?period=${data.filters.period}&from=${data.filters.from}&to=${data.filters.to}`}><strong>{row.label}</strong></a></td><td data-label="Positions">{row.positionCount}</td><td data-label="Metered">{row.meteredPositionCount}</td><td data-label="Reporting">{row.reportingPositionCount}</td><td data-label="Energy used">{formatNumber(row.usageKwh)} kWh</td><td data-label="Recovered">{formatNumber(row.registerRecoveredKwh)} kWh</td><td data-label="Value">{formatNaira(row.estimatedValueNgn)}</td><td data-label="Coverage">{row.coveragePercent.toFixed(1)}%</td></tr>{/each}</tbody>
				{:else if data.filters.reportType === 'revenue_valuation'}
					<thead><tr><th>Period</th><th>Total energy</th><th>Solar</th><th>Grid / shared</th><th>Generator</th><th>Accrued revenue</th><th>Coverage</th></tr></thead><tbody>{#each visibleRevenueRows as row (row.key)}<tr><td data-label="Period"><strong>{row.label}</strong><span>{formatDateTime(row.from)} – {formatDateTime(row.to)}</span></td><td data-label="Total energy">{formatNumber(row.totalKwh)} kWh</td><td data-label="Solar">{formatNumber(row.solarKwh)} kWh</td><td data-label="Grid / shared">{formatNumber(row.gridKwh)} kWh</td><td data-label="Generator">{formatNumber(row.generatorKwh)} kWh</td><td data-label="Accrued revenue">{formatNaira(row.accruedEnergyRevenueNgn)}</td><td data-label="Coverage">{row.coveragePercent.toFixed(1)}%</td></tr>{/each}</tbody>
				{:else if data.filters.reportType === 'operational_status'}
					<thead><tr><th>Meter</th><th>Role</th><th>Customer</th><th>Connectivity</th><th>Last reading</th><th>Register</th><th>Relay</th></tr></thead><tbody>{#each visibleOperationalRows as row (row.providerId)}<tr><td data-label="Meter"><a href={`/meters/${row.providerId}`}><strong>{row.meterNumber}</strong><span>{row.name}</span></a></td><td data-label="Role">{roleLabels[row.operationalRole]}</td><td data-label="Customer">{row.customerName ?? 'Unassigned'}</td><td data-label="Connectivity">{row.connectivityLabel}</td><td data-label="Last reading">{formatDateTime(row.lastReadingAt)}</td><td data-label="Register">{formatNumber(row.latestReadingKwh)} kWh</td><td data-label="Relay">{row.relayOn === null ? 'Not provided' : row.relayOn ? 'On' : 'Off'}</td></tr>{/each}</tbody>
				{:else}
					<thead><tr><th>Customer</th><th>Meter</th><th>Naira balance</th><th>Energy balance</th><th>Tariff</th><th>Site</th></tr></thead><tbody>{#each visibleCustomerRows as row (row.providerId)}<tr><td data-label="Customer"><a href={`/customers/${row.providerId}`}><strong>{row.displayName}</strong><span>{row.accountNumber || 'No account number'}</span></a></td><td data-label="Meter">{row.assignedMeterNumber ?? 'Unassigned'}</td><td data-label="Naira balance">{formatNaira(row.accountBalance)}</td><td data-label="Energy balance">{formatNumber(row.energyBalanceKwh)} kWh</td><td data-label="Tariff">{row.tariffBand}<span>{formatNaira(row.energyPrice)}/kWh</span></td><td data-label="Site">{row.siteName}</td></tr>{/each}</tbody>
				{/if}
			</table></div>
			<Pagination total={activeRowCount} {page} {pageSize} onPageChange={(value) => page = value} onPageSizeChange={changePageSize} />
		</section>
	{/if}
</AppShell>

<style>
	.panel,.state { border: 1px solid var(--line); border-radius: 1rem; background: var(--surface); box-shadow: var(--shadow-sm); }.panel { padding: 1rem; }.state { padding: 1rem; color: var(--danger); }
	.heading { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; }.heading p,.report-heading p { margin:0 0 .3rem; color:var(--steel); font-size:.6rem; font-weight:850; letter-spacing:.06em; text-transform:uppercase; }.heading h2,.report-heading h2 { margin:0; color:var(--navy); font-size:1.05rem; }.heading>:global(svg){color:var(--teal)}
	.builder { margin-bottom:.75rem; }.builder form { display:grid; grid-template-columns: minmax(13rem,1.2fr) repeat(4,minmax(8rem,.7fr)) auto auto; gap:.55rem; align-items:end; margin-top:1rem; }.builder form>label { display:grid; gap:.25rem; color:var(--text-muted); font-size:.53rem; font-weight:750; }.builder select,.builder input { min-height:2.2rem; box-sizing:border-box; padding:.45rem .58rem; border:1px solid var(--line); border-radius:.58rem; background:var(--surface-soft); color:var(--text); font-size:.62rem; }.builder form>button,.builder form>a { display:inline-flex; min-height:2.2rem; box-sizing:border-box; align-items:center; justify-content:center; padding:.5rem .75rem; border:0; border-radius:.58rem; background:var(--action); color:white; font-size:.6rem; font-weight:800; text-decoration:none; cursor:pointer; }.builder form>a { border:1px solid var(--line); background:var(--surface-soft); color:var(--text); }
	.meter-picker { grid-column:1/-1; padding:.65rem .75rem; border:1px solid var(--line-soft); border-radius:.65rem; background:var(--surface-soft); }.meter-picker summary { color:var(--blue); font-size:.62rem; font-weight:800; cursor:pointer; }.meter-options { display:grid; grid-template-columns:repeat(4,1fr); gap:.4rem; margin-top:.65rem; }.meter-options label { display:flex; align-items:flex-start; gap:.45rem; padding:.5rem; border:1px solid var(--line-soft); border-radius:.55rem; background:var(--surface); cursor:pointer; }.meter-options input { min-height:auto; margin-top:.1rem; }.meter-options strong,.meter-options small { display:block; }.meter-options strong { color:var(--navy); font-size:.6rem; }.meter-options small,.meter-picker p { margin:.12rem 0 0; color:var(--text-muted); font-size:.5rem; }
	.report-heading { display:flex; align-items:center; justify-content:space-between; gap:1rem; }.report-heading span { color:var(--text-muted); font-size:.57rem; }.actions { display:flex; align-items:center; gap:.45rem; }.actions button { display:inline-flex; align-items:center; gap:.35rem; padding:.48rem .65rem; border:1px solid var(--line); border-radius:.55rem; background:var(--surface); color:var(--blue); font-size:.57rem; font-weight:800; cursor:pointer; }.actions button:hover { border-color:var(--sky); background:var(--surface-soft); }.actions button:disabled{opacity:.6;cursor:wait}.actions .primary-export{border-color:var(--action);background:var(--action);color:white}.actions .primary-export:hover{border-color:var(--blue);background:var(--blue)}.export-error{margin:.55rem 0 0;padding:.6rem .75rem;border:1px solid color-mix(in srgb,var(--danger) 35%,var(--line));border-radius:.65rem;background:color-mix(in srgb,var(--danger) 8%,var(--surface));color:var(--danger);font-size:.58rem;font-weight:700}
	.kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:.65rem; margin:.75rem 0; }.kpis article { padding:.8rem; border:1px solid var(--line); border-radius:.8rem; background:var(--surface); box-shadow:var(--shadow-sm); }.kpis span,.kpis strong,.kpis small { display:block; }.kpis span { color:var(--text-muted); font-size:.55rem; }.kpis strong { margin-top:.25rem; color:var(--navy); font-size:.9rem; }.kpis small { margin-top:.15rem; color:var(--text-muted); font-size:.5rem; }
	.results .heading { margin-bottom:.8rem; }.table-wrap { overflow:auto; border:1px solid var(--line-soft); border-radius:.75rem; scrollbar-gutter:stable; overscroll-behavior-inline:contain; }table { width:100%; border-collapse:collapse; font-size:.63rem; }th { padding:.65rem; background:var(--surface-soft); color:var(--text-muted); font-size:.52rem; text-align:left; text-transform:uppercase; white-space:nowrap; }td { padding:.68rem .65rem; border-top:1px solid var(--line-soft); white-space:nowrap; }td a { color:inherit; text-decoration:none; }td strong,td span { display:block; }td strong { color:var(--navy); }td span { margin-top:.14rem; color:var(--text-muted); font-size:.52rem; }
	@media(max-width:1200px){.builder form{grid-template-columns:repeat(3,1fr)}.meter-options{grid-template-columns:repeat(3,1fr)}}@media(max-width:899px){.builder form{grid-template-columns:repeat(2,1fr)}.meter-options{grid-template-columns:repeat(2,1fr)}.kpis{grid-template-columns:repeat(2,1fr)}}@media(max-width:599px){.builder form,.meter-options{grid-template-columns:1fr}.builder form>button,.builder form>a{min-height:2.75rem}.report-heading{align-items:flex-start;flex-direction:column}.actions{width:100%;flex-wrap:wrap}.actions button{min-height:2.75rem;flex:1 1 auto}.table-wrap{overflow:visible;border:0}.table-wrap table,.table-wrap tbody,.table-wrap tr,.table-wrap td{display:block;width:100%;box-sizing:border-box}.table-wrap thead{display:none}.table-wrap tbody{display:grid;gap:.75rem}.table-wrap tr{overflow:hidden;border:1px solid var(--line);border-radius:.85rem;background:var(--surface);box-shadow:var(--shadow-sm)}.table-wrap td{display:grid;grid-template-columns:minmax(7.3rem,40%) minmax(0,1fr);align-items:center;gap:.6rem;padding:.62rem .72rem;border-top:1px solid var(--line-soft);white-space:normal;overflow-wrap:anywhere}.table-wrap td:first-child{border-top:0}.table-wrap td::before{color:var(--text-muted);content:attr(data-label);font-size:.68rem;font-weight:800;text-transform:uppercase}}
	@media print { :global(.sidebar),.builder,.actions { display:none!important; }.panel { box-shadow:none; }.results { padding:0; border:0; } }
</style>
