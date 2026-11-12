<script lang="ts">
	import { RefreshCw } from '@lucide/svelte';
	let { eyebrow, title, description, refreshHref = null }: { eyebrow: string; title: string; description: string; refreshHref?: string | null } = $props();
</script>

<header>
	<div><p>{eyebrow}</p><h1>{title}</h1><span>{description}</span></div>
	{#if refreshHref}<a href={refreshHref}><RefreshCw size={16} />Refresh live data</a>{/if}
</header>

<style>
	header { display: flex; min-height: 7.2rem; align-items: center; justify-content: space-between; gap: 1rem; }
	p { margin: 0 0 .35rem; color: var(--steel); font-size: .64rem; font-weight: 850; letter-spacing: .09em; text-transform: uppercase; }
	h1 { margin: 0; color: var(--navy); font-size: clamp(1.45rem, 2.5vw, 2.15rem); letter-spacing: -.04em; }
	span { display: block; max-width: 48rem; margin-top: .42rem; color: var(--text-muted); font-size: .76rem; line-height: 1.45; }
	a { display: inline-flex; align-items: center; gap: .45rem; padding: .65rem .82rem; border-radius: .7rem; background: var(--action); color: white; font-size: .72rem; font-weight: 800; text-decoration: none; white-space: nowrap; }
	@media (max-width: 700px) { header { align-items: flex-start; flex-direction: column; padding: 1.2rem 0; } }
</style>
