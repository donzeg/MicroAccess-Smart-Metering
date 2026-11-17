import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { loadManagementAlertFeed } from '#lib/server/managementAlerts.js';
import { clearManagementSession } from '#lib/server/session.js';

export const load: PageServerLoad = async ({ cookies, fetch, url }) => {
	const token = cookies.get('msm_session');
	if (!token) redirect(303, '/login');

	const result = await loadManagementAlertFeed(fetch, token, url.searchParams.get('refresh') === 'true');
	if (result.status === 401) {
		clearManagementSession(cookies, url.protocol);
		redirect(303, '/login');
	}

	return { feed: result.data, error: result.error };
};
