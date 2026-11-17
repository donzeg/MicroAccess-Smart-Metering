import { loadEnergyMix, loadOperationsOverview } from '#lib/server/msmApi.js';
import type {
	DashboardError,
	ManagementAlert,
	ManagementAlertCategory,
	ManagementAlertFeed,
	ManagementAlertSeverity,
	OperationsException
} from '#lib/types.js';

export interface ManagementAlertResult {
	ok: boolean;
	status: number;
	data: ManagementAlertFeed | null;
	error: DashboardError | null;
}

const severityRank: Record<ManagementAlertSeverity, number> = {
	critical: 0,
	high: 1,
	medium: 2,
	low: 3
};

const lagosToday = (): string => {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Africa/Lagos',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).formatToParts(new Date());
	const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
	return `${value.year}-${value.month}-${value.day}`;
};

const exceptionCategory = (key: string): ManagementAlertCategory => {
	if (key === 'never_online' || key === 'stale_telemetry') return 'connectivity';
	if (key === 'safety') return 'safety';
	if (key === 'unassigned_meters' || key === 'unclassified_role') return 'assignment';
	if (key === 'customers_without_meter') return 'customer';
	if (key === 'tariff_mismatch') return 'commercial';
	return 'data_quality';
};

const exceptionHref = (item: OperationsException): string =>
	item.key === 'tariff_mismatch' ? '/customers' : `/exceptions?type=${encodeURIComponent(item.key)}`;

const newestTimestamp = (values: string[]): string =>
	values.sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? new Date().toISOString();

export const loadManagementAlertFeed = async (
	fetcher: typeof fetch,
	token: string,
	forceRefresh = false
): Promise<ManagementAlertResult> => {
	const today = lagosToday();
	const [operations, energyMix] = await Promise.all([
		loadOperationsOverview(fetcher, token, forceRefresh),
		loadEnergyMix(fetcher, token, 'hourly', forceRefresh, { from: today, to: today })
	]);

	if (operations.status === 401 || energyMix.status === 401) {
		return {
			ok: false,
			status: 401,
			data: null,
			error: { code: 'session_expired', message: 'Your management session has expired.' }
		};
	}

	if (!operations.data && !energyMix.data) {
		return {
			ok: false,
			status: operations.status === 503 || energyMix.status === 503 ? 503 : 502,
			data: null,
			error: operations.error ?? energyMix.error ?? {
				code: 'alerts_unavailable',
				message: 'Active alerts could not be loaded.'
			}
		};
	}

	const alerts: ManagementAlert[] = [];
	const observedAt: string[] = [];
	const warnings: string[] = [];

	if (operations.data) {
		observedAt.push(operations.data.dataSource.retrievedAt);
		for (const item of operations.data.exceptions) {
			alerts.push({
				id: `operations:${item.key}`,
				title: item.label,
				description: `${item.count} affected ${item.count === 1 ? 'record requires' : 'records require'} attention.`,
				severity: item.severity,
				category: exceptionCategory(item.key),
				affectedCount: item.count,
				action: item.action,
				href: exceptionHref(item),
				observedAt: operations.data.dataSource.retrievedAt,
				source: 'operations'
			});
		}
	} else if (operations.error) {
		warnings.push(`Estate alerts unavailable: ${operations.error.message}`);
	}

	if (energyMix.data) {
		observedAt.push(energyMix.data.dataSource.retrievedAt);
		if (energyMix.data.summary.targetStatus === 'below_target') {
			alerts.push({
				id: 'energy:solar_target_below',
				title: 'Solar contribution below target',
				description: `${energyMix.data.summary.solarPercent.toFixed(1)}% solar contribution against the configured ${energyMix.data.target.solarMinimumPercent}–${energyMix.data.target.solarMaximumPercent}% target.`,
				severity: 'high',
				category: 'energy',
				affectedCount: 1,
				action: 'Review solar availability and the increase in conventional supply.',
				href: '/energy-mix?range=today',
				observedAt: energyMix.data.dataSource.retrievedAt,
				source: 'energy_mix'
			});
		}
		if (!energyMix.data.sourceTopology.generatorSeparatelyMetered) {
			alerts.push({
				id: 'energy:generator_meter_gap',
				title: 'Dedicated generator meter pending',
				description: 'Generator usage remains combined with the shared AEDC / generator supply reading.',
				severity: 'medium',
				category: 'configuration',
				affectedCount: 1,
				action: 'Install and commission the dedicated generator meter to separate generator contribution and cost.',
				href: '/energy-mix?range=today',
				observedAt: energyMix.data.dataSource.retrievedAt,
				source: 'energy_mix'
			});
		}
	} else if (energyMix.error) {
		warnings.push(`Energy alerts unavailable: ${energyMix.error.message}`);
	}

	alerts.sort((left, right) =>
		severityRank[left.severity] - severityRank[right.severity]
		|| right.affectedCount - left.affectedCount
		|| left.title.localeCompare(right.title)
	);

	const severityCounts: ManagementAlertFeed['severityCounts'] = {
		critical: 0,
		high: 0,
		medium: 0,
		low: 0
	};
	for (const alert of alerts) severityCounts[alert.severity] += 1;

	return {
		ok: true,
		status: 200,
		data: {
			dataSource: {
				mode: 'live_read_only',
				retrievedAt: newestTimestamp(observedAt)
			},
			activeConditionCount: alerts.length,
			affectedRecordCount: alerts.reduce((total, alert) => total + alert.affectedCount, 0),
			severityCounts,
			alerts,
			warnings
		},
		error: null
	};
};
