import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { loadOperationsOverview } from '#lib/server/msmApi.js';
import { clearManagementSession } from '#lib/server/session.js';

export const load: PageServerLoad = async ({ cookies, fetch, url }) => {
	const token = cookies.get('msm_session');
	if (!token) {
		redirect(303, '/login');
	}

	const forceRefresh = url.searchParams.get('refresh') === 'true';
	const result = await loadOperationsOverview(fetch, token, forceRefresh);
	if (result.status === 401) {
		clearManagementSession(cookies, url.protocol);
		redirect(303, '/login');
	}

	return {
		overview: result.data,
		error: result.error,
		forceRefresh
	};
};

export const actions: Actions = {
	logout: async ({ cookies, url }) => {
		clearManagementSession(cookies, url.protocol);
		redirect(303, '/login');
	}
};
