<script lang="ts">
	import { ChevronRight, Search } from '@lucide/svelte';
	import AppShell from '#lib/components/AppShell.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import { formatNaira, formatNumber } from '#lib/format.js';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
	let search = $state('');
	let assignment = $state<'all' | 'assigned' | 'unassigned'>('all');
	let customers = $derived(data.overview?.customers ?? []);
	let filtered = $derived(customers.filter((customer) => {
		const term = search.trim().toLowerCase();
		const matches = !term || [customer.displayName, customer.accountNumber, customer.assignedMeterNumber ?? '', customer.siteName].join(' ').toLowerCase().includes(term);
		return matches && (assignment === 'all' || (assignment === 'assigned' ? Boolean(customer.assignedMeterNumber) : !customer.assignedMeterNumber));
	}));
</script>

<svelte:head><title>Customer accounts | MicroAccess Smart Metering</title></svelte:head>
<AppShell active="customers">
	<PageHeader eyebrow="Customer operations" title="Customer accounts" description="Review provider account balances, tariffs, meter assignment and transaction history without confusing money with kWh." refreshHref="/customers?refresh=true" />
	{#if data.error}<section class="state">{data.error.message}</section>{:else}
		<section class="panel">
			<div class="heading"><div><p>Provider accounts</p><h2>Account register</h2></div><span>{filtered.length} of {customers.length}</span></div>
			<div class="filters"><label><Search size={16} /><input bind:value={search} placeholder="Search customer, account or meter" /></label><select bind:value={assignment}><option value="all">All assignments</option><option value="assigned">Meter assigned</option><option value="unassigned">No observed meter</option></select></div>
			<div class="table-wrap"><table><thead><tr><th>Customer</th><th>Assigned meter</th><th>Account balance</th><th>Energy balance</th><th>Tariff</th><th></th></tr></thead><tbody>
				{#each filtered as customer (customer.providerId)}<tr>
					<td><a href={`/customers/${customer.providerId}`}><strong>{customer.displayName}</strong><span>{customer.accountNumber || 'No account number'} · {customer.siteName}</span></a></td>
					<td>{customer.assignedMeterNumber ?? 'Unassigned'}</td>
					<td class:negative={(customer.accountBalance ?? 0) < 0}><strong>{formatNaira(customer.accountBalance)}</strong><span>Provider monetary ledger</span></td>
					<td>{formatNumber(customer.energyBalanceKwh)} kWh</td><td>{customer.tariffBand}<span>{customer.energyPrice === null ? 'No price' : `${formatNaira(customer.energyPrice)}/kWh`}</span></td>
					<td><a class="open" href={`/customers/${customer.providerId}`}><ChevronRight size={17} /></a></td>
				</tr>{:else}<tr><td colspan="6" class="empty">No account matches the current filters.</td></tr>{/each}
			</tbody></table></div>
		</section>
	{/if}
</AppShell>

<style>
	.panel, .state { padding: 1rem; border: 1px solid var(--line); border-radius: 1rem; background: var(--surface); box-shadow: var(--shadow-sm); }
	.heading { display: flex; justify-content: space-between; margin-bottom: 1rem; }.heading p { margin: 0 0 .3rem; color: var(--steel); font-size: .62rem; font-weight: 850; letter-spacing: .09em; text-transform: uppercase; }.heading h2 { margin: 0; color: var(--navy); font-size: 1.08rem; }.heading > span { padding: .3rem .58rem; border-radius: 999px; background: var(--pale-blue); color: var(--blue); font-size: .66rem; font-weight: 800; }
	.filters { display: grid; grid-template-columns: 1fr auto; gap: .6rem; margin-bottom: 1rem; }.filters label { display: flex; align-items: center; gap: .45rem; padding: 0 .7rem; border: 1px solid var(--line); border-radius: .7rem; color: var(--text-muted); }.filters input, .filters select { padding: .68rem; border: 1px solid var(--line); border-radius: .7rem; background: var(--surface); color: var(--text); outline: none; }.filters input { width: 100%; padding-left: 0; border: 0; }
	.table-wrap { overflow: auto; border: 1px solid var(--line-soft); border-radius: .8rem; }table { width: 100%; border-collapse: collapse; font-size: .68rem; }th { padding: .72rem; background: var(--surface-soft); color: var(--text-muted); font-size: .59rem; text-align: left; text-transform: uppercase; white-space: nowrap; }td { padding: .78rem .72rem; border-top: 1px solid var(--line-soft); white-space: nowrap; }td a { color: inherit; text-decoration: none; }td strong, td span { display: block; }td strong { color: var(--navy); font-size: .72rem; }td span { margin-top: .18rem; color: var(--text-muted); font-size: .59rem; }.negative strong { color: var(--danger); }.open { color: var(--blue); }.empty { padding: 2rem; color: var(--text-muted); text-align: center; }.state { color: var(--danger); }
	@media (max-width: 700px) { .filters { grid-template-columns: 1fr; } }
</style>
