<script lang="ts">
	let {
		label,
		tone = 'neutral'
	}: { label: string; tone?: 'success' | 'danger' | 'warning' | 'info' | 'neutral' } = $props();
</script>

<span class={`pill ${tone}`}><i></i>{label}</span>

<style>
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 0.38rem;
		max-width: 100%;
		padding: 0.28rem 0.55rem;
		border-radius: 999px;
		background: #eef2f5;
		color: #536473;
		font-size: 0.7rem;
		font-weight: 700;
		line-height: 1.2;
		white-space: nowrap;
	}

	i {
		width: 0.36rem;
		height: 0.36rem;
		border-radius: 50%;
		background: currentColor;
	}

	.success {
		background: #e5f4ed;
		color: #15744b;
	}

	.danger {
		background: #fdebec;
		color: #bd3038;
	}

	.warning {
		background: #fff4dc;
		color: #9a6500;
	}

	.info {
		background: var(--pale-blue);
		color: var(--blue);
	}
</style>
