import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { loadCustomer } from '#lib/server/msmApi.js';
import { clearManagementSession } from '#lib/server/session.js';

export const load: PageServerLoad = async ({ cookies, fetch, params, url }) => {
	const token = cookies.get('msm_session');
	if (!token) redirect(303, '/login');
	const result = await loadCustomer(fetch, token, params.providerId);
	if (result.status === 401) { clearManagementSession(cookies, url.protocol); redirect(303, '/login'); }
	return { customer: result.data, error: result.error };
};
