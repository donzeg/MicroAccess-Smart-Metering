<script lang="ts">
	import { LockKeyhole, RadioTower, ShieldCheck } from '@lucide/svelte';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<svelte:head>
	<title>Sign in | MicroAccess Smart Metering</title>
	<meta name="description" content="Secure staff access to MicroAccess Smart Metering operations." />
</svelte:head>

<main class="login-shell">
	<section class="brand-panel">
		<div class="brand">
			<div class="brand-mark"><RadioTower size={25} strokeWidth={1.8} /></div>
			<div><strong>MicroAccess</strong><span>Smart Metering</span></div>
		</div>
		<div class="brand-copy">
			<p class="eyebrow">Operations intelligence</p>
			<h1>Every meter, interpreted for action.</h1>
			<p>Monitor estate readiness, communication freshness, assignments and exceptions from one secure workspace.</p>
		</div>
		<div class="security-note"><ShieldCheck size={19} /><span>SteamaCo credentials remain on the MSM server and are never sent to this browser.</span></div>
	</section>

	<section class="form-panel">
		<form method="POST">
			<div class="form-icon"><LockKeyhole size={23} /></div>
			<p class="eyebrow">Staff access</p>
			<h2>Welcome back</h2>
			<p class="intro">Use your MicroAccess operations account to continue.</p>

			{#if form?.message}
				<div class="error" role="alert">{form.message}</div>
			{/if}

			<label>
				<span>Username</span>
				<input name="username" autocomplete="username" value={form?.username ?? ''} required />
			</label>
			<label>
				<span>Password</span>
				<input name="password" type="password" autocomplete="current-password" required />
			</label>
			<button type="submit">Sign in securely</button>
			<small>Customer self-service and payment functions remain disabled during the current read-only phase.</small>
		</form>
	</section>
</main>

<style>
	.login-shell {
		display: grid;
		min-height: 100vh;
		grid-template-columns: minmax(22rem, 1.05fr) minmax(24rem, 0.95fr);
		background: var(--surface);
	}

	.brand-panel {
		display: flex;
		min-height: 100vh;
		flex-direction: column;
		justify-content: space-between;
		padding: clamp(2rem, 5vw, 5rem);
		background:
			radial-gradient(circle at 78% 18%, rgba(123, 189, 232, 0.38), transparent 34%),
			linear-gradient(145deg, var(--navy) 0%, #062f56 58%, var(--blue) 100%);
		color: white;
	}

	.brand { display: flex; align-items: center; gap: 0.8rem; }
	.brand-mark { display: grid; width: 2.8rem; height: 2.8rem; place-items: center; border-radius: 0.85rem; background: rgba(255,255,255,.12); color: var(--sky); }
	.brand strong, .brand span { display: block; }
	.brand strong { font-size: 1rem; }
	.brand span { margin-top: .1rem; color: var(--pale); font-size: .72rem; letter-spacing: .06em; text-transform: uppercase; }
	.brand-copy { max-width: 38rem; }
	.eyebrow { margin: 0 0 .75rem; color: var(--sky); font-size: .72rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
	h1 { max-width: 34rem; margin: 0; font-size: clamp(2.4rem, 5vw, 4.8rem); letter-spacing: -.05em; line-height: .98; }
	.brand-copy > p:last-child { max-width: 34rem; margin: 1.4rem 0 0; color: var(--pale); font-size: 1rem; line-height: 1.75; }
	.security-note { display: flex; max-width: 35rem; align-items: flex-start; gap: .7rem; color: var(--pale); font-size: .78rem; line-height: 1.5; }
	.security-note :global(svg) { flex: 0 0 auto; color: var(--sky); }

	.form-panel { display: grid; place-items: center; padding: 2rem; background: var(--canvas); }
	form { width: min(100%, 27rem); padding: clamp(1.8rem, 4vw, 2.8rem); border: 1px solid var(--line); border-radius: 1.5rem; background: var(--surface); box-shadow: var(--shadow-lg); }
	.form-icon { display: grid; width: 3rem; height: 3rem; margin-bottom: 1.4rem; place-items: center; border-radius: .9rem; background: var(--pale-blue); color: var(--blue); }
	form .eyebrow { color: var(--blue); }
	h2 { margin: 0; color: var(--navy); font-size: 2rem; letter-spacing: -.04em; }
	.intro { margin: .55rem 0 1.6rem; color: var(--text-muted); font-size: .88rem; }
	label { display: grid; gap: .45rem; margin-top: 1rem; color: var(--navy); font-size: .78rem; font-weight: 750; }
	input { width: 100%; box-sizing: border-box; padding: .82rem .9rem; border: 1px solid var(--line); border-radius: .72rem; background: var(--surface-soft); color: var(--navy); font: inherit; outline: none; }
	input:focus { border-color: var(--sky); box-shadow: 0 0 0 3px rgba(123, 189, 232, .22); }
	button { width: 100%; margin-top: 1.45rem; padding: .9rem 1rem; border: 0; border-radius: .75rem; background: var(--action); color: white; font: inherit; font-size: .84rem; font-weight: 800; cursor: pointer; }
	button:hover { background: var(--navy); }
	small { display: block; margin-top: 1rem; color: var(--text-muted); font-size: .69rem; line-height: 1.5; text-align: center; }
	.error { margin: 0 0 1rem; padding: .72rem .8rem; border: 1px solid #f4c8ca; border-radius: .7rem; background: #fff1f2; color: #a52a32; font-size: .78rem; }

	@media (max-width: 800px) {
		.login-shell { grid-template-columns: 1fr; }
		.brand-panel { min-height: auto; gap: 4rem; padding: 2rem; }
		.form-panel { min-height: 60vh; }
	}
</style>
