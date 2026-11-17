<script lang="ts">
	import { ChevronLeft, ChevronRight } from '@lucide/svelte';

	interface Props {
		total: number;
		page: number;
		pageSize: number;
		pageSizeOptions?: number[];
		onPageChange: (page: number) => void;
		onPageSizeChange: (pageSize: number) => void;
	}

	let {
		total,
		page,
		pageSize,
		pageSizeOptions = [10, 25, 50, 100],
		onPageChange,
		onPageSizeChange
	}: Props = $props();
	let totalPages = $derived(Math.max(1, Math.ceil(total / pageSize)));
	let safePage = $derived(Math.min(Math.max(1, page), totalPages));
	let firstRow = $derived(total === 0 ? 0 : (safePage - 1) * pageSize + 1);
	let lastRow = $derived(Math.min(total, safePage * pageSize));
</script>

<div class="pagination" aria-label="Table pagination">
	<span>Showing <strong>{firstRow}–{lastRow}</strong> of <strong>{total}</strong></span>
	<div class="controls">
		<label>
			Rows
			<select
				value={pageSize}
				aria-label="Rows per page"
				onchange={(event) => onPageSizeChange(Number(event.currentTarget.value))}
			>
				{#each pageSizeOptions as option}
					<option value={option}>{option}</option>
				{/each}
			</select>
		</label>
		<button type="button" disabled={safePage <= 1} onclick={() => onPageChange(safePage - 1)} aria-label="Previous page"><ChevronLeft size={15} /></button>
		<span>Page <strong>{safePage}</strong> of <strong>{totalPages}</strong></span>
		<button type="button" disabled={safePage >= totalPages} onclick={() => onPageChange(safePage + 1)} aria-label="Next page"><ChevronRight size={15} /></button>
	</div>
</div>

<style>
	.pagination { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: .85rem .15rem .05rem; color: var(--text-muted); font-size: .74rem; }
	.pagination strong { color: var(--navy); }
	.controls, .controls label { display: flex; align-items: center; gap: .42rem; }
	.controls select { min-height: 2.75rem; padding: .4rem 1.8rem .4rem .55rem; border: 1px solid var(--line); border-radius: .6rem; background: var(--surface); color: var(--text); font: inherit; }
	.controls button { display: grid; width: 2.75rem; height: 2.75rem; place-items: center; padding: 0; border: 1px solid var(--line); border-radius: .6rem; background: var(--surface); color: var(--blue); cursor: pointer; }
	.controls button:hover:not(:disabled) { border-color: var(--sky); background: var(--surface-soft); }
	.controls button:disabled { cursor: not-allowed; opacity: .35; }
	@media (max-width: 620px) { .pagination { align-items: flex-start; flex-direction: column; }.controls { width: 100%; flex-wrap: wrap; justify-content: space-between; }.controls label { flex: 1 1 auto; }.controls select { flex: 1; } }
	@media print { .pagination { display: none; } }
</style>
