import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	loadEnergyMix,
	loadFloorAnalysis,
	loadOperationsOverview,
	loadRevenueAnalysis
} from '#lib/server/msmApi.js';
import { clearManagementSession } from '#lib/server/session.js';
import type { DashboardError, EnergyMixPeriod } from '#lib/types.js';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const PRESETS = ['today', 'mtd', 'ytd'] as const;
type ExecutivePreset = (typeof PRESETS)[number];

const lagosToday = (): string => {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Africa/Lagos',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).formatToParts(new Date());
	const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
	return `${value.year}-${value.month}-${value.day}`;
};

const resolvePreset = (
	preset: ExecutivePreset,
	today: string
): { period: EnergyMixPeriod; range: { from: string; to: string }; label: string } => {
	if (preset === 'today') {
		return { period: 'hourly', range: { from: today, to: today }, label: 'Today' };
	}
	if (preset === 'ytd') {
		return {
			period: 'monthly',
			range: { from: `${today.slice(0, 4)}-01-01`, to: today },
			label: 'Year to Date'
		};
	}
	return {
		period: 'daily',
		range: { from: `${today.slice(0, 7)}-01`, to: today },
		label: 'Month to Date'
	};
};

export const load: PageServerLoad = async ({ cookies, fetch, url }) => {
	const token = cookies.get('msm_session');
	if (!token) redirect(303, '/login');

	const today = lagosToday();
	const requestedFrom = url.searchParams.get('from') ?? '';
	const requestedTo = url.searchParams.get('to') ?? '';
	const requestedPeriod = url.searchParams.get('period');
	const customRange = DATE_ONLY.test(requestedFrom) && DATE_ONLY.test(requestedTo) && requestedFrom <= requestedTo
		? { from: requestedFrom, to: requestedTo }
		: null;
	const requestedPreset = url.searchParams.get('range');
	const preset: ExecutivePreset | null = customRange
		? null
		: PRESETS.includes(requestedPreset as ExecutivePreset)
			? (requestedPreset as ExecutivePreset)
			: 'mtd';
	const resolved = preset ? resolvePreset(preset, today) : null;
	const period: EnergyMixPeriod = customRange
		? requestedPeriod === 'hourly' || requestedPeriod === 'weekly' || requestedPeriod === 'monthly'
			? requestedPeriod
			: 'daily'
		: resolved?.period ?? 'daily';
	const range = customRange ?? resolved?.range ?? { from: today, to: today };
	const forceRefresh = url.searchParams.get('refresh') === 'true';

	const [operations, energyMix, revenue, floorAnalysis] = await Promise.all([
		loadOperationsOverview(fetch, token, forceRefresh),
		loadEnergyMix(fetch, token, period, forceRefresh, range),
		loadRevenueAnalysis(fetch, token, period, forceRefresh, range),
		loadFloorAnalysis(fetch, token, period, forceRefresh, range)
	]);

	if ([operations, energyMix, revenue, floorAnalysis].some((result) => result.status === 401)) {
		clearManagementSession(cookies, url.protocol);
		redirect(303, '/login');
	}

	const errors: Array<{ source: string; error: DashboardError }> = [];
	if (operations.error) errors.push({ source: 'Estate health', error: operations.error });
	if (energyMix.error) errors.push({ source: 'Energy mix', error: energyMix.error });
	if (revenue.error) errors.push({ source: 'Energy valuation', error: revenue.error });
	if (floorAnalysis.error) errors.push({ source: 'Floor performance', error: floorAnalysis.error });

	return {
		operations: operations.data,
		energyMix: energyMix.data,
		revenue: revenue.data,
		floorAnalysis: floorAnalysis.data,
		errors,
		preset,
		period,
		range,
		rangeLabel: resolved?.label ?? 'Custom Range',
		customRange,
		today
	};
};
