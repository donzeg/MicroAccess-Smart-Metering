<script lang="ts">
	import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, ListFilter, Search } from '@lucide/svelte';
	import AppShell from '#lib/components/AppShell.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import StatusPill from '#lib/components/StatusPill.svelte';
	import { formatDateTime, formatNumber } from '#lib/format.js';
	import type { MeterConnectivity, MeterOperationalRole, MeterSummary } from '#lib/types.js';
	import type { PageProps } from './$types';

	type SortKey = 'meter' | 'role' | 'customer' | 'connectivity' | 'lastSeen' | 'latestRegister';
	type SortDirection = 'asc' | 'desc';

	let { data }: PageProps = $props();
	let search = $state('');
	let connectivity = $state<'all' | MeterConnectivity>('all');
	let role = $state<'all' | MeterOperationalRole>('all');
	let sortKey = $state<SortKey>('connectivity');
	let sortDirection = $state<SortDirection>('asc');
	let meters = $derived(data.overview?.meters ?? []);
	let filtered = $derived(meters.filter((meter) => {
		const term = search.trim().toLowerCase();
		const searchable = [meter.meterNumber, meter.name, meter.model, meter.customerName ?? '', meter.siteName].join(' ').toLowerCase();
		return (!term || searchable.includes(term)) && (connectivity === 'all' || meter.connectivity === connectivity) && (role === 'all' || meter.operationalRole === role);
	}));
	const labels: Record<MeterOperationalRole, string> = { grid_source: 'Grid source', solar_source: 'Solar source', generator_source: 'Generator source', distribution_or_bulk: 'Distribution / bulk', customer_load: 'Customer load', unknown: 'Unclassified' };
	const connectivityOrder: Record<MeterConnectivity, number> = { online: 0, offline: 1, never_online: 2, unknown: 3 };
	const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
	const lastSeenTime = (meter: MeterSummary): number | null => {
		if (!meter.lastReadingAt) return null;
		const timestamp = new Date(meter.lastReadingAt).getTime();
		return Number.isFinite(timestamp) ? timestamp : null;
	};
	const sortValue = (meter: MeterSummary, key: SortKey): string | number | null => {
		if (key === 'meter') return meter.meterNumber;
		if (key === 'role') return labels[meter.operationalRole];
		if (key === 'customer') return meter.customerName;
		if (key === 'connectivity') return connectivityOrder[meter.connectivity];
		if (key === 'lastSeen') return lastSeenTime(meter);
		return meter.latestReadingKwh;
	};
	const compareMeters = (left: MeterSummary, right: MeterSummary): number => {
		if (sortKey === 'connectivity') {
			const statusResult = connectivityOrder[left.connectivity] - connectivityOrder[right.connectivity];
			if (statusResult !== 0) return sortDirection === 'asc' ? statusResult : -statusResult;

			// Connectivity groups are always ordered by recency so the next meter shown
			// after the online group is the one that most recently stopped reporting.
			const leftLastSeen = lastSeenTime(left);
			const rightLastSeen = lastSeenTime(right);
			if (leftLastSeen === null && rightLastSeen !== null) return 1;
			if (leftLastSeen !== null && rightLastSeen === null) return -1;
			if (leftLastSeen !== null && rightLastSeen !== null && leftLastSeen !== rightLastSeen) {
				return rightLastSeen - leftLastSeen;
			}
			return collator.compare(left.meterNumber, right.meterNumber);
		}

		const leftValue = sortValue(left, sortKey);
		const rightValue = sortValue(right, sortKey);
		if (leftValue === null && rightValue === null) return collator.compare(left.meterNumber, right.meterNumber);
		if (leftValue === null) return 1;
		if (rightValue === null) return -1;
		const result = typeof leftValue === 'number' && typeof rightValue === 'number'
			? leftValue - rightValue
			: collator.compare(String(leftValue), String(rightValue));
		return (sortDirection === 'asc' ? result : -result) || collator.compare(left.meterNumber, right.meterNumber);
	};
	let sorted = $derived([...filtered].sort(compareMeters));
	const toggleSort = (key: SortKey) => {
		if (sortKey === key) sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		else {
			sortKey = key;
			sortDirection = key === 'lastSeen' || key === 'latestRegister' ? 'desc' : 'asc';
		}
	};
	const ariaSort = (key: SortKey): 'none' | 'ascending' | 'descending' =>
		sortKey !== key ? 'none' : sortDirection === 'asc' ? 'ascending' : 'descending';
	const tone = (value: MeterConnectivity): 'success' | 'danger' | 'warning' | 'neutral' => value === 'online' ? 'success' : value === 'never_online' ? 'danger' : value === 'offline' ? 'warning' : 'neutral';
