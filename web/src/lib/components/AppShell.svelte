<script lang="ts">
	import {
		AlertTriangle,
		BarChart3,
		BellRing,
		Building2,
		CircleDollarSign,
		Gauge,
		LayoutDashboard,
		Landmark,
		LoaderCircle,
		LogOut,
		Menu,
		Moon,
		PanelLeftClose,
		PanelLeftOpen,
		RadioTower,
		Sun,
		SunMedium,
		Users,
		X
	} from '@lucide/svelte';
	import { navigating } from '$app/state';
	import { onMount, type Snippet } from 'svelte';

	type NavKey = 'executive' | 'dashboard' | 'energy' | 'revenue' | 'floors' | 'meters' | 'customers' | 'exceptions' | 'alerts' | 'reports';
	let { active, children }: { active: NavKey; children: Snippet } = $props();
	let collapsed = $state(false);
	let mobileNavOpen = $state(false);
	let theme = $state<'light' | 'dark'>('light');

	onMount(() => {
		collapsed = localStorage.getItem('msm_sidebar_collapsed') === 'true';
		const savedTheme = localStorage.getItem('msm_theme');
		theme = savedTheme === 'dark' || savedTheme === 'light'
			? savedTheme
			: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
		document.documentElement.dataset.theme = theme;
	});

	const toggleSidebar = () => {
		collapsed = !collapsed;
		localStorage.setItem('msm_sidebar_collapsed', String(collapsed));
	};

	const toggleTheme = () => {
		theme = theme === 'dark' ? 'light' : 'dark';
		document.documentElement.dataset.theme = theme;
		localStorage.setItem('msm_theme', theme);
	};

	const links = [
		{ key: 'executive' as const, href: '/executive', label: 'Executive overview', icon: Landmark },
		{ key: 'dashboard' as const, href: '/', label: 'Operations command centre', icon: LayoutDashboard },
		{ key: 'energy' as const, href: '/energy-mix', label: 'Energy mix', icon: SunMedium },
		{ key: 'revenue' as const, href: '/revenue-costs', label: 'Revenue & cost', icon: CircleDollarSign },
		{ key: 'floors' as const, href: '/floors', label: 'Floor operations', icon: Building2 },
		{ key: 'meters' as const, href: '/meters', label: 'Meter operations', icon: Gauge },
		{ key: 'customers' as const, href: '/customers', label: 'Customer accounts', icon: Users },
		{ key: 'exceptions' as const, href: '/exceptions', label: 'Exceptions', icon: AlertTriangle },
		{ key: 'alerts' as const, href: '/alerts', label: 'Alerts & notifications', icon: BellRing },
		{ key: 'reports' as const, href: '/reports', label: 'Reports & analytics', icon: BarChart3 }
	];
</script>

