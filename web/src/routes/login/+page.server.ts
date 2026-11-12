import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { managementLogin } from '#lib/server/msmApi.js';
import { setManagementSession } from '#lib/server/session.js';

export const load: PageServerLoad = async ({ cookies }) => {
	if (cookies.get('msm_session')) {
		redirect(303, '/');
	}
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies, fetch, url }) => {
		const data = await request.formData();
		const username = String(data.get('username') ?? '').trim();
		const password = String(data.get('password') ?? '');

		if (!username || !password) {
			return fail(400, { message: 'Enter both your username and password.', username });
		}

		const result = await managementLogin(fetch, username, password);
		if (!result.ok || !result.data) {
			return fail(result.status, { message: result.error?.message ?? 'Sign-in could not be completed.', username });
		}

		setManagementSession(cookies, result.data.token, url.protocol);
		redirect(303, '/');
	}
};
