<script lang="ts">
	import type { Component } from 'svelte';

	let {
		label,
		value,
		note,
		icon: Icon,
		tone = 'blue'
	}: {
		label: string;
		value: string | number;
		note: string;
		icon: Component;
		tone?: 'blue' | 'teal' | 'green' | 'amber' | 'red';
	} = $props();
</script>

<article class={`kpi ${tone}`}>
	<div class="icon-wrap"><Icon size={19} strokeWidth={1.9} /></div>
	<div>
		<p>{label}</p>
		<strong>{value}</strong>
		<span>{note}</span>
	</div>
</article>

<style>
	.kpi {
		display: flex;
		min-width: 0;
		gap: 0.9rem;
		padding: 1rem;
		border: 1px solid var(--line);
		border-radius: 1rem;
		background: var(--surface);
		box-shadow: var(--shadow-sm);
	}

	.icon-wrap {
		display: grid;
		width: 2.4rem;
		height: 2.4rem;
		flex: 0 0 auto;
		place-items: center;
		border-radius: 0.75rem;
		background: var(--pale-blue);
		color: var(--blue);
	}

	.kpi.teal .icon-wrap {
		background: #e5f1f3;
		color: var(--teal);
	}

	.kpi.green .icon-wrap {
		background: #e5f4ed;
		color: var(--success);
	}

	.kpi.amber .icon-wrap {
		background: #fff4dc;
		color: var(--warning);
	}

	.kpi.red .icon-wrap {
		background: #fdebec;
		color: var(--danger);
	}

	p {
		margin: 0 0 0.28rem;
		color: var(--text-muted);
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.03em;
		text-transform: uppercase;
	}

	strong {
		display: block;
		color: var(--navy);
		font-size: clamp(1.45rem, 2vw, 1.92rem);
		line-height: 1;
	}

	span {
		display: block;
		margin-top: 0.45rem;
		overflow: hidden;
		color: var(--text-muted);
		font-size: 0.74rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
