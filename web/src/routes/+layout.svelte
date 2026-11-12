<script lang="ts">
	import favicon from '#lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
	onMount(() => {
		const savedTheme = localStorage.getItem('msm_theme');
		const theme = savedTheme === 'dark' || savedTheme === 'light'
			? savedTheme
			: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
		document.documentElement.dataset.theme = theme;
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="theme-color" content="#001D39" />
</svelte:head>

{@render children()}

<style global>
	:root {
		font-family: Inter, Aptos, "Segoe UI", system-ui, -apple-system, sans-serif;
		font-synthesis: none;
		color: #16334d;
		background: #eef4f7;
		--navy: #001d39;
		--nav-surface: #001d39;
		--blue: #0a4174;
		--action: #0a4174;
		--steel: #49769f;
		--teal: #4e8ea2;
		--mist: #6ea2b3;
		--sky: #7bbde8;
		--pale: #bdd8e9;
		--pale-blue: #e9f3f9;
		--surface: #ffffff;
		--canvas: #eef4f7;
		--text: #16334d;
		--text-muted: #6b7f90;
		--line: #d8e3e9;
		--line-soft: #e9f0f4;
		--success: #14784f;
		--warning: #b47805;
		--danger: #c13c43;
		--generator: #d8892f;
		--surface-soft: #f4f8fa;
		--shadow-sm: 0 6px 18px rgba(0, 29, 57, 0.045);
		--shadow-lg: 0 24px 70px rgba(0, 29, 57, 0.12);
	}

	:global(html[data-theme='dark']) {
		color-scheme: dark;
		color: #dceaf3;
		background: #071824;
		--navy: #d9efff;
		--nav-surface: #00182b;
		--blue: #79bceb;
		--action: #14679b;
		--steel: #8cb7d2;
		--teal: #72bbca;
		--mist: #8cb8c6;
		--sky: #7bc7ef;
		--pale: #33566b;
		--pale-blue: #173448;
		--surface: #0d2434;
		--surface-soft: #132d3e;
		--canvas: #071824;
		--text: #dceaf3;
		--text-muted: #9fb5c4;
		--line: #294554;
		--line-soft: #203a49;
		--success: #65d3a4;
		--warning: #efb952;
		--danger: #ff868b;
		--generator: #f0a84f;
		--shadow-sm: 0 6px 18px rgba(0, 0, 0, .18);
		--shadow-lg: 0 24px 70px rgba(0, 0, 0, .32);
	}

	:global(html) { scroll-behavior: smooth; }
	:global(body) { margin: 0; min-width: 320px; min-height: 100vh; background: var(--canvas); color: var(--text); transition: background .2s ease, color .2s ease; }
	:global(button), :global(input), :global(select) { font-family: inherit; }
	:global(button:focus-visible), :global(a:focus-visible), :global(input:focus-visible), :global(select:focus-visible) { outline: 3px solid rgba(123, 189, 232, .45); outline-offset: 2px; }
	:global(::selection) { background: var(--sky); color: var(--navy); }
</style>
