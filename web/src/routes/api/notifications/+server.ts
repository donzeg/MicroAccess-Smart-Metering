import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadManagementAlertFeed } from '#lib/server/managementAlerts.js';

export const GET: RequestHandler = async ({ cookies, fetch, url }) => {
	const token = cookies.get('msm_session');
	if (!token) {
		return json({ code: 'unauthenticated', message: 'Sign in to view active alerts.' }, { status: 401 });
	}

	const result = await loadManagementAlertFeed(fetch, token, url.searchParams.get('refresh') === 'true');
	if (!result.data) {
		return json(result.error ?? { code: 'alerts_unavailable', message: 'Active alerts could not be loaded.' }, {
			status: result.status
		});
	}
	return json(result.data);
};
