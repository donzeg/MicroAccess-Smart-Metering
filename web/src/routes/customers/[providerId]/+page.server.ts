import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { loadCustomer } from '#lib/server/msmApi.js';

export const load: PageServerLoad = async ({ cookies, fetch, params }) => {
	const token = cookies.get('msm_session');
	if (!token) redirect(303, '/login');
	const result = await loadCustomer(fetch, token, params.providerId);
	if (result.status === 401) { cookies.delete('msm_session', { path: '/' }); redirect(303, '/login'); }
	return { customer: result.data, error: result.error };
};
