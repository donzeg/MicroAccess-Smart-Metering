<script lang="ts">
	import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, Search } from '@lucide/svelte';
	import AppShell from '#lib/components/AppShell.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import { formatNaira, formatNumber } from '#lib/format.js';
	import type { CustomerSummary } from '#lib/types.js';
	import type { PageProps } from './$types';

	type SortKey = 'customer' | 'meter' | 'accountBalance' | 'energyBalance' | 'tariff';
	type SortDirection = 'asc' | 'desc';

	let { data }: PageProps = $props();
	let search = $state('');
	let assignment = $state<'all' | 'assigned' | 'unassigned'>('all');
	let sortKey = $state<SortKey>('customer');
	let sortDirection = $state<SortDirection>('asc');
	let customers = $derived(data.overview?.customers ?? []);
	let metersByNumber = $derived(new Map((data.overview?.meters ?? []).map((meter) => [meter.meterNumber.replace(/\s+/g, '').toLowerCase(), meter])));
	let filtered = $derived(customers.filter((customer) => {
		const term = search.trim().toLowerCase();
		const matches = !term || [customer.displayName, customer.accountNumber, customer.assignedMeterNumber ?? '', customer.siteName].join(' ').toLowerCase().includes(term);
		return matches && (assignment === 'all' || (assignment === 'assigned' ? Boolean(customer.assignedMeterNumber) : !customer.assignedMeterNumber));
	}));
	const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
	const sortValue = (customer: CustomerSummary, key: SortKey): string | number | null => {
		if (key === 'customer') return customer.displayName;
		if (key === 'meter') return customer.assignedMeterNumber;
		if (key === 'accountBalance') return customer.accountBalance;
		if (key === 'energyBalance') return customer.energyBalanceKwh;
		return customer.tariffBand;
	};
	const compareCustomers = (left: CustomerSummary, right: CustomerSummary): number => {
		const leftValue = sortValue(left, sortKey);
		const rightValue = sortValue(right, sortKey);
		if (leftValue === null && rightValue === null) return collator.compare(left.displayName, right.displayName);
		if (leftValue === null) return 1;
		if (rightValue === null) return -1;
		const result = typeof leftValue === 'number' && typeof rightValue === 'number'
			? leftValue - rightValue
			: collator.compare(String(leftValue), String(rightValue));
		return (sortDirection === 'asc' ? result : -result) || collator.compare(left.displayName, right.displayName);
	};
	let sorted = $derived([...filtered].sort(compareCustomers));
	const toggleSort = (key: SortKey) => {
		if (sortKey === key) sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		else {
			sortKey = key;
			sortDirection = 'asc';
		}
	};
	const ariaSort = (key: SortKey): 'none' | 'ascending' | 'descending' =>
		sortKey !== key ? 'none' : sortDirection === 'asc' ? 'ascending' : 'descending';
	const assignedMeterId = (value: string | null): string | null => {
		if (!value) return null;
		const firstMeter = value.split(/[,;|]+/)[0]?.replace(/\s+/g, '').toLowerCase();
		return firstMeter ? metersByNumber.get(firstMeter)?.providerId ?? null : null;
	};
</script>

