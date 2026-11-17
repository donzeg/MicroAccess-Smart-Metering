<script lang="ts">
	import { Bell, ChevronRight, LoaderCircle, RefreshCw } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { formatDateTime } from '#lib/format.js';
	import type { ManagementAlertFeed, ManagementAlertSeverity } from '#lib/types.js';

	let feed = $state<ManagementAlertFeed | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let open = $state(false);

	const loadAlerts = async (forceRefresh = false) => {
		loading = true;
		error = null;
		try {
			const response = await fetch(`/api/notifications${forceRefresh ? '?refresh=true' : ''}`, {
				headers: { Accept: 'application/json' }
			});
			const payload = await response.json() as ManagementAlertFeed | { message?: string };
			if (!response.ok || !('alerts' in payload)) {
				throw new Error('message' in payload && payload.message ? payload.message : 'Active alerts could not be loaded.');
			}
			feed = payload;
		} catch (reason) {
			error = reason instanceof Error ? reason.message : 'Active alerts could not be loaded.';
		} finally {
			loading = false;
		}
	};

	const severityLabel = (severity: ManagementAlertSeverity): string =>
		severity.charAt(0).toUpperCase() + severity.slice(1);

	onMount(() => {
		void loadAlerts();
		const timer = window.setInterval(() => void loadAlerts(), 15 * 60 * 1000);
		return () => window.clearInterval(timer);
	});
</script>

