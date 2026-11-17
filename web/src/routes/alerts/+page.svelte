<script lang="ts">
	import { BellRing, ChevronRight, CircleAlert, ListChecks, ShieldAlert, TriangleAlert } from '@lucide/svelte';
	import AppShell from '#lib/components/AppShell.svelte';
	import InfoPopover from '#lib/components/InfoPopover.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import { formatDateTime } from '#lib/format.js';
	import type { ManagementAlertCategory, ManagementAlertSeverity } from '#lib/types.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let severity = $state<'all' | ManagementAlertSeverity>('all');
	let category = $state<'all' | ManagementAlertCategory>('all');
	let feed = $derived(data.feed);
	let visibleAlerts = $derived((feed?.alerts ?? []).filter((alert) =>
		(severity === 'all' || alert.severity === severity)
		&& (category === 'all' || alert.category === category)
	));

	const severityLabel = (value: ManagementAlertSeverity): string =>
		value.charAt(0).toUpperCase() + value.slice(1);
	const categoryLabel = (value: ManagementAlertCategory): string =>
		value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
</script>

<svelte:head><title>Alerts & notifications | MicroAccess Smart Metering</title></svelte:head>

<AppShell active="alerts">
	<PageHeader
		eyebrow="Operational awareness"
		title="Alerts & notifications"
		description="A single, prioritised view of current conditions that require management or operational attention."
		refreshHref="/alerts?refresh=true"
	/>

	{#if data.error}
		<section class="state error"><CircleAlert size={20} /><div><strong>Alerts could not be loaded</strong><span>{data.error.message}</span></div></section>
	{:else if feed}
		<section class="summary-grid" aria-label="Alert summary">
			<article class="critical-card"><ShieldAlert size={20} /><div><span>Critical conditions</span><strong>{feed.severityCounts.critical}</strong><small>Immediate review</small></div></article>
			<article class="high-card"><TriangleAlert size={20} /><div><span>High conditions</span><strong>{feed.severityCounts.high}</strong><small>Operational priority</small></div></article>
			<article><BellRing size={20} /><div><span>All active conditions</span><strong>{feed.activeConditionCount}</strong><small>Deduplicated rules</small></div></article>
			<article><ListChecks size={20} /><div><span>Affected records</span><strong>{feed.affectedRecordCount}</strong><small>Across active conditions</small></div></article>
		</section>

		<section class="panel">
			<div class="panel-heading">
				<div>
					<p>Active condition register</p>
					<h2>{visibleAlerts.length} {visibleAlerts.length === 1 ? 'condition' : 'conditions'} shown</h2>
					<span>Last observed {formatDateTime(feed.dataSource.retrievedAt)}</span>
				</div>
				<div class="heading-actions">
					<InfoPopover title="How alerts work">
						<p>These are active conditions derived from the latest read-only MSM data—not a message inbox or historical incident log.</p>
						<p>Each rule appears once, even when it affects many records. The affected count shows its current operational reach.</p>
						<p>Acknowledgement, assignment, escalation and external delivery will be added only with a durable audit trail.</p>
					</InfoPopover>
				</div>
			</div>

			<div class="filters" aria-label="Alert filters">
				<div class="severity-filters">
					<button class:active={severity === 'all'} aria-pressed={severity === 'all'} onclick={() => severity = 'all'}>All <span>{feed.activeConditionCount}</span></button>
					<button class:active={severity === 'critical'} aria-pressed={severity === 'critical'} onclick={() => severity = 'critical'}>Critical <span>{feed.severityCounts.critical}</span></button>
					<button class:active={severity === 'high'} aria-pressed={severity === 'high'} onclick={() => severity = 'high'}>High <span>{feed.severityCounts.high}</span></button>
					<button class:active={severity === 'medium'} aria-pressed={severity === 'medium'} onclick={() => severity = 'medium'}>Medium <span>{feed.severityCounts.medium}</span></button>
				</div>
				<label>Category
					<select bind:value={category}>
						<option value="all">All categories</option>
						<option value="connectivity">Connectivity</option>
						<option value="safety">Safety</option>
						<option value="assignment">Assignment</option>
						<option value="customer">Customer</option>
						<option value="commercial">Commercial</option>
						<option value="energy">Energy</option>
						<option value="configuration">Configuration</option>
						<option value="data_quality">Data quality</option>
					</select>
				</label>
			</div>

			{#if feed.warnings.length > 0}
				<div class="warnings">{#each feed.warnings as warning}<span>{warning}</span>{/each}</div>
			{/if}

			<div class="alert-register">
				{#each visibleAlerts as alert (alert.id)}
					<a class="alert-row" href={alert.href}>
						<div class="alert-meta">
							<span class="severity" class:critical={alert.severity === 'critical'} class:high={alert.severity === 'high'} class:medium={alert.severity === 'medium'}>{severityLabel(alert.severity)}</span>
							<span class="category">{categoryLabel(alert.category)}</span>
						</div>
						<div class="alert-copy">
							<strong>{alert.title}</strong>
							<p>{alert.description}</p>
							<small>{alert.action}</small>
						</div>
						<div class="alert-count"><strong>{alert.affectedCount}</strong><span>affected</span></div>
						<div class="observed"><span>Last observed</span><strong>{formatDateTime(alert.observedAt)}</strong></div>
						<ChevronRight class="chevron" size={18} />
					</a>
				{:else}
					<div class="empty"><BellRing size={24} /><strong>No conditions match these filters</strong><span>Choose another severity or category to see active alerts.</span></div>
				{/each}
			</div>
		</section>
	{/if}
</AppShell>

<style>
	.state, .panel { border: 1px solid var(--line); border-radius: 1rem; background: var(--surface); box-shadow: var(--shadow-sm); }
	.state { display: flex; align-items: center; gap: .75rem; padding: 1rem; color: var(--text-muted); }
	.state strong, .state span { display: block; }.state strong { color: var(--navy); font-size: .78rem; }.state span { margin-top: .2rem; font-size: .68rem; }.state.error { color: var(--danger); }
	.summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .7rem; margin-bottom: .75rem; }
	.summary-grid article { display: flex; min-width: 0; align-items: flex-start; gap: .72rem; padding: .9rem; border: 1px solid var(--line); border-radius: .9rem; background: var(--surface); color: var(--blue); box-shadow: var(--shadow-sm); }
	.summary-grid article > div { min-width: 0; }.summary-grid span, .summary-grid strong, .summary-grid small { display: block; }.summary-grid span { color: var(--text-muted); font-size: .61rem; }.summary-grid strong { margin-top: .14rem; color: var(--navy); font-size: 1.35rem; }.summary-grid small { margin-top: .12rem; color: var(--text-muted); font-size: .56rem; }
	.summary-grid .critical-card { color: var(--danger); }.summary-grid .high-card { color: var(--warning); }
	.panel { padding: 1rem; }
	.panel-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: .85rem; }
	.panel-heading p { margin: 0 0 .28rem; color: var(--steel); font-size: .6rem; font-weight: 900; letter-spacing: .06em; text-transform: uppercase; }.panel-heading h2 { margin: 0; color: var(--navy); font-size: 1rem; }.panel-heading > div > span { display: block; margin-top: .25rem; color: var(--text-muted); font-size: .6rem; }
	.heading-actions { display: flex; align-items: center; gap: .5rem; }
	.filters { display: flex; align-items: end; justify-content: space-between; gap: .75rem; padding: .7rem; border: 1px solid var(--line-soft); border-radius: .8rem; background: var(--surface-soft); }
	.severity-filters { display: flex; flex-wrap: wrap; gap: .35rem; }.severity-filters button { display: flex; min-height: 2.25rem; align-items: center; gap: .35rem; padding: .42rem .58rem; border: 1px solid var(--line); border-radius: .6rem; background: var(--surface); color: var(--text-muted); font-size: .63rem; font-weight: 800; cursor: pointer; }.severity-filters button span { display: grid; min-width: 1.15rem; height: 1.15rem; place-items: center; border-radius: 999px; background: var(--surface-soft); color: var(--text); font-size: .52rem; }.severity-filters button.active { border-color: var(--sky); background: var(--pale-blue); color: var(--blue); }
	.filters label { display: grid; gap: .28rem; color: var(--text-muted); font-size: .58rem; font-weight: 800; }.filters select { min-width: 10rem; min-height: 2.25rem; padding: .4rem .58rem; border: 1px solid var(--line); border-radius: .6rem; background: var(--surface); color: var(--text); font-size: .65rem; }
	.warnings { display: grid; gap: .25rem; margin-top: .65rem; padding: .65rem; border-radius: .65rem; background: color-mix(in srgb, var(--warning) 10%, transparent); color: var(--warning); font-size: .63rem; }
	.alert-register { display: grid; gap: .48rem; margin-top: .75rem; }
	.alert-row { position: relative; display: grid; grid-template-columns: 7.5rem minmax(0, 1.5fr) 5.5rem 9.5rem auto; align-items: center; gap: .75rem; min-width: 0; padding: .78rem; border: 1px solid var(--line-soft); border-radius: .75rem; color: inherit; text-decoration: none; }.alert-row:hover { border-color: var(--sky); background: var(--surface-soft); }
	.alert-meta { display: flex; flex-wrap: wrap; align-items: center; gap: .3rem; }.severity, .category { padding: .2rem .38rem; border-radius: 999px; font-size: .48rem; font-weight: 900; letter-spacing: .045em; text-transform: uppercase; }.severity { background: var(--pale-blue); color: var(--blue); }.severity.critical { background: color-mix(in srgb, var(--danger) 13%, transparent); color: var(--danger); }.severity.high { background: color-mix(in srgb, var(--warning) 15%, transparent); color: var(--warning); }.severity.medium { background: var(--pale-blue); color: var(--blue); }.category { background: var(--surface-soft); color: var(--text-muted); }
	.alert-copy { min-width: 0; }.alert-copy strong, .alert-copy p, .alert-copy small { display: block; }.alert-copy strong { color: var(--navy); font-size: .72rem; }.alert-copy p { margin: .18rem 0; color: var(--text-muted); font-size: .61rem; line-height: 1.45; }.alert-copy small { color: var(--text); font-size: .58rem; line-height: 1.42; }
	.alert-count strong, .alert-count span, .observed strong, .observed span { display: block; }.alert-count strong { color: var(--navy); font-size: 1rem; }.alert-count span, .observed span { color: var(--text-muted); font-size: .52rem; }.observed strong { margin-top: .14rem; color: var(--text); font-size: .57rem; line-height: 1.4; }:global(.chevron) { color: var(--steel); }
	.empty { display: grid; place-items: center; padding: 2.5rem 1rem; color: var(--text-muted); text-align: center; }.empty strong, .empty span { display: block; }.empty strong { margin-top: .55rem; color: var(--navy); font-size: .78rem; }.empty span { margin-top: .25rem; font-size: .64rem; }
	@media (max-width: 1099px) {
		.summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
		.alert-row { grid-template-columns: 7rem minmax(0, 1fr) 5rem auto; }.observed { display: none; }
	}
	@media (max-width: 699px) {
		.panel-heading, .filters { align-items: stretch; flex-direction: column; }.heading-actions { justify-content: flex-end; }.filters label, .filters select { width: 100%; box-sizing: border-box; }.severity-filters { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }.severity-filters button { justify-content: space-between; }
		.alert-row { grid-template-columns: minmax(0, 1fr) auto; }.alert-meta, .alert-copy { grid-column: 1; }.alert-count { grid-column: 2; grid-row: 1 / span 2; align-self: center; text-align: right; }:global(.chevron) { display: none; }
	}
	@media (max-width: 449px) { .summary-grid { grid-template-columns: 1fr; } }
</style>
