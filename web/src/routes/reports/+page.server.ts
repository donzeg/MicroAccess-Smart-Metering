import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	loadEnergyMix,
	loadFloorAnalysis,
	loadMeterUsageReport,
	loadOperationsOverview,
	loadRevenueAnalysis
} from '#lib/server/msmApi.js';
import { clearManagementSession } from '#lib/server/session.js';
import type { EnergyMixPeriod, MeterReportScope } from '#lib/types.js';

const reportTypes = [
	'meter_usage',
	'data_quality',
	'source_mix',
	'floor_consumption',
	'revenue_valuation',
	'operational_status',
	'customer_accounts'
] as const;
type ReportType = (typeof reportTypes)[number];

const scopes: MeterReportScope[] = ['all', 'source', 'bulk', 'customer_load', 'unclassified'];
const periods: EnergyMixPeriod[] = ['hourly', 'daily', 'weekly', 'monthly'];
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const dateOnly = (date: Date): string => date.toISOString().slice(0, 10);

export const load: PageServerLoad = async ({ cookies, fetch, url }) => {
	const token = cookies.get('msm_session');
	if (!token) redirect(303, '/login');
	const refresh = url.searchParams.get('refresh') === 'true';
	const requestedReport = url.searchParams.get('report');
	const reportType: ReportType = reportTypes.includes(requestedReport as ReportType)
		? (requestedReport as ReportType)
		: 'meter_usage';
	const requestedScope = url.searchParams.get('scope');
	const scope: MeterReportScope = scopes.includes(requestedScope as MeterReportScope)
		? (requestedScope as MeterReportScope)
		: 'customer_load';
	const requestedPeriod = url.searchParams.get('period');
	const period: EnergyMixPeriod = periods.includes(requestedPeriod as EnergyMixPeriod)
		? (requestedPeriod as EnergyMixPeriod)
		: 'monthly';
	const now = new Date();
	const today = dateOnly(now);
	const defaultFrom = `${now.getUTCFullYear()}-01-01`;
	const requestedFrom = url.searchParams.get('from') ?? '';
	const requestedTo = url.searchParams.get('to') ?? '';
	const from = datePattern.test(requestedFrom) ? requestedFrom : defaultFrom;
	const to = datePattern.test(requestedTo) ? requestedTo : today;
	const meterIds = Array.from(
		new Set(url.searchParams.getAll('meterId').filter((value) => /^\d{1,32}$/.test(value)))
	).slice(0, 100);

	const overviewResult = await loadOperationsOverview(fetch, token, refresh);
	if (overviewResult.status === 401) {
		clearManagementSession(cookies, url.protocol);
		redirect(303, '/login');
	}

	let meterReport = null;
	let energyMix = null;
	let floorAnalysis = null;
	let revenueAnalysis = null;
	let reportError = overviewResult.error;
	const range = { from, to };

	if (!reportError && (reportType === 'meter_usage' || reportType === 'data_quality')) {
		const result = await loadMeterUsageReport(fetch, token, { scope, meterIds, from, to, forceRefresh: refresh });
		meterReport = result.data;
		reportError = result.error;
	} else if (!reportError && reportType === 'source_mix') {
		const result = await loadEnergyMix(fetch, token, period, refresh, range);
		energyMix = result.data;
		reportError = result.error;
	} else if (!reportError && reportType === 'floor_consumption') {
		const result = await loadFloorAnalysis(fetch, token, period, refresh, range);
		floorAnalysis = result.data;
		reportError = result.error;
	} else if (!reportError && reportType === 'revenue_valuation') {
		const result = await loadRevenueAnalysis(fetch, token, period, refresh, range);
		revenueAnalysis = result.data;
		reportError = result.error;
	}

	return {
		overview: overviewResult.data,
		meterReport,
		energyMix,
		floorAnalysis,
		revenueAnalysis,
		error: reportError,
		filters: { reportType, scope, period, from, to, meterIds },
		today
	};
};
