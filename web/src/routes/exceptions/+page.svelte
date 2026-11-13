<script lang="ts">
	import { AlertTriangle, ChevronRight } from '@lucide/svelte';
	import AppShell from '#lib/components/AppShell.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import StatusPill from '#lib/components/StatusPill.svelte';
	import { formatDateTime } from '#lib/format.js';
	import type { MeterSummary, OperationsException } from '#lib/types.js';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
	let selectedOverride = $state<string | null>(null);
	let selected = $derived(selectedOverride ?? data.selectedType);
	let overview = $derived(data.overview);
	const affected = (meter: MeterSummary, type: string) => type === 'never_online' ? meter.freshnessBucket === 'never_online' : type === 'safety' ? meter.criticalError === true || meter.lidTamper === true : type === 'unassigned_meters' ? !meter.assigned : type === 'stale_telemetry' ? ['eight_to_fourteen_days', 'over_fourteen_days'].includes(meter.freshnessBucket) : type === 'unclassified_role' ? meter.operationalRole === 'unknown' : false;
	let customerException = $derived(selected === 'customers_without_meter');
	let visibleMeters = $derived((overview?.meters ?? []).filter((meter) => selected === 'all' ? true : customerException ? false : affected(meter, selected)));
	let visibleCustomers = $derived((overview?.customers ?? []).filter((customer) => customerException && !customer.assignedMeterNumber));
	const exceptionTone = (severity: OperationsException['severity']): 'danger' | 'warning' | 'info' => severity === 'critical' ? 'danger' : severity === 'high' ? 'warning' : 'info';
</script>

<svelte:head><title>Exceptions | MicroAccess Smart Metering</title></svelte:head>
<AppShell active="exceptions">
	<PageHeader eyebrow="Operational control" title="Exception workspace" description="Prioritised communication, assignment and device-quality issues with direct links to affected records." refreshHref="/exceptions?refresh=true" />
	{#if data.error}<section class="state">{data.error.message}</section>{:else if overview}
		<section class="exception-grid">
			<button class:active={selected === 'all'} onclick={() => selectedOverride = 'all'}><span>all</span><strong>{overview.meters.length}</strong><h2>Entire meter estate</h2><p>Clear the filter and review all meters.</p></button>
			{#each overview.exceptions as item (item.key)}<button class:active={selected === item.key} onclick={() => selectedOverride = item.key}><StatusPill label={item.severity} tone={exceptionTone(item.severity)} /><strong>{item.count}</strong><h2>{item.label}</h2><p>{item.action}</p></button>{/each}
		</section>
		<section class="panel">
			<div class="heading"><div><p>Working list</p><h2>{selected === 'all' ? 'All meters' : overview.exceptions.find((item) => item.key === selected)?.label ?? 'Affected records'}</h2></div><span>{customerException ? `${visibleCustomers.length} customers` : `${visibleMeters.length} meters`}</span></div>
			{#if customerException}
				<div class="list customer-list">{#each visibleCustomers as customer (customer.providerId)}<a href={`/customers/${customer.providerId}`}><div><strong>{customer.displayName}</strong><span>{customer.accountNumber || 'No account number'}</span></div><div><small>Assigned meter</small><strong>Not observed</strong></div><div><small>Site</small><strong>{customer.siteName}</strong></div><div><small>Tariff</small><strong>{customer.tariffBand}</strong></div><ChevronRight size={17} /></a>{:else}<div class="empty">No customer is currently in this exception category.</div>{/each}</div>
			{:else}
				<div class="list">{#each visibleMeters as meter (meter.providerId)}<a href={`/meters/${meter.providerId}`}><div><strong>{meter.meterNumber}</strong><span>{meter.name} · {meter.model}</span></div><div><small>Customer</small><strong>{meter.customerName ?? 'Unassigned'}</strong></div><div><small>Last reading</small><strong>{formatDateTime(meter.lastReadingAt)}</strong></div><div><small>Provider status</small><strong>{meter.connectivityLabel}</strong></div><ChevronRight size={17} /></a>{:else}<div class="empty">No meter is currently in this exception category.</div>{/each}</div>
			{/if}
		</section>
	{/if}
</AppShell>

<style>
	.state, .panel { padding: 1rem; border: 1px solid var(--line); border-radius: 1rem; background: var(--surface); box-shadow: var(--shadow-sm); }.state { color: var(--danger); }
	.exception-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: .7rem; margin-bottom: .75rem; }.exception-grid button { padding: .9rem; border: 1px solid var(--line); border-radius: .9rem; background: var(--surface); color: inherit; text-align: left; cursor: pointer; }.exception-grid button:hover, .exception-grid button.active { border-color: var(--sky); box-shadow: inset 0 0 0 1px var(--sky); }.exception-grid button > span:first-child { color: var(--steel); font-size: .6rem; font-weight: 850; text-transform: uppercase; }.exception-grid button > strong { float: right; color: var(--navy); font-size: 1.35rem; }.exception-grid h2 { clear: both; margin: .85rem 0 .35rem; color: var(--navy); font-size: .8rem; }.exception-grid p { margin: 0; color: var(--text-muted); font-size: .64rem; line-height: 1.5; }
	.heading { display: flex; justify-content: space-between; margin-bottom: 1rem; }.heading p { margin: 0 0 .3rem; color: var(--steel); font-size: .62rem; font-weight: 850; text-transform: uppercase; }.heading h2 { margin: 0; color: var(--navy); font-size: 1.05rem; }.heading > span { color: var(--text-muted); font-size: .65rem; }
	.list { display: grid; gap: .45rem; }.list a { display: grid; grid-template-columns: 1.25fr 1fr 1fr 1fr auto; align-items: center; gap: .75rem; padding: .75rem; border: 1px solid var(--line-soft); border-radius: .75rem; color: inherit; text-decoration: none; }.list a:hover { border-color: var(--sky); background: var(--surface-soft); }.list strong, .list span, .list small { display: block; }.list strong { color: var(--navy); font-size: .7rem; }.list span, .list small { color: var(--text-muted); font-size: .59rem; }.empty { padding: 2rem; color: var(--text-muted); text-align: center; }
	@media (max-width: 900px) { .exception-grid { grid-template-columns: repeat(2, 1fr); }.list a { grid-template-columns: 1fr auto; }.list a > div:not(:first-child) { display: none; } }@media (max-width: 600px) { .exception-grid { grid-template-columns: 1fr; } }
</style>
