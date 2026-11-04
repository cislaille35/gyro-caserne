<script lang="ts">
	import type { Ambiance } from '@gyro-caserne/socle';

	// L'ambiance de l'Accueil selon le temps au centre : décorative, discrète, immobile si « réduire les animations ». Reprise du MVP.
	let { ambiance, nuit = false }: { ambiance: Ambiance; nuit?: boolean } = $props();

	// Positions fixes (pas d'aléatoire : même rendu côté serveur et navigateur)
	const gouttes = [6, 14, 23, 31, 40, 48, 57, 63, 71, 79, 86, 93];
	const flocons = [5, 15, 26, 37, 46, 55, 66, 74, 83, 92];
	const feuilles = [18, 42, 66, 30, 78];
</script>

<div class="meteo m-{ambiance}" aria-hidden="true">
	{#if ambiance === 'pluie' || ambiance === 'orage'}
		{#each gouttes as x, i (i)}
			<span class="goutte" style="left:{x}%; animation-delay:{(i * 0.37) % 1.6}s; animation-duration:{0.9 + (i % 3) * 0.2}s"></span>
		{/each}
		{#if ambiance === 'orage'}<span class="eclair"></span>{/if}
	{:else if ambiance === 'neige' || ambiance === 'gel'}
		{#each ambiance === 'neige' ? flocons : flocons.slice(0, 5) as x, i (i)}
			<span class="flocon" style="left:{x}%; animation-delay:{(i * 0.9) % 4}s; animation-duration:{4 + (i % 4)}s"></span>
		{/each}
		{#if ambiance === 'gel'}<span class="givre"></span>{/if}
	{:else if ambiance === 'vent'}
		{#each feuilles as y, i (i)}
			<span class="feuille" style="top:{y}%; animation-delay:{i * 0.8}s"></span>
		{/each}
		{#each [25, 55, 80] as y, i (i)}
			<span class="rafale" style="top:{y}%; animation-delay:{i * 0.6}s"></span>
		{/each}
	{:else if ambiance === 'brouillard'}
		<span class="brume b1"></span>
		<span class="brume b2"></span>
	{:else if ambiance === 'chaleur'}
		{#if !nuit}<span class="soleil"></span>{/if}
		<span class="chaleur"></span>
	{:else if ambiance === 'clair' && !nuit}
		<span class="soleil petit"></span>
	{/if}
</div>

<style>
	.meteo {
		position: absolute;
		inset: 0;
		pointer-events: none;
		overflow: hidden;
		z-index: 0;
		opacity: 0.6;
	}
	/* Pluie */
	.goutte {
		position: absolute;
		top: -20%;
		width: 2px;
		height: 14px;
		border-radius: 2px;
		background: color-mix(in srgb, var(--encre) 45%, transparent);
		animation: tombe 1s linear infinite;
	}
	@keyframes tombe {
		to {
			transform: translate(-10px, 160px);
			opacity: 0.2;
		}
	}
	.eclair {
		position: absolute;
		inset: 0;
		background: #fff;
		opacity: 0;
		animation: eclair 7s ease-out infinite 1s;
	}
	@keyframes eclair {
		0%,
		88%,
		100% {
			opacity: 0;
		}
		90% {
			opacity: 0.35;
		}
		94% {
			opacity: 0;
		}
	}
	/* Neige et gel */
	.flocon {
		position: absolute;
		top: -10%;
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #fff;
		box-shadow: 0 0 2px rgba(20, 27, 36, 0.35);
		animation: neige 5s linear infinite;
	}
	@keyframes neige {
		50% {
			transform: translate(8px, 70px);
		}
		to {
			transform: translate(-4px, 150px);
			opacity: 0.4;
		}
	}
	.givre {
		position: absolute;
		inset: 0;
		background: radial-gradient(ellipse at 0 0, rgba(255, 255, 255, 0.35), transparent 40%),
			radial-gradient(ellipse at 100% 100%, rgba(255, 255, 255, 0.25), transparent 35%);
	}
	/* Vent */
	.feuille {
		position: absolute;
		left: -10%;
		width: 10px;
		height: 6px;
		border-radius: 0 6px 0 6px;
		background: #8a6a2f;
		animation: souffle 3.2s ease-in infinite;
	}
	.feuille:nth-child(odd) {
		background: #62ad3f;
	}
	@keyframes souffle {
		to {
			transform: translate(100vw, -24px) rotate(540deg);
		}
	}
	.rafale {
		position: absolute;
		left: -30%;
		width: 30%;
		height: 2px;
		border-radius: 2px;
		background: color-mix(in srgb, var(--encre) 30%, transparent);
		animation: rafale 1.8s ease-in infinite;
	}
	@keyframes rafale {
		to {
			transform: translateX(420%);
			opacity: 0;
		}
	}
	/* Brouillard */
	.brume {
		position: absolute;
		left: -50%;
		width: 200%;
		height: 45%;
		background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.35), transparent 60%);
		filter: blur(6px);
		animation: brume 14s ease-in-out infinite alternate;
	}
	.b1 {
		top: 10%;
	}
	.b2 {
		top: 55%;
		animation-delay: 3s;
		opacity: 0.8;
	}
	@keyframes brume {
		to {
			transform: translateX(25%);
		}
	}
	/* Chaleur et beau temps */
	.soleil {
		position: absolute;
		right: 34px;
		top: -26px;
		width: 70px;
		height: 70px;
		border-radius: 50%;
		background: radial-gradient(circle, rgba(255, 214, 0, 0.9) 35%, rgba(255, 214, 0, 0) 70%);
		animation: rayonne 3s ease-in-out infinite alternate;
	}
	.soleil.petit {
		width: 46px;
		height: 46px;
		top: -16px;
		opacity: 0.7;
	}
	@keyframes rayonne {
		to {
			transform: scale(1.18);
		}
	}
	.chaleur {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 30%;
		background: repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.18) 0 6px, transparent 6px 14px);
		filter: blur(2px);
		animation: ondule 1.6s ease-in-out infinite alternate;
	}
	@keyframes ondule {
		to {
			transform: translateX(6px) skewX(6deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.meteo * {
			animation: none !important;
		}
		.goutte,
		.flocon,
		.feuille,
		.rafale,
		.eclair,
		.chaleur {
			display: none;
		}
	}
</style>
