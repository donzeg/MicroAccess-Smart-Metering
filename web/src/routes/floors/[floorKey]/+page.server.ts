import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { loadFloorAnalysis, recordFloorTenancy } from '#lib/server/msmApi.js';
import type { EnergyMixPeriod, FloorKey } from '#lib/types.js';

const PERIODS: EnergyMixPeriod[] = ['hourly', 'daily', 'weekly', 'monthly'];
const FLOOR_KEYS: FloorKey[] = ['ground-floor', 'first-floor', 'second-floor', 'third-floor', 'fourth-floor', 'fifth-floor', 'unclassified'];
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const lagosToday = (): string => {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit'
	}).formatToParts(new Date());
	const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
	return `${value.year}-${value.month}-${value.day}`;
};

const lagosLocalDateTime = (): string => {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit',
		hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
	}).formatToParts(new Date());
	const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
	return `${value.year}-${value.month}-${value.day}T${value.hour}:${value.minute}`;
};

export const load: PageServerLoad = async ({ cookies, fetch, params, url }) => {
	const token = cookies.get('msm_session');
	if (!token) redirect(303, '/login');
	if (!FLOOR_KEYS.includes(params.floorKey as FloorKey)) error(404, 'Floor not found');

	const requestedPeriod = url.searchParams.get('period');
	const period: EnergyMixPeriod = PERIODS.includes(requestedPeriod as EnergyMixPeriod)
		? (requestedPeriod as EnergyMixPeriod)
		: 'daily';
	const requestedFrom = url.searchParams.get('from') ?? '';
	const requestedTo = url.searchParams.get('to') ?? '';
	const customRange = DATE_ONLY.test(requestedFrom) && DATE_ONLY.test(requestedTo) && requestedFrom <= requestedTo
		? { from: requestedFrom, to: requestedTo }
		: undefined;
	const result = await loadFloorAnalysis(
		fetch,
		token,
		period,
		url.searchParams.get('refresh') === 'true',
		customRange
	);
	if (result.status === 401) {
		cookies.delete('msm_session', { path: '/' });
		redirect(303, '/login');
	}

	return {
		floorAnalysis: result.data,
		floorKey: params.floorKey as FloorKey,
		period,
		customRange: customRange ?? null,
		today: lagosToday(),
		nowLocal: lagosLocalDateTime(),
		error: result.error
	};
};

export const actions: Actions = {
	recordTenancy: async ({ cookies, fetch, request }) => {
		const token = cookies.get('msm_session');
		if (!token) redirect(303, '/login');
		const values = await request.formData();
		const providerCustomerId = String(values.get('providerCustomerId') ?? '').trim();
		const tenantName = String(values.get('tenantName') ?? '').trim();
		const effectiveLocal = String(values.get('effectiveFrom') ?? '').trim();
		const evidenceReference = String(values.get('evidenceReference') ?? '').trim() || 'management_confirmed';
		const effectiveDate = new Date(`${effectiveLocal}:00+01:00`);
		if (!/^\d+$/.test(providerCustomerId) || !tenantName || Number.isNaN(effectiveDate.getTime()) || effectiveDate.getTime() > Date.now()) {
			return fail(400, { success: false, message: 'Enter a tenant name and a valid effective date that is not in the future.', providerCustomerId });
		}
		const result = await recordFloorTenancy(fetch, token, {
			providerCustomerId,
			tenantName,
			effectiveFrom: effectiveDate.toISOString(),
			evidenceReference
		});
		if (result.status === 401) {
			cookies.delete('msm_session', { path: '/' });
			redirect(303, '/login');
		}
		if (!result.ok) {
			return fail(result.status, { success: false, message: result.error?.message ?? 'The tenant record could not be saved.', providerCustomerId });
		}
		return { success: true, message: `Tenant history saved for ${result.data?.positionLabel ?? 'the position'}.`, providerCustomerId };
	}
};