<div class="app-shell" class:collapsed>
	<header class="mobile-header">
		<a class="mobile-brand" href="/" aria-label="MicroAccess Smart Metering home">
			<span><RadioTower size={19} strokeWidth={1.8} /></span>
			<strong>MicroAccess <small>Smart Metering</small></strong>
		</a>
		<button type="button" aria-label="Open navigation" aria-controls="primary-sidebar" aria-expanded={mobileNavOpen} onclick={() => mobileNavOpen = true}><Menu size={21} /></button>
	</header>

	<aside id="primary-sidebar" class="sidebar" class:mobile-open={mobileNavOpen}>
		<div class="brand-row">
			<a class="brand" href="/" aria-label="MicroAccess Smart Metering home" title={collapsed ? 'MicroAccess Smart Metering' : undefined}>
				<span class="brand-mark"><RadioTower size={22} strokeWidth={1.8} /></span>
				<span class="brand-copy"><strong>MicroAccess</strong><small>Smart Metering</small></span>
			</a>
			<button class="collapse-control" type="button" onclick={toggleSidebar} aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'} title={collapsed ? 'Expand navigation' : 'Collapse navigation'}>
				{#if collapsed}<PanelLeftOpen size={17} />{:else}<PanelLeftClose size={17} />{/if}
			</button>
			<button class="mobile-close" type="button" onclick={() => mobileNavOpen = false} aria-label="Close navigation"><X size={20} /></button>
		</div>

		<nav aria-label="Primary navigation">
			<p><span>Workspace</span></p>
			{#each links as link (link.key)}
				<a class:active={active === link.key} class:pending={navigating.to?.url.pathname === link.href} href={link.href} aria-current={active === link.key ? 'page' : undefined} aria-busy={navigating.to?.url.pathname === link.href ? 'true' : undefined} title={collapsed ? link.label : undefined} onclick={() => mobileNavOpen = false}>
					<link.icon size={17} /><span>{link.label}</span>
					{#if navigating.to?.url.pathname === link.href}<LoaderCircle class="pending-indicator" size={14} />{/if}
				</a>
			{/each}
		</nav>

		<button class="theme-control" type="button" onclick={toggleTheme} aria-label={theme === 'dark' ? 'Use light mode' : 'Use dark mode'} title={theme === 'dark' ? 'Use light mode' : 'Use dark mode'}>
			{#if theme === 'dark'}<Sun size={16} />{:else}<Moon size={16} />{/if}<span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
		</button>

		<form method="POST" action="/logout">
			<button class="sign-out" type="submit" title={collapsed ? 'Sign out' : undefined}><LogOut size={16} /><span>Sign out</span></button>
		</form>
	</aside>
	{#if mobileNavOpen}<button class="mobile-backdrop" type="button" onclick={() => mobileNavOpen = false} aria-label="Close navigation"></button>{/if}
	<main>{@render children()}</main>
</div>

<style>
	.app-shell { display: grid; min-height: 100vh; grid-template-columns: 15.5rem minmax(0, 1fr); transition: grid-template-columns .2s ease; }
	.app-shell.collapsed { grid-template-columns: 4.7rem minmax(0, 1fr); }
	.mobile-header, .mobile-close, .mobile-backdrop { display: none; }
	.sidebar { position: sticky; top: 0; display: flex; height: 100vh; box-sizing: border-box; flex-direction: column; padding: 1.35rem 1rem; background: var(--nav-surface); color: white; }
	.brand-row { display: flex; align-items: flex-start; justify-content: space-between; gap: .35rem; }
	.brand { display: flex; min-width: 0; align-items: center; gap: .72rem; padding: .25rem .35rem 1.5rem; color: white; text-decoration: none; }
	.brand-mark { display: grid; width: 2.45rem; height: 2.45rem; flex: 0 0 auto; place-items: center; border-radius: .78rem; background: linear-gradient(145deg, var(--blue), var(--teal)); color: white; }
	.brand strong, .brand small { display: block; }
	.brand strong { font-size: .88rem; }
	.brand small { margin-top: .12rem; color: var(--pale); font-size: .62rem; letter-spacing: .07em; text-transform: uppercase; }
	nav p { margin: .9rem .7rem .55rem; color: var(--mist); font-size: .62rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
	nav a { display: flex; align-items: center; gap: .7rem; margin: .2rem 0; padding: .72rem .7rem; border-radius: .72rem; color: #a9c4d6; font-size: .76rem; font-weight: 650; text-decoration: none; }
	nav a:hover, nav a.active { background: rgba(123, 189, 232, .12); color: white; }
	nav a.active { box-shadow: inset 3px 0 0 var(--sky); }
	nav a.pending { color: white; pointer-events: none; }
	:global(.pending-indicator) { margin-left: auto; animation: nav-spin .7s linear infinite; }
	@keyframes nav-spin { to { transform: rotate(360deg); } }
	.theme-control { margin-top: auto; }
	.sign-out { display: flex; width: 100%; align-items: center; gap: .65rem; padding: .72rem .8rem; border: 0; border-radius: .7rem; background: transparent; color: #9cb8cb; font-size: .74rem; font-weight: 700; cursor: pointer; }
	.sign-out:hover { background: rgba(255,255,255,.06); color: white; }
	.theme-control { display: flex; width: 100%; align-items: center; gap: .65rem; margin-bottom: .25rem; padding: .72rem .8rem; border: 0; border-radius: .7rem; background: transparent; color: #9cb8cb; font-size: .72rem; font-weight: 700; cursor: pointer; }
	.theme-control:hover { background: rgba(255,255,255,.06); color: white; }
	.collapse-control { display: grid; width: 1.9rem; height: 1.9rem; flex: 0 0 auto; place-items: center; margin-top: .48rem; border: 1px solid rgba(189,216,233,.15); border-radius: .55rem; background: rgba(255,255,255,.05); color: #a9c4d6; cursor: pointer; }
	.collapse-control:hover { color: white; background: rgba(255,255,255,.1); }
	.collapsed .sidebar { padding-inline: .75rem; }
	.collapsed .brand-row { display: block; }
	.collapsed .brand { justify-content: center; padding-inline: 0; }
	.collapsed .brand-copy, .collapsed nav p span, .collapsed nav a span, .collapsed .theme-control span, .collapsed .sign-out span { display: none; }
	.collapsed .collapse-control { margin: -.85rem auto 1rem; }
	.collapsed nav a, .collapsed .theme-control, .collapsed .sign-out { justify-content: center; padding-inline: .4rem; }
	.collapsed nav p { height: .25rem; margin: .25rem 0; }
	main { min-width: 0; padding: 0 clamp(1rem, 2.5vw, 2rem) 3rem; overflow-x: clip; }
	@media (max-width: 1399px) {
		.app-shell, .app-shell.collapsed { grid-template-columns: 1fr; }
		.mobile-header { position: sticky; z-index: 70; top: 0; display: flex; min-height: 4rem; box-sizing: border-box; align-items: center; justify-content: space-between; gap: 1rem; padding: .65rem clamp(1rem, 3vw, 1.5rem); border-bottom: 1px solid rgba(189,216,233,.17); background: var(--nav-surface); box-shadow: 0 .4rem 1.2rem rgba(0,29,57,.14); }
		.mobile-brand { display: flex; min-width: 0; align-items: center; gap: .65rem; color: white; text-decoration: none; }
		.mobile-brand > span { display: grid; width: 2.35rem; height: 2.35rem; flex: 0 0 auto; place-items: center; border-radius: .72rem; background: linear-gradient(145deg, var(--blue), var(--teal)); }
		.mobile-brand strong { overflow: hidden; font-size: .86rem; text-overflow: ellipsis; white-space: nowrap; }
		.mobile-brand small { display: block; margin-top: .08rem; color: var(--pale); font-size: .58rem; font-weight: 500; letter-spacing: .06em; text-transform: uppercase; }
		.mobile-header > button, .mobile-close { display: grid; width: 2.75rem; height: 2.75rem; flex: 0 0 auto; place-items: center; padding: 0; border: 1px solid rgba(189,216,233,.2); border-radius: .72rem; background: rgba(255,255,255,.07); color: white; cursor: pointer; }
		.sidebar { position: fixed; z-index: 100; top: 0; left: 0; width: min(20rem, 86vw); height: 100dvh; overflow-y: auto; transform: translateX(-105%); transition: transform .22s ease; box-shadow: var(--shadow-lg); }
		.sidebar.mobile-open { transform: translateX(0); }
		.mobile-backdrop { position: fixed; z-index: 90; inset: 0; display: block; width: 100%; height: 100%; padding: 0; border: 0; background: rgba(0,20,38,.56); cursor: pointer; }
		.collapse-control { display: none; }
		.mobile-close { margin-top: .15rem; }
		.collapsed .sidebar { padding: 1.35rem 1rem; }
		.collapsed .brand-row { display: flex; }
		.collapsed .brand { justify-content: flex-start; padding: .25rem .35rem 1.5rem; }
		.collapsed .brand-copy, .collapsed nav p span, .collapsed nav a span, .collapsed .theme-control span, .collapsed .sign-out span { display: block; }
		.collapsed nav a, .collapsed .theme-control, .collapsed .sign-out { justify-content: flex-start; padding-inline: .8rem; }
		nav { display: block; }
		nav a, .collapsed nav a { min-height: 2.75rem; box-sizing: border-box; }
		main { padding-top: .4rem; }
	}
	@media (max-width: 599px) {
		.mobile-header { min-height: 3.75rem; }
		.mobile-brand strong { font-size: .8rem; }
		main { padding-right: .75rem; padding-left: .75rem; }
	}
</style>
