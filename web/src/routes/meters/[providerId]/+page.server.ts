import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { loadMeter, loadMeterHistory } from '#lib/server/msmApi.js';
import { clearManagementSession } from '#lib/server/session.js';

export const load: PageServerLoad = async ({ cookies, fetch, params, url }) => {
	const token = cookies.get('msm_session');
	if (!token) redirect(303, '/login');
	const [meter, history] = await Promise.all([
		loadMeter(fetch, token, params.providerId),
		loadMeterHistory(fetch, token, params.providerId, url.searchParams.get('refresh') === 'true')
	]);
	if (meter.status === 401 || history.status === 401) { clearManagementSession(cookies, url.protocol); redirect(303, '/login'); }
	return { meter: meter.data, history: history.data, error: meter.error ?? history.error };
};
