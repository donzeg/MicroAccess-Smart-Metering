<script lang="ts">
	import { RefreshCw } from '@lucide/svelte';
	import NotificationBell from '#lib/components/NotificationBell.svelte';
	let { eyebrow, title, description, refreshHref = null }: { eyebrow: string; title: string; description: string; refreshHref?: string | null } = $props();
</script>

<header>
	<div><p>{eyebrow}</p><h1>{title}</h1><span>{description}</span></div>
	<div class="actions">
		<NotificationBell />
		{#if refreshHref}<a href={refreshHref}><RefreshCw size={16} />Refresh live data</a>{/if}
	</div>
</header>

<style>
	header { display: flex; min-height: 6.6rem; align-items: center; justify-content: space-between; gap: 1rem; }
	p { margin: 0 0 .35rem; color: var(--steel); font-size: .64rem; font-weight: 850; letter-spacing: .09em; text-transform: uppercase; }
	h1 { margin: 0; color: var(--navy); font-size: clamp(1.45rem, 2.5vw, 2.15rem); letter-spacing: -.04em; }
	span { display: block; max-width: 48rem; margin-top: .42rem; color: var(--text-muted); font-size: .82rem; line-height: 1.5; }
	.actions { display: flex; flex: 0 0 auto; align-items: center; gap: .55rem; }
	a { display: inline-flex; min-height: 2.75rem; box-sizing: border-box; align-items: center; gap: .45rem; padding: .65rem .82rem; border-radius: .7rem; background: var(--action); color: white; font-size: .76rem; font-weight: 800; text-decoration: none; white-space: nowrap; }
	@media (max-width: 899px) { header { min-height: auto; align-items: flex-start; flex-wrap: wrap; padding: 1rem 0; } .actions { margin-left: auto; } }
	@media (max-width: 599px) { header { min-height: auto; align-items: flex-start; flex-direction: column; padding: 1.3rem 0 1rem; } .actions { width: 100%; } a { flex: 1; justify-content: center; } }
</style>
