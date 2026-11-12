<script lang="ts">
	import type { CountSeriesItem } from '#lib/types.js';

	let {
		items,
		accent = 'var(--blue)',
		emptyLabel = 'No live data is available for this chart.'
	}: { items: CountSeriesItem[]; accent?: string; emptyLabel?: string } = $props();

	let maximum = $derived(Math.max(1, ...items.map((item) => item.count)));
</script>

{#if items.length === 0}
	<div class="empty-chart">{emptyLabel}</div>
{:else}
	<div class="bars" aria-label="Bar chart">
		{#each items as item (item.key)}
			<div class="bar-row">
				<div class="bar-label">
					<span>{item.label}</span>
					<strong>{item.count}</strong>
				</div>
				<div class="bar-track" aria-label={`${item.label}: ${item.count}`}>
					<div class="bar-fill" style={`width: ${Math.max(item.count > 0 ? 4 : 0, (item.count / maximum) * 100)}%; background: ${accent}`}></div>
				</div>
			</div>
		{/each}
	</div>
{/if}

<style>
	.bars {
		display: grid;
		gap: 0.92rem;
	}

	.bar-row {
		display: grid;
		gap: 0.45rem;
	}

	.bar-label {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		font-size: 0.78rem;
		color: var(--text-muted);
	}

	.bar-label strong {
		font-size: 0.84rem;
		color: var(--navy);
	}

	.bar-track {
		height: 0.58rem;
		overflow: hidden;
		border-radius: 999px;
		background: var(--line-soft);
	}

	.bar-fill {
		height: 100%;
		border-radius: inherit;
		transition: width 260ms ease;
	}

	.empty-chart {
		display: grid;
		min-height: 11rem;
		place-items: center;
		padding: 1.5rem;
		border: 1px dashed var(--line);
		border-radius: 1rem;
		color: var(--text-muted);
		text-align: center;
	}
</style>
