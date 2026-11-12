<script lang="ts">
	import {
		AlertTriangle,
		BarChart3,
		Building2,
		CircleDollarSign,
		Gauge,
		LayoutDashboard,
		LogOut,
		Moon,
		PanelLeftClose,
		PanelLeftOpen,
		RadioTower,
		ShieldCheck,
		Sun,
		SunMedium,
		Users
	} from '@lucide/svelte';
	import { onMount, type Snippet } from 'svelte';

	type NavKey = 'dashboard' | 'energy' | 'revenue' | 'floors' | 'meters' | 'customers' | 'exceptions' | 'reports';
	let { active, children }: { active: NavKey; children: Snippet } = $props();
	let collapsed = $state(false);
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
		{ key: 'dashboard' as const, href: '/', label: 'Command centre', icon: LayoutDashboard },
		{ key: 'energy' as const, href: '/energy-mix', label: 'Energy mix', icon: SunMedium },
		{ key: 'revenue' as const, href: '/revenue-costs', label: 'Revenue & cost', icon: CircleDollarSign },
		{ key: 'floors' as const, href: '/floors', label: 'Floor operations', icon: Building2 },
		{ key: 'meters' as const, href: '/meters', label: 'Meter operations', icon: Gauge },
		{ key: 'customers' as const, href: '/customers', label: 'Customer accounts', icon: Users },
		{ key: 'exceptions' as const, href: '/exceptions', label: 'Exceptions', icon: AlertTriangle },
		{ key: 'reports' as const, href: '/reports', label: 'Reports & analytics', icon: BarChart3 }
	];
</script>

<div class="app-shell" class:collapsed>
	<aside class="sidebar">
		<div class="brand-row">
			<a class="brand" href="/" aria-label="MicroAccess Smart Metering home" title={collapsed ? 'MicroAccess Smart Metering' : undefined}>
				<span class="brand-mark"><RadioTower size={22} strokeWidth={1.8} /></span>
				<span class="brand-copy"><strong>MicroAccess</strong><small>Smart Metering</small></span>
			</a>
			<button class="collapse-control" type="button" onclick={toggleSidebar} aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'} title={collapsed ? 'Expand navigation' : 'Collapse navigation'}>
				{#if collapsed}<PanelLeftOpen size={17} />{:else}<PanelLeftClose size={17} />{/if}
			</button>
		</div>

		<nav aria-label="Primary navigation">
			<p><span>Workspace</span></p>
			{#each links as link (link.key)}
				<a class:active={active === link.key} href={link.href} aria-current={active === link.key ? 'page' : undefined} title={collapsed ? link.label : undefined}>
					<link.icon size={17} /><span>{link.label}</span>
				</a>
			{/each}
		</nav>

		<div class="phase-card">
			<span><ShieldCheck size={16} /> Phase 1</span>
			<div class="phase-copy"><strong>Read-only operations</strong>
			<p>Inventory, history and reporting are live. Payment, credit and remote commands remain disabled.</p></div>
		</div>

		<button class="theme-control" type="button" onclick={toggleTheme} aria-label={theme === 'dark' ? 'Use light mode' : 'Use dark mode'} title={theme === 'dark' ? 'Use light mode' : 'Use dark mode'}>
			{#if theme === 'dark'}<Sun size={16} />{:else}<Moon size={16} />{/if}<span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
		</button>

		<form method="POST" action="/logout">
			<button class="sign-out" type="submit" title={collapsed ? 'Sign out' : undefined}><LogOut size={16} /><span>Sign out</span></button>
		</form>
	</aside>
	<main>{@render children()}</main>
</div>

<style>
	.app-shell { display: grid; min-height: 100vh; grid-template-columns: 15.5rem minmax(0, 1fr); transition: grid-template-columns .2s ease; }
	.app-shell.collapsed { grid-template-columns: 4.7rem minmax(0, 1fr); }
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
	.phase-card { margin: auto 0 1rem; padding: .9rem; border: 1px solid rgba(189, 216, 233, .14); border-radius: .85rem; background: rgba(10, 65, 116, .42); }
	.phase-card > span { display: flex; align-items: center; gap: .38rem; color: var(--sky); font-size: .65rem; font-weight: 800; text-transform: uppercase; }
	.phase-card strong { display: block; margin-top: .55rem; font-size: .76rem; }
	.phase-card p { margin: .45rem 0 0; color: #9cb8cb; font-size: .64rem; line-height: 1.5; }
	.sign-out { display: flex; width: 100%; align-items: center; gap: .65rem; padding: .72rem .8rem; border: 0; border-radius: .7rem; background: transparent; color: #9cb8cb; font-size: .74rem; font-weight: 700; cursor: pointer; }
	.sign-out:hover { background: rgba(255,255,255,.06); color: white; }
	.theme-control { display: flex; width: 100%; align-items: center; gap: .65rem; margin-bottom: .25rem; padding: .72rem .8rem; border: 0; border-radius: .7rem; background: transparent; color: #9cb8cb; font-size: .72rem; font-weight: 700; cursor: pointer; }
	.theme-control:hover { background: rgba(255,255,255,.06); color: white; }
	.collapse-control { display: grid; width: 1.9rem; height: 1.9rem; flex: 0 0 auto; place-items: center; margin-top: .48rem; border: 1px solid rgba(189,216,233,.15); border-radius: .55rem; background: rgba(255,255,255,.05); color: #a9c4d6; cursor: pointer; }
	.collapse-control:hover { color: white; background: rgba(255,255,255,.1); }
	.collapsed .sidebar { padding-inline: .75rem; }
	.collapsed .brand-row { display: block; }
	.collapsed .brand { justify-content: center; padding-inline: 0; }
	.collapsed .brand-copy, .collapsed nav p span, .collapsed nav a span, .collapsed .phase-copy, .collapsed .theme-control span, .collapsed .sign-out span { display: none; }
	.collapsed .collapse-control { margin: -.85rem auto 1rem; }
	.collapsed nav a, .collapsed .theme-control, .collapsed .sign-out { justify-content: center; padding-inline: .4rem; }
	.collapsed nav p { height: .25rem; margin: .25rem 0; }
	.collapsed .phase-card { display: grid; padding: .7rem .4rem; place-items: center; }
	.collapsed .phase-card > span { font-size: 0; }
	main { min-width: 0; padding: 0 clamp(1rem, 2.5vw, 2rem) 3rem; overflow: hidden; }
	@media (max-width: 900px) {
		.app-shell, .app-shell.collapsed { grid-template-columns: 1fr; }
		.sidebar { position: static; height: auto; }
		.collapse-control { display: none; }
		.collapsed .sidebar { padding: 1.35rem 1rem; }
		.collapsed .brand-row { display: flex; }
		.collapsed .brand { justify-content: flex-start; padding: .25rem .35rem 1.5rem; }
		.collapsed .brand-copy, .collapsed nav p span, .collapsed nav a span, .collapsed .phase-copy, .collapsed .theme-control span, .collapsed .sign-out span { display: block; }
		.collapsed nav a, .collapsed .theme-control, .collapsed .sign-out { justify-content: flex-start; padding-inline: .8rem; }
		.collapsed .phase-card { display: block; padding: .9rem; }
		.collapsed .phase-card > span { font-size: .65rem; }
		nav { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
		nav p { grid-column: 1 / -1; }
		.phase-card { margin-top: 1rem; }
	}
</style>
