import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { loadMeterHistory, loadOperationsOverview } from '#lib/server/msmApi.js';

export const load: PageServerLoad = async ({ cookies, fetch, url }) => {
	const token = cookies.get('msm_session');
	if (!token) redirect(303, '/login');
	const overviewResult = await loadOperationsOverview(fetch, token, url.searchParams.get('refresh') === 'true');
	if (overviewResult.status === 401) { cookies.delete('msm_session', { path: '/' }); redirect(303, '/login'); }
	const sources = (overviewResult.data?.meters ?? []).filter((meter) => ['grid_source', 'solar_source', 'generator_source', 'distribution_or_bulk'].includes(meter.operationalRole));
	const historyResults = await Promise.all(sources.map((meter) => loadMeterHistory(fetch, token, meter.providerId, url.searchParams.get('refresh') === 'true')));
	return { overview: overviewResult.data, histories: historyResults.flatMap((result) => result.data ? [result.data] : []), error: overviewResult.error };
};
