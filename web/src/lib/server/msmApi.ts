import type {
	CustomerDetail,
	DashboardError,
	EnergyMix,
	EnergyMixPeriod,
	FloorAnalysis,
	MeterHistory,
	MeterSummary,
	OperationsOverview,
	RevenueAnalysis
} from '#lib/types.js';

const apiBaseUrl = (): string => (process.env.MSM_API_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');

interface ApiResult<T> {
	ok: boolean;
	status: number;
	data: T | null;
	error: DashboardError | null;
}

const safeJson = async (response: Response): Promise<Record<string, unknown>> => {
	try {
		const payload = (await response.json()) as unknown;
		return typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : {};
	} catch {
		return {};
	}
};

export const managementLogin = async (
	fetcher: typeof fetch,
	username: string,
	password: string
): Promise<ApiResult<{ token: string; tokenType: string }>> => {
	let response: Response;
	try {
		response = await fetcher(`${apiBaseUrl()}/api/v1/auth/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({ username, password, role: 'management' })
		});
	} catch {
		return {
			ok: false,
			status: 503,
			data: null,
			error: { code: 'backend_unavailable', message: 'The MSM service is not available yet.' }
		};
	}

	const payload = await safeJson(response);
	if (!response.ok || typeof payload.token !== 'string') {
		return {
			ok: false,
			status: response.status,
			data: null,
			error: {
				code: response.status === 401 ? 'invalid_credentials' : 'login_failed',
				message: response.status === 401 ? 'The username or password is incorrect.' : 'Sign-in could not be completed.'
			}
		};
	}

	return {
		ok: true,
		status: response.status,
		data: { token: payload.token, tokenType: typeof payload.tokenType === 'string' ? payload.tokenType : 'Bearer' },
		error: null
	};
};

export const loadOperationsOverview = async (
	fetcher: typeof fetch,
	token: string,
	forceRefresh: boolean
): Promise<ApiResult<OperationsOverview>> => {
	let response: Response;
	try {
		response = await fetcher(
			`${apiBaseUrl()}/api/v1/ops/steama/overview${forceRefresh ? '?refresh=true' : ''}`,
			{
				headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
			}
		);
	} catch {
		return {
			ok: false,
			status: 503,
			data: null,
			error: { code: 'backend_unavailable', message: 'The MSM service is not available yet.' }
		};
	}

	const payload = await safeJson(response);
	if (!response.ok) {
		return {
			ok: false,
			status: response.status,
			data: null,
			error: {
				code: typeof payload.code === 'string' ? payload.code : 'overview_unavailable',
				message:
					typeof payload.message === 'string'
						? payload.message
						: 'The live operations overview could not be loaded.'
			}
		};
	}

	return { ok: true, status: response.status, data: payload as unknown as OperationsOverview, error: null };
};

const loadProtectedResource = async <T>(
	fetcher: typeof fetch,
	token: string,
	path: string,
	fallbackMessage: string
): Promise<ApiResult<T>> => {
	let response: Response;
	try {
		response = await fetcher(`${apiBaseUrl()}${path}`, {
			headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
		});
	} catch {
		return { ok: false, status: 503, data: null, error: { code: 'backend_unavailable', message: 'The MSM service is not available yet.' } };
	}
	const payload = await safeJson(response);
	if (!response.ok) {
		return {
			ok: false,
			status: response.status,
			data: null,
			error: {
				code: typeof payload.code === 'string' ? payload.code : 'resource_unavailable',
				message: typeof payload.message === 'string' ? payload.message : fallbackMessage
			}
		};
	}
	return { ok: true, status: response.status, data: payload as unknown as T, error: null };
};

export const loadMeter = (fetcher: typeof fetch, token: string, providerId: string) =>
	loadProtectedResource<MeterSummary>(fetcher, token, `/api/v1/ops/steama/meters/${providerId}`, 'The meter could not be loaded.');

export const loadMeterHistory = (fetcher: typeof fetch, token: string, providerId: string, forceRefresh = false) =>
	loadProtectedResource<MeterHistory>(
		fetcher,
		token,
		`/api/v1/ops/steama/meters/${providerId}/history${forceRefresh ? '?refresh=true' : ''}`,
		'The meter history could not be loaded.'
	);

export const loadCustomer = (fetcher: typeof fetch, token: string, providerId: string) =>
	loadProtectedResource<CustomerDetail>(fetcher, token, `/api/v1/ops/steama/customers/${providerId}`, 'The customer account could not be loaded.');

export const loadEnergyMix = (
	fetcher: typeof fetch,
	token: string,
	period: EnergyMixPeriod,
	forceRefresh = false,
	range?: { from: string; to: string }
) => {
	const query = new URLSearchParams({ period });
	if (forceRefresh) query.set('refresh', 'true');
	if (range) {
		query.set('from', range.from);
		query.set('to', range.to);
	}
	return loadProtectedResource<EnergyMix>(
		fetcher,
		token,
		`/api/v1/ops/steama/energy-mix?${query.toString()}`,
		'The energy contribution analysis could not be loaded.'
	);
};

export const loadRevenueAnalysis = (
	fetcher: typeof fetch,
	token: string,
	period: EnergyMixPeriod,
	forceRefresh = false,
	range?: { from: string; to: string }
) => {
	const query = new URLSearchParams({ period });
	if (forceRefresh) query.set('refresh', 'true');
	if (range) {
		query.set('from', range.from);
		query.set('to', range.to);
	}
	return loadProtectedResource<RevenueAnalysis>(
		fetcher,
		token,
		`/api/v1/ops/steama/revenue-costs?${query.toString()}`,
		'The revenue and energy cost analysis could not be loaded.'
	);
};

export const loadFloorAnalysis = (
	fetcher: typeof fetch,
	token: string,
	period: EnergyMixPeriod,
	forceRefresh = false,
	range?: { from: string; to: string }
) => {
	const query = new URLSearchParams({ period });
	if (forceRefresh) query.set('refresh', 'true');
	if (range) {
		query.set('from', range.from);
		query.set('to', range.to);
	}
	return loadProtectedResource<FloorAnalysis>(
		fetcher,
		token,
		`/api/v1/ops/steama/floors?${query.toString()}`,
		'The floor-by-floor analysis could not be loaded.'
	);
};