</script>

<svelte:head><title>Meter operations | MicroAccess Smart Metering</title></svelte:head>
<AppShell active="meters">
	<PageHeader eyebrow="Asset operations" title="Meter register" description="Search the full estate, open any meter and review its live state and dated reading history." refreshHref="/meters?refresh=true" />
	{#if data.error}
		<section class="state">{data.error.message}</section>
	{:else}
		<section class="panel">
			<div class="panel-heading"><div><p>Live estate</p><h2>All meters</h2></div><span>{sorted.length} of {meters.length}</span></div>
			<div class="filters">
				<label class="search"><Search size={16} /><input bind:value={search} placeholder="Search meter, model or customer" aria-label="Search meters" /></label>
				<label><ListFilter size={15} /><select bind:value={connectivity} aria-label="Connectivity filter"><option value="all">All connectivity</option><option value="online">Online</option><option value="offline">Offline</option><option value="never_online">Never online</option><option value="unknown">Unknown</option></select></label>
				<label><select bind:value={role} aria-label="Role filter"><option value="all">All roles</option><option value="grid_source">Grid source</option><option value="solar_source">Solar source</option><option value="distribution_or_bulk">Distribution / bulk</option><option value="customer_load">Customer load</option><option value="unknown">Unclassified</option></select></label>
			</div>
			<div class="table-wrap"><table>
				<thead><tr>
					<th aria-sort={ariaSort('meter')}><button type="button" class="sort" onclick={() => toggleSort('meter')}>Meter {#if sortKey === 'meter'}{#if sortDirection === 'asc'}<ArrowUp size={13} />{:else}<ArrowDown size={13} />{/if}{:else}<ArrowUpDown size={13} />{/if}</button></th>
					<th aria-sort={ariaSort('role')}><button type="button" class="sort" onclick={() => toggleSort('role')}>Operational role {#if sortKey === 'role'}{#if sortDirection === 'asc'}<ArrowUp size={13} />{:else}<ArrowDown size={13} />{/if}{:else}<ArrowUpDown size={13} />{/if}</button></th>
					<th aria-sort={ariaSort('customer')}><button type="button" class="sort" onclick={() => toggleSort('customer')}>Assigned customer {#if sortKey === 'customer'}{#if sortDirection === 'asc'}<ArrowUp size={13} />{:else}<ArrowDown size={13} />{/if}{:else}<ArrowUpDown size={13} />{/if}</button></th>
					<th aria-sort={ariaSort('connectivity')}><button type="button" class="sort" onclick={() => toggleSort('connectivity')}>Connectivity {#if sortKey === 'connectivity'}{#if sortDirection === 'asc'}<ArrowUp size={13} />{:else}<ArrowDown size={13} />{/if}{:else}<ArrowUpDown size={13} />{/if}</button></th>
					<th aria-sort={ariaSort('lastSeen')}><button type="button" class="sort" onclick={() => toggleSort('lastSeen')}>Last seen {#if sortKey === 'lastSeen'}{#if sortDirection === 'asc'}<ArrowUp size={13} />{:else}<ArrowDown size={13} />{/if}{:else}<ArrowUpDown size={13} />{/if}</button></th>
					<th aria-sort={ariaSort('latestRegister')}><button type="button" class="sort" onclick={() => toggleSort('latestRegister')}>Latest register {#if sortKey === 'latestRegister'}{#if sortDirection === 'asc'}<ArrowUp size={13} />{:else}<ArrowDown size={13} />{/if}{:else}<ArrowUpDown size={13} />{/if}</button></th>
					<th><span class="sr-only">Open record</span></th>
				</tr></thead>
				<tbody>{#each sorted as meter (meter.providerId)}
					<tr>
						<td><a href={`/meters/${meter.providerId}`}><strong>{meter.meterNumber}</strong><span>{meter.name} · {meter.model}</span></a></td>
						<td>{labels[meter.operationalRole]}</td>
						<td>{#if meter.customerId && meter.customerName}<a class="customer" href={`/customers/${meter.customerId}`}><strong>{meter.customerName}</strong><span>Open customer account</span></a>{:else}<span class="unassigned">Unassigned</span>{/if}</td>
						<td><StatusPill label={meter.connectivityLabel} tone={tone(meter.connectivity)} /></td>
						<td>{formatDateTime(meter.lastReadingAt)}</td><td>{formatNumber(meter.latestReadingKwh)} <small>kWh</small></td>
						<td><a class="open" href={`/meters/${meter.providerId}`} aria-label={`Open meter ${meter.meterNumber}`}><ChevronRight size={17} /></a></td>
					</tr>
				{:else}<tr><td colspan="7" class="empty">No meter matches the selected filters.</td></tr>{/each}</tbody>
			</table></div>
		</section>
	{/if}
</AppShell>

<style>
	.panel, .state { padding: 1rem; border: 1px solid var(--line); border-radius: 1rem; background: var(--surface); box-shadow: var(--shadow-sm); }
	.panel-heading { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1rem; }
	.panel-heading p { margin: 0 0 .3rem; color: var(--steel); font-size: .62rem; font-weight: 850; letter-spacing: .09em; text-transform: uppercase; }
	.panel-heading h2 { margin: 0; color: var(--navy); font-size: 1.08rem; }
	.panel-heading > span { padding: .3rem .58rem; border-radius: 999px; background: var(--pale-blue); color: var(--blue); font-size: .66rem; font-weight: 800; }
	.filters { display: grid; grid-template-columns: minmax(15rem, 1fr) auto auto; gap: .6rem; margin-bottom: 1rem; }
	.filters label { display: flex; align-items: center; gap: .45rem; padding: 0 .7rem; border: 1px solid var(--line); border-radius: .7rem; color: var(--text-muted); }
	.filters input, .filters select { min-width: 0; padding: .68rem 0; border: 0; background: transparent; color: var(--text); outline: none; }
	.search input { width: 100%; }
	.table-wrap { overflow: auto; border: 1px solid var(--line-soft); border-radius: .8rem; }
	table { width: 100%; border-collapse: collapse; font-size: .69rem; }
	th { padding: .72rem; background: var(--surface-soft); color: var(--text-muted); font-size: .6rem; letter-spacing: .04em; text-align: left; text-transform: uppercase; white-space: nowrap; }
	.sort { display: inline-flex; align-items: center; gap: .3rem; padding: 0; border: 0; background: transparent; color: inherit; font: inherit; font-weight: 800; letter-spacing: inherit; text-transform: inherit; cursor: pointer; }
	.sort:hover, .sort:focus-visible { color: var(--blue); }
	.sort:focus-visible { outline: 2px solid var(--sky); outline-offset: 3px; border-radius: .2rem; }
	td { padding: .78rem .72rem; border-top: 1px solid var(--line-soft); color: var(--text); white-space: nowrap; }
	td:first-child { min-width: 13rem; }
	td a { color: inherit; text-decoration: none; }
	td strong, td span { display: block; }
	td strong { color: var(--navy); font-size: .73rem; }
	td span, td small { margin-top: .18rem; color: var(--text-muted); font-size: .59rem; }
	.customer strong { max-width: 18rem; overflow: hidden; text-overflow: ellipsis; }
	.unassigned { display: inline-block; margin-top: 0; color: var(--text-muted); }
	.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
	tr:hover td { background: var(--surface-soft); }
	.open { color: var(--blue); }
	.empty { padding: 2rem; text-align: center; color: var(--text-muted); }
	.state { color: var(--danger); }
	@media (max-width: 800px) { .filters { grid-template-columns: 1fr; } }
</style>