<svelte:head><title>Customer accounts | MicroAccess Smart Metering</title></svelte:head>
<AppShell active="customers">
	<PageHeader eyebrow="Customer operations" title="Customer accounts" description="Review provider account balances, tariffs, meter assignment and transaction history without confusing money with kWh." refreshHref="/customers?refresh=true" />
	{#if data.error}<section class="state">{data.error.message}</section>{:else}
		<section class="panel">
			<div class="heading"><div><p>Provider accounts</p><h2>Account register</h2></div><span>{sorted.length} of {customers.length}</span></div>
			<div class="filters"><label><Search size={16} /><input bind:value={search} placeholder="Search customer, account or meter" aria-label="Search customer accounts" /></label><select bind:value={assignment} aria-label="Meter assignment filter"><option value="all">All assignments</option><option value="assigned">Meter assigned</option><option value="unassigned">No observed meter</option></select></div>
			<div class="table-wrap"><table><thead><tr>
				<th aria-sort={ariaSort('customer')}><button type="button" class="sort" onclick={() => toggleSort('customer')}>Customer {#if sortKey === 'customer'}{#if sortDirection === 'asc'}<ArrowUp size={13} />{:else}<ArrowDown size={13} />{/if}{:else}<ArrowUpDown size={13} />{/if}</button></th>
				<th aria-sort={ariaSort('meter')}><button type="button" class="sort" onclick={() => toggleSort('meter')}>Assigned meter {#if sortKey === 'meter'}{#if sortDirection === 'asc'}<ArrowUp size={13} />{:else}<ArrowDown size={13} />{/if}{:else}<ArrowUpDown size={13} />{/if}</button></th>
				<th aria-sort={ariaSort('accountBalance')}><button type="button" class="sort" onclick={() => toggleSort('accountBalance')}>Account balance {#if sortKey === 'accountBalance'}{#if sortDirection === 'asc'}<ArrowUp size={13} />{:else}<ArrowDown size={13} />{/if}{:else}<ArrowUpDown size={13} />{/if}</button></th>
				<th aria-sort={ariaSort('energyBalance')}><button type="button" class="sort" onclick={() => toggleSort('energyBalance')}>Energy balance {#if sortKey === 'energyBalance'}{#if sortDirection === 'asc'}<ArrowUp size={13} />{:else}<ArrowDown size={13} />{/if}{:else}<ArrowUpDown size={13} />{/if}</button></th>
				<th aria-sort={ariaSort('tariff')}><button type="button" class="sort" onclick={() => toggleSort('tariff')}>Tariff {#if sortKey === 'tariff'}{#if sortDirection === 'asc'}<ArrowUp size={13} />{:else}<ArrowDown size={13} />{/if}{:else}<ArrowUpDown size={13} />{/if}</button></th>
				<th><span class="sr-only">Open record</span></th>
			</tr></thead><tbody>
				{#each sorted as customer (customer.providerId)}<tr>
					<td><a href={`/customers/${customer.providerId}`}><strong>{customer.displayName}</strong><span>{customer.accountNumber || 'No account number'} · {customer.siteName}</span></a></td>
					<td>{#if assignedMeterId(customer.assignedMeterNumber)}<a class="meter-link" href={`/meters/${assignedMeterId(customer.assignedMeterNumber)}`}><strong>{customer.assignedMeterNumber}</strong><span>Open meter record</span></a>{:else}{customer.assignedMeterNumber ?? 'Unassigned'}{/if}</td>
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
	.table-wrap { overflow: auto; border: 1px solid var(--line-soft); border-radius: .8rem; }table { width: 100%; border-collapse: collapse; font-size: .68rem; }th { padding: .72rem; background: var(--surface-soft); color: var(--text-muted); font-size: .59rem; text-align: left; text-transform: uppercase; white-space: nowrap; }.sort { display: inline-flex; align-items: center; gap: .3rem; padding: 0; border: 0; background: transparent; color: inherit; font: inherit; font-weight: 800; text-transform: inherit; cursor: pointer; }.sort:hover, .sort:focus-visible { color: var(--blue); }.sort:focus-visible { outline: 2px solid var(--sky); outline-offset: 3px; border-radius: .2rem; }td { padding: .78rem .72rem; border-top: 1px solid var(--line-soft); white-space: nowrap; }td a { color: inherit; text-decoration: none; }td strong, td span { display: block; }td strong { color: var(--navy); font-size: .72rem; }td span { margin-top: .18rem; color: var(--text-muted); font-size: .59rem; }.negative strong { color: var(--danger); }.open { color: var(--blue); }.empty { padding: 2rem; color: var(--text-muted); text-align: center; }.state { color: var(--danger); }.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
	@media (max-width: 700px) { .filters { grid-template-columns: 1fr; } }
</style>
