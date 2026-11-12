import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clearManagementSession } from '#lib/server/session.js';

export const POST: RequestHandler = async ({ cookies, url }) => {
	clearManagementSession(cookies, url.protocol);
	redirect(303, '/login');
};
