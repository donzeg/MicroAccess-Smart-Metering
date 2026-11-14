import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { loadEnergyMix } from '#lib/server/msmApi.js';
import { clearManagementSession } from '#lib/server/session.js';
import type { EnergyMixPeriod } from '#lib/types.js';

const PERIODS: EnergyMixPeriod[] = ['hourly', 'daily', 'weekly', 'monthly'];
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const RANGE_PRESETS = ['today', '7d', '30d', '12m', 'ytd'] as const;
type EnergyRangePreset = (typeof RANGE_PRESETS)[number];

interface ResolvedPreset {
	period: EnergyMixPeriod;
	range: { from: string; to: string };
	label: string;
	groupingLabel: string;
}

const lagosToday = (): string => {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit'
	}).formatToParts(new Date());
	const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
	return `${value.year}-${value.month}-${value.day}`;
};

const formatDateOnly = (value: Date): string => value.toISOString().slice(0, 10);

const daysBefore = (dateOnly: string, days: number): string => {
	const value = new Date(`${dateOnly}T00:00:00Z`);
	value.setUTCDate(value.getUTCDate() - days);
	return formatDateOnly(value);
};

const firstDayOfMonthBefore = (dateOnly: string, months: number): string => {
	const value = new Date(`${dateOnly}T00:00:00Z`);
	value.setUTCDate(1);
	value.setUTCMonth(value.getUTCMonth() - months);
	return formatDateOnly(value);
};

const resolvePreset = (preset: EnergyRangePreset, today: string): ResolvedPreset => {
	if (preset === 'today') {
		return {
			period: 'hourly',
			range: { from: today, to: today },
			label: 'Today',
			groupingLabel: 'hourly'
		};
	}
	if (preset === '7d') {
		return {
			period: 'daily',
			range: { from: daysBefore(today, 6), to: today },
			label: '7 Days',
			groupingLabel: 'daily'
		};
	}
	if (preset === '30d') {
		return {
			period: 'daily',
			range: { from: daysBefore(today, 29), to: today },
			label: '30 Days',
			groupingLabel: 'daily'
		};
	}
	if (preset === '12m') {
		return {
			period: 'monthly',
			range: { from: firstDayOfMonthBefore(today, 11), to: today },
			label: '12 Months',
			groupingLabel: 'monthly'
		};
	}
	return {
		period: 'monthly',
		range: { from: `${today.slice(0, 4)}-01-01`, to: today },
		label: 'Year to Date',
		groupingLabel: 'monthly'
	};
};

const legacyPreset = (period: string | null): EnergyRangePreset => {
	if (period === 'daily') return '30d';
	if (period === 'weekly') return '7d';
	if (period === 'monthly') return '12m';
	return 'today';
};

export const load: PageServerLoad = async ({ cookies, fetch, url }) => {
	const token = cookies.get('msm_session');
	if (!token) redirect(303, '/login');

	const requestedPeriod = url.searchParams.get('period');
	const requestedFrom = url.searchParams.get('from') ?? '';
	const requestedTo = url.searchParams.get('to') ?? '';
	const customRange = DATE_ONLY.test(requestedFrom) && DATE_ONLY.test(requestedTo) && requestedFrom <= requestedTo
		? { from: requestedFrom, to: requestedTo }
		: undefined;
	const today = lagosToday();
	const requestedPreset = url.searchParams.get('range');
	const preset: EnergyRangePreset | null = customRange
		? null
		: RANGE_PRESETS.includes(requestedPreset as EnergyRangePreset)
			? (requestedPreset as EnergyRangePreset)
			: legacyPreset(requestedPeriod);
	const resolvedPreset = preset ? resolvePreset(preset, today) : null;
	const period: EnergyMixPeriod = customRange
		? PERIODS.includes(requestedPeriod as EnergyMixPeriod)
			? (requestedPeriod as EnergyMixPeriod)
			: 'daily'
		: resolvedPreset?.period ?? 'hourly';
	const analysisRange = customRange ?? resolvedPreset?.range;
	const result = await loadEnergyMix(
		fetch,
		token,
		period,
		url.searchParams.get('refresh') === 'true',
		analysisRange
	);
	if (result.status === 401) {
		clearManagementSession(cookies, url.protocol);
		redirect(303, '/login');
	}

	return {
		energyMix: result.data,
		period,
		preset,
		rangeLabel: resolvedPreset?.label ?? 'Custom range',
		groupingLabel: resolvedPreset?.groupingLabel ?? period,
		customRange: customRange ?? null,
		today,
		error: result.error
	};
};