<details class="notification-bell" bind:open>
	<summary aria-label="Open active alerts" title="Active alerts">
		{#if loading && !feed}<LoaderCircle class="spinner" size={18} />{:else}<Bell size={18} />{/if}
		{#if feed && feed.activeConditionCount > 0}
			<span class="badge" aria-label={`${feed.activeConditionCount} active alert conditions`}>{feed.activeConditionCount > 99 ? '99+' : feed.activeConditionCount}</span>
		{/if}
	</summary>

	<div class="flyout">
		<div class="flyout-heading">
			<div>
				<strong>Active alerts</strong>
				<span>{feed ? `${feed.activeConditionCount} conditions · ${feed.affectedRecordCount} affected records` : 'Current operational conditions'}</span>
			</div>
			<button type="button" onclick={() => void loadAlerts(true)} disabled={loading} aria-label="Refresh active alerts" title="Refresh active alerts"><RefreshCw class={loading ? 'spinner' : ''} size={15} /></button>
		</div>

		{#if error}
			<div class="state error">{error}</div>
		{:else if loading && !feed}
			<div class="state">Loading current conditions…</div>
		{:else if feed && feed.alerts.length === 0}
			<div class="state clear"><strong>No active alert conditions</strong><span>The latest operational checks have not raised an alert.</span></div>
		{:else if feed}
			<div class="alert-list">
				{#each feed.alerts.slice(0, 4) as alert (alert.id)}
					<a href={alert.href} onclick={() => open = false}>
						<span class="severity" class:critical={alert.severity === 'critical'} class:high={alert.severity === 'high'} class:medium={alert.severity === 'medium'}>{severityLabel(alert.severity)}</span>
						<strong>{alert.title}</strong>
						<p>{alert.description}</p>
						<small>{alert.action}</small>
						<span class="affected">{alert.affectedCount} affected</span>
						<ChevronRight class="chevron" size={15} />
					</a>
				{/each}
			</div>
			<div class="retrieved">Last observed {formatDateTime(feed.dataSource.retrievedAt)}</div>
		{/if}

		<a class="all-alerts" href="/alerts" onclick={() => open = false}>Open alerts & notifications <ChevronRight size={15} /></a>
	</div>
</details>

<style>
	.notification-bell { position: relative; display: inline-flex; flex: 0 0 auto; }
	summary { position: relative; display: grid; width: 2.75rem; height: 2.75rem; box-sizing: border-box; place-items: center; border: 1px solid var(--line); border-radius: .75rem; background: var(--surface); color: var(--blue); cursor: pointer; list-style: none; box-shadow: var(--shadow-sm); }
	summary::-webkit-details-marker { display: none; }
	summary:hover, .notification-bell[open] summary { border-color: var(--sky); background: var(--pale-blue); color: var(--navy); }
	.badge { position: absolute; top: -.38rem; right: -.38rem; display: grid; min-width: 1.15rem; height: 1.15rem; box-sizing: border-box; place-items: center; padding: 0 .24rem; border: 2px solid var(--canvas); border-radius: 999px; background: var(--danger); color: white; font-size: .52rem; font-weight: 900; line-height: 1; }
	.flyout { position: absolute; z-index: 85; top: calc(100% + .6rem); right: 0; width: min(25rem, calc(100vw - 2rem)); box-sizing: border-box; overflow: hidden; border: 1px solid var(--line); border-radius: .9rem; background: var(--surface); color: var(--text); box-shadow: var(--shadow-lg); }
	.flyout-heading { display: flex; align-items: center; justify-content: space-between; gap: .75rem; padding: .85rem; border-bottom: 1px solid var(--line-soft); }
	.flyout-heading strong, .flyout-heading span { display: block; }
	.flyout-heading strong { color: var(--navy); font-size: .85rem; }
	.flyout-heading span { margin-top: .14rem; color: var(--text-muted); font-size: .6rem; }
	.flyout-heading button { display: grid; width: 2.1rem; height: 2.1rem; flex: 0 0 auto; place-items: center; border: 1px solid var(--line); border-radius: .6rem; background: var(--surface-soft); color: var(--blue); cursor: pointer; }
	.flyout-heading button:disabled { cursor: wait; opacity: .65; }
	.alert-list { display: grid; max-height: min(58vh, 26rem); overflow-y: auto; }
	.alert-list a { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: .2rem .65rem; padding: .8rem 2.25rem .8rem .85rem; border-bottom: 1px solid var(--line-soft); color: inherit; text-decoration: none; }
	.alert-list a:hover { background: var(--surface-soft); }
	.alert-list strong, .alert-list p, .alert-list small { grid-column: 1 / -1; }
	.alert-list strong { color: var(--navy); font-size: .74rem; line-height: 1.35; }
	.alert-list p { margin: 0; color: var(--text-muted); font-size: .64rem; line-height: 1.45; }
	.alert-list small { color: var(--text); font-size: .6rem; line-height: 1.42; }
	.severity { justify-self: start; padding: .18rem .38rem; border-radius: 999px; background: var(--pale-blue); color: var(--steel); font-size: .5rem; font-weight: 900; letter-spacing: .05em; text-transform: uppercase; }
	.severity.critical { background: color-mix(in srgb, var(--danger) 13%, transparent); color: var(--danger); }
	.severity.high { background: color-mix(in srgb, var(--warning) 15%, transparent); color: var(--warning); }
	.severity.medium { background: var(--pale-blue); color: var(--blue); }
	.affected { align-self: center; color: var(--text-muted); font-size: .54rem; font-weight: 750; white-space: nowrap; }
	:global(.chevron) { position: absolute; top: 50%; right: .72rem; color: var(--steel); transform: translateY(-50%); }
	.state { padding: 1.5rem 1rem; color: var(--text-muted); font-size: .7rem; line-height: 1.5; text-align: center; }
	.state.error { color: var(--danger); }
	.state.clear strong, .state.clear span { display: block; }
	.state.clear strong { color: var(--success); }
	.state.clear span { margin-top: .25rem; }
	.retrieved { padding: .48rem .85rem; border-bottom: 1px solid var(--line-soft); color: var(--text-muted); font-size: .54rem; }
	.all-alerts { display: flex; align-items: center; justify-content: space-between; gap: .5rem; padding: .75rem .85rem; color: var(--blue); font-size: .68rem; font-weight: 850; text-decoration: none; }
	:global(.spinner) { animation: spin .8s linear infinite; }
	@keyframes spin { to { transform: rotate(360deg); } }
	@media (max-width: 620px) {
		.flyout { position: fixed; top: auto; right: .75rem; bottom: .75rem; left: .75rem; width: auto; max-height: calc(100dvh - 5.5rem); }
	}
</style>
