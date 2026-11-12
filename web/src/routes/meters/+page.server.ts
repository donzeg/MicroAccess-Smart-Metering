import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { loadOperationsOverview } from '#lib/server/msmApi.js';
import { clearManagementSession } from '#lib/server/session.js';

export const load: PageServerLoad = async ({ cookies, fetch, url }) => {
	const token = cookies.get('msm_session');
	if (!token) redirect(303, '/login');
	const result = await loadOperationsOverview(fetch, token, url.searchParams.get('refresh') === 'true');
	if (result.status === 401) { clearManagementSession(cookies, url.protocol); redirect(303, '/login'); }
	return { overview: result.data, error: result.error };
};
