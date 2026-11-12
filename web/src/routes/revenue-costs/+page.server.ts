import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { loadRevenueAnalysis } from '#lib/server/msmApi.js';
import { clearManagementSession } from '#lib/server/session.js';
import type { EnergyMixPeriod } from '#lib/types.js';

const PERIODS: EnergyMixPeriod[] = ['hourly', 'daily', 'weekly', 'monthly'];
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const lagosToday = (): string => {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit'
	}).formatToParts(new Date());
	const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
	return `${value.year}-${value.month}-${value.day}`;
};

export const load: PageServerLoad = async ({ cookies, fetch, url }) => {
	const token = cookies.get('msm_session');
	if (!token) redirect(303, '/login');

	const requestedPeriod = url.searchParams.get('period');
	const period: EnergyMixPeriod = PERIODS.includes(requestedPeriod as EnergyMixPeriod)
		? (requestedPeriod as EnergyMixPeriod)
		: 'daily';
	const requestedFrom = url.searchParams.get('from') ?? '';
	const requestedTo = url.searchParams.get('to') ?? '';
	const customRange = DATE_ONLY.test(requestedFrom) && DATE_ONLY.test(requestedTo) && requestedFrom <= requestedTo
		? { from: requestedFrom, to: requestedTo }
		: undefined;
	const result = await loadRevenueAnalysis(
		fetch,
		token,
		period,
		url.searchParams.get('refresh') === 'true',
		customRange
	);
	if (result.status === 401) {
		clearManagementSession(cookies, url.protocol);
		redirect(303, '/login');
	}

	return { revenue: result.data, period, customRange: customRange ?? null, today: lagosToday(), error: result.error };
};
