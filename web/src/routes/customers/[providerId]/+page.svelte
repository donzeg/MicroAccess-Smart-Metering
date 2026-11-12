<script lang="ts">
	import { AlertTriangle, ArrowLeft, CircleDollarSign, Gauge, ReceiptText, WalletCards } from '@lucide/svelte';
	import AppShell from '#lib/components/AppShell.svelte';
	import LineChart from '#lib/components/LineChart.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import { formatDateTime, formatNaira, formatNumber } from '#lib/format.js';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
	let balanceValues = $derived((data.customer?.balances ?? []).map((point) => point.accountBalance));
</script>

<svelte:head><title>{data.customer?.displayName ?? 'Customer'} | MicroAccess Smart Metering</title></svelte:head>
<AppShell active="customers">
	<PageHeader eyebrow="Customer operations · account detail" title={data.customer?.displayName ?? 'Account unavailable'} description="Monetary balance, meter assignment and the retrieved SteamaCo transaction window." />
	<a class="back" href="/customers"><ArrowLeft size={15} />Back to customer accounts</a>
	{#if data.error || !data.customer}<section class="state">{data.error?.message ?? 'The account could not be loaded.'}</section>{:else}
		{@const customer = data.customer}
		<section class="kpis">
			<article class:negative={(customer.accountBalance ?? 0) < 0}><WalletCards size={18} /><span>Current account balance</span><strong>{formatNaira(customer.accountBalance)}</strong><p>Provider monetary ledger—not kWh</p></article>
			<article><Gauge size={18} /><span>Energy balance</span><strong>{formatNumber(customer.energyBalanceKwh)} <small>kWh</small></strong><p>Residual energy value reported by provider</p></article>
			<article><ReceiptText size={18} /><span>Retrieved transactions</span><strong>{customer.transactionSummary.retrievedCount}</strong><p>{formatDateTime(customer.transactionSummary.from)} – {formatDateTime(customer.transactionSummary.to)}</p></article>
			<article><CircleDollarSign size={18} /><span>Retrieved payment credits</span><strong>{formatNaira(customer.transactionSummary.paymentAmount)}</strong><p>PAY category within retrieved window</p></article>
		</section>
		{#each customer.warnings as warning}<div class="warning"><AlertTriangle size={16} /><span>{warning}</span></div>{/each}
		<section class="grid">
			<article class="panel chart"><div class="heading"><div><p>Balance history</p><h2>Provider account balance trend</h2></div><span>{customer.balances.length} dated balances</span></div><LineChart values={balanceValues} label={`Account balance trend for ${customer.displayName}`} unit="NGN" /></article>
			<aside class="panel profile"><div class="heading"><div><p>Account setup</p><h2>Billing profile</h2></div></div><dl><div><dt>Account number</dt><dd>{customer.accountNumber || 'Not provided'}</dd></div><div><dt>Assigned meter</dt><dd>{customer.assignedMeterNumber ?? 'Unassigned'}</dd></div><div><dt>Tariff band</dt><dd>{customer.tariffBand}</dd></div><div><dt>Energy price</dt><dd>{formatNaira(customer.energyPrice)}/kWh</dd></div><div><dt>Control type</dt><dd>{customer.controlType}</dd></div><div><dt>Site</dt><dd>{customer.siteName}</dd></div></dl></aside>
		</section>
		<section class="panel transactions"><div class="heading"><div><p>Provider ledger</p><h2>Transaction history</h2></div><span>{customer.transactionSummary.retrievedCount} records</span></div><div class="table-wrap"><table><thead><tr><th>Timestamp</th><th>Category</th><th>Amount</th><th>Balance after posting</th><th>Meter</th><th>Reference</th></tr></thead><tbody>{#each customer.transactions as transaction (transaction.providerId)}<tr><td>{formatDateTime(transaction.timestamp)}</td><td>{transaction.category === 'UCH' ? 'Usage charge' : transaction.category === 'PAY' ? 'Payment' : transaction.category}</td><td class:debit={transaction.amount < 0}>{formatNaira(transaction.amount)}</td><td>{formatNaira(transaction.accountBalance)}</td><td>{transaction.meterNumber || 'Not provided'}</td><td>{transaction.reference || 'Not provided'}</td></tr>{:else}<tr><td colspan="6" class="empty">No transactions were returned.</td></tr>{/each}</tbody></table></div></section>
	{/if}
</AppShell>

<style>
	.back { display: inline-flex; align-items: center; gap: .35rem; margin: -.4rem 0 .8rem; color: var(--blue); font-size: .7rem; font-weight: 800; text-decoration: none; }
	.panel, .state { border: 1px solid var(--line); border-radius: 1rem; background: var(--surface); box-shadow: var(--shadow-sm); }.state { padding: 1rem; color: var(--danger); }
	.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: .75rem; }.kpis article { padding: .9rem; border: 1px solid var(--line); border-radius: .9rem; background: var(--surface); }.kpis :global(svg) { color: var(--teal); }.kpis span, .kpis strong, .kpis p { display: block; }.kpis span { margin-top: .6rem; color: var(--text-muted); font-size: .62rem; }.kpis strong { margin-top: .3rem; color: var(--navy); font-size: 1rem; }.kpis small { font-size: .62rem; }.kpis p { margin: .3rem 0 0; color: var(--text-muted); font-size: .58rem; }.kpis .negative strong { color: var(--danger); }
	.warning { display: flex; gap: .5rem; margin-top: .75rem; padding: .72rem .85rem; border: 1px solid #f1dfb5; border-radius: .75rem; background: #fffaf0; color: #855600; font-size: .67rem; }
	.grid { display: grid; grid-template-columns: 2fr .8fr; gap: .75rem; margin-top: .75rem; }.chart, .profile, .transactions { padding: 1rem; }.heading { display: flex; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; }.heading p { margin: 0 0 .3rem; color: var(--steel); font-size: .62rem; font-weight: 850; text-transform: uppercase; }.heading h2 { margin: 0; color: var(--navy); font-size: 1.03rem; }.heading > span { color: var(--text-muted); font-size: .62rem; }
	dl { margin: 0; }dl div { display: grid; grid-template-columns: 1fr 1.3fr; gap: .5rem; padding: .68rem 0; border-top: 1px solid var(--line-soft); font-size: .66rem; }dt { color: var(--text-muted); }dd { margin: 0; color: var(--navy); font-weight: 750; text-align: right; }
	.transactions { margin-top: .75rem; }.table-wrap { max-height: 31rem; overflow: auto; border: 1px solid var(--line-soft); border-radius: .75rem; }table { width: 100%; border-collapse: collapse; font-size: .67rem; }th { position: sticky; top: 0; padding: .68rem; background: var(--surface-soft); color: var(--text-muted); font-size: .58rem; text-align: left; text-transform: uppercase; }td { padding: .68rem; border-top: 1px solid var(--line-soft); white-space: nowrap; }.debit { color: var(--danger); font-weight: 750; }.empty { padding: 2rem; text-align: center; color: var(--text-muted); }
	@media (max-width: 1050px) { .kpis { grid-template-columns: repeat(2, 1fr); }.grid { grid-template-columns: 1fr; } }@media (max-width: 620px) { .kpis { grid-template-columns: 1fr; } }
</style>
