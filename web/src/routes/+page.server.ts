import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { loadOperationsOverview } from '#lib/server/msmApi.js';

export const load: PageServerLoad = async ({ cookies, fetch, url }) => {
	const token = cookies.get('msm_session');
	if (!token) {
		redirect(303, '/login');
	}

	const forceRefresh = url.searchParams.get('refresh') === 'true';
	const result = await loadOperationsOverview(fetch, token, forceRefresh);
	if (result.status === 401) {
		cookies.delete('msm_session', { path: '/' });
		redirect(303, '/login');
	}

	return {
		overview: result.data,
		error: result.error,
		forceRefresh
	};
};

export const actions: Actions = {
	logout: async ({ cookies }) => {
		cookies.delete('msm_session', { path: '/' });
		redirect(303, '/login');
	}
};
