<script lang="ts">
	import { Info } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	let {
		title,
		label = 'How this is calculated',
		align = 'right',
		children
	}: {
		title: string;
		label?: string;
		align?: 'left' | 'right';
		children: Snippet;
	} = $props();
</script>

<details class="info-popover" class:align-left={align === 'left'}>
	<summary aria-label={label} title={label}><Info size={15} /></summary>
	<div class="flyout" role="note">
		<div class="flyout-heading"><strong>{title}</strong></div>
		<div class="flyout-body">{@render children()}</div>
	</div>
</details>

<style>
	.info-popover { position: relative; display: inline-flex; flex: 0 0 auto; }
	summary { display: grid; width: 2.75rem; height: 2.75rem; box-sizing: border-box; place-items: center; border: 1px solid var(--line); border-radius: 50%; background: var(--surface-soft); color: var(--blue); cursor: pointer; list-style: none; transition: border-color .15s ease, background .15s ease, color .15s ease; }
	summary::-webkit-details-marker { display: none; }
	summary:hover { border-color: var(--sky); background: var(--pale-blue); color: var(--navy); }
	.info-popover[open] summary { border-color: var(--sky); background: var(--pale-blue); }
	.flyout { position: absolute; z-index: 80; top: calc(100% + .5rem); right: 0; width: min(22rem, calc(100vw - 3rem)); padding: .85rem; border: 1px solid var(--line); border-radius: .8rem; background: var(--surface); color: var(--text); box-shadow: var(--shadow-lg); }
	.align-left .flyout { right: auto; left: 0; }
	.flyout::before { position: absolute; top: -.35rem; right: .48rem; width: .65rem; height: .65rem; border-top: 1px solid var(--line); border-left: 1px solid var(--line); background: var(--surface); content: ''; transform: rotate(45deg); }
	.align-left .flyout::before { right: auto; left: .48rem; }
	.flyout-heading { padding-bottom: .55rem; border-bottom: 1px solid var(--line-soft); }
	.flyout-heading strong { color: var(--navy); font-size: .82rem; line-height: 1.4; }
	.flyout-body { padding-top: .6rem; color: var(--text-muted); font-size: .76rem; line-height: 1.55; text-align: left; }
	.flyout-body :global(p) { margin: 0; }
	.flyout-body :global(p + p) { margin-top: .55rem; }
	.flyout-body :global(ul) { margin: 0; padding-left: 1rem; }
	.flyout-body :global(li + li) { margin-top: .35rem; }
	.flyout-body :global(strong) { color: var(--navy); }
	@media (max-width: 620px) {
		.flyout, .align-left .flyout { position: fixed; top: auto; right: .75rem; bottom: .75rem; left: .75rem; width: auto; max-height: min(70dvh, 28rem); box-sizing: border-box; overflow-y: auto; transform: none; }
		.flyout::before, .align-left .flyout::before { display: none; }
	}
</style>
