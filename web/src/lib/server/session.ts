import type { Cookies } from '@sveltejs/kit';

const sessionCookieOptions = (protocol: string) => ({
	path: '/',
	httpOnly: true,
	sameSite: 'strict' as const,
	secure: protocol === 'https:'
});

export const setManagementSession = (
	cookies: Cookies,
	token: string,
	protocol: string
): void => {
	cookies.set('msm_session', token, {
		...sessionCookieOptions(protocol),
		maxAge: 60 * 60 * 12
	});
};

export const clearManagementSession = (cookies: Cookies, protocol: string): void => {
	cookies.delete('msm_session', sessionCookieOptions(protocol));
};
