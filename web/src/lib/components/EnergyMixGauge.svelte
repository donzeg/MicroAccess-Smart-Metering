<script lang="ts">
	let {
		solarPercent,
		minimum = 90,
		maximum = 95,
		label = 'Solar share',
		comparison = 'matched energy',
		compact = false
	}: {
		solarPercent: number;
		minimum?: number;
		maximum?: number;
		label?: string;
		comparison?: string;
		compact?: boolean;
	} = $props();
	let bounded = $derived(Math.min(100, Math.max(0, solarPercent)));
</script>

<div class:compact class="gauge-wrap">
	<div
		class="gauge"
		style={`--solar-angle: ${bounded * 3.6}deg`}
		role="img"
		aria-label={`Solar supplied ${bounded.toFixed(1)} percent of ${comparison}. Target is ${minimum} to ${maximum} percent.`}
	>
		<div class="centre">
			<strong>{bounded.toFixed(1)}%</strong>
			<span>{label}</span>
		</div>
	</div>
	<div class="target-scale" aria-hidden="true">
		<div class="target-zone" style={`left: ${minimum}%; width: ${maximum - minimum}%`}></div>
		<div class="actual" style={`left: ${bounded}%`}></div>
	</div>
	<div class="target-caption"><span>0%</span><strong>Target {minimum}–{maximum}%</strong><span>100%</span></div>
</div>

<style>
	.gauge-wrap { width: min(13rem, 72vw); }
	.gauge { display: grid; width: 100%; aspect-ratio: 1; place-items: center; border-radius: 50%; background: conic-gradient(var(--teal) 0 var(--solar-angle), var(--navy) var(--solar-angle) 360deg); box-shadow: inset 0 0 0 .1rem rgba(255,255,255,.15), 0 1rem 2.4rem rgba(0,29,57,.14); }
	.centre { display: grid; width: 68%; aspect-ratio: 1; place-content: center; border: .45rem solid rgba(255,255,255,.22); border-radius: 50%; background: var(--surface); text-align: center; box-shadow: 0 .45rem 1.4rem rgba(0,29,57,.13); }
	.centre strong { color: var(--navy); font-size: clamp(1.8rem, 5vw, 2.75rem); letter-spacing: -.05em; }
	.centre span { color: var(--text-muted); font-size: .68rem; font-weight: 750; }
	.target-scale { position: relative; width: 100%; height: .42rem; margin-top: 1.15rem; border-radius: 999px; background: var(--line); }
	.target-zone { position: absolute; top: 0; height: 100%; border-radius: inherit; background: #35a46f; }
	.actual { position: absolute; top: 50%; width: .76rem; height: .76rem; transform: translate(-50%, -50%); border: 2px solid white; border-radius: 50%; background: var(--navy); box-shadow: 0 0 0 1px var(--navy); }
	.target-caption { display: flex; width: 100%; justify-content: space-between; margin-top: .42rem; color: var(--text-muted); font-size: .55rem; }
	.target-caption strong { color: #24724f; }
	.gauge-wrap.compact { width: min(7.6rem, 38vw); }
	.compact .centre { border-width: .28rem; }
	.compact .centre strong { font-size: 1.38rem; }
	.compact .centre span { max-width: 4.5rem; font-size: .48rem; line-height: 1.2; }
	.compact .target-scale { height: .3rem; margin-top: .7rem; }
	.compact .actual { width: .58rem; height: .58rem; }
	.compact .target-caption { font-size: .43rem; }
</style>
