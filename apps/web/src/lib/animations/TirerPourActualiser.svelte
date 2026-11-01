<script lang="ts" module>
	// Plusieurs écrans peuvent se croiser pendant une navigation : on compte ceux qui sont montés.
	let montes = 0;
</script>

<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import { lireAffichageContexte } from '../gyro/niveau.ts';
	import { SEUIL, calme, consigne, declenche, forceDuJet, peutTirer, tirage as tirageDe } from './tirage.ts';

	// Tirer la page vers le bas pour la relire : la lance arrose de plus en plus fort.
	// Au doigt seulement ; jamais sur un écran d'urgence. Sans geste, recharger la page suffit : rien n'est donc annoncé.
	// « Réduire les animations » ou l'affichage sobre : une simple consigne, sans lance ni mouvement.
	const affichage = lireAffichageContexte();
	let tirage = $state(0);
	let actualise = $state(false);
	let simple = $state(false);

	const dansUnChamp = (cible: EventTarget | null) =>
		cible instanceof Element && cible.closest('input, textarea, select, [contenteditable], dialog') !== null;

	onMount(() => {
		let depart: { x: number; y: number } | null = null;
		const debut = (e: TouchEvent) => {
			const ok = peutTirer({ defile: window.scrollY, actualise, doigts: e.touches.length, dansUnChamp: dansUnChamp(e.target) });
			depart = ok ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
			simple = calme(affichage.niveau, matchMedia('(prefers-reduced-motion: reduce)').matches);
		};
		const bouge = (e: TouchEvent) => {
			if (depart === null) return;
			tirage = window.scrollY <= 0 ? tirageDe(e.touches[0].clientX - depart.x, e.touches[0].clientY - depart.y) : 0;
		};
		const fin = async () => {
			if (depart === null) return;
			depart = null;
			if (declenche(tirage)) {
				actualise = true;
				tirage = SEUIL;
				try {
					await Promise.all([invalidateAll(), new Promise((r) => setTimeout(r, simple ? 0 : 900))]);
				} finally {
					actualise = false;
				}
			}
			tirage = 0;
		};
		// Le navigateur ne tire pas la page en même temps (Chrome sur Android).
		montes++;
		document.documentElement.style.overscrollBehaviorY = 'contain';
		window.addEventListener('touchstart', debut, { passive: true });
		window.addEventListener('touchmove', bouge, { passive: true });
		window.addEventListener('touchend', fin);
		window.addEventListener('touchcancel', fin);
		return () => {
			if (--montes === 0) document.documentElement.style.overscrollBehaviorY = '';
			window.removeEventListener('touchstart', debut);
			window.removeEventListener('touchmove', bouge);
			window.removeEventListener('touchend', fin);
			window.removeEventListener('touchcancel', fin);
		};
	});

	const jet = $derived(forceDuJet(tirage));
</script>

{#if tirage > 4 || actualise}
	<div class="tirer" class:simple style:height={simple ? undefined : `${tirage}px`} aria-hidden="true">
		{#if !simple}
			<svg viewBox="0 0 200 60" width="200" height="60">
				<g transform="translate(16 22)">
					<rect x="0" y="4" width="34" height="12" rx="4" class="lance" />
					<rect x="30" y="2" width="10" height="16" rx="3" class="embout" />
					<rect x="8" y="16" width="8" height="12" rx="2" class="poignee" />
				</g>
				<g class:jet-actif={actualise}>
					<path
						d="M58 32 Q {58 + 70 * jet} {32 - 18 * jet} {58 + 130 * jet} {34 + 6 * jet}"
						class="eau"
						fill="none"
						stroke-width={2 + 4 * jet}
						stroke-linecap="round"
						opacity={0.35 + 0.65 * jet}
					/>
					{#if jet >= 1}
						<circle class="goutte g1" cx="170" cy="40" r="2.5" />
						<circle class="goutte g2" cx="182" cy="38" r="2" />
						<circle class="goutte g3" cx="176" cy="44" r="2" />
					{/if}
				</g>
			</svg>
		{/if}
		<span class="consigne">{consigne(tirage, actualise)}</span>
	</div>
{/if}

<style>
	.tirer {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-end;
		overflow: hidden;
		max-height: 120px;
		margin: -0.5rem 0 0.5rem;
		transition: height 0.2s ease;
	}
	.tirer.simple {
		justify-content: center;
		min-height: var(--cible);
		transition: none;
	}
	.consigne {
		padding-bottom: 6px;
		color: var(--doux);
		font-size: 0.875rem;
		font-weight: 600;
	}
	.lance {
		fill: var(--trait);
	}
	.embout {
		fill: var(--doux);
	}
	.poignee {
		fill: var(--rouge);
	}
	.eau,
	.goutte {
		stroke: var(--statut-info-texte);
	}
	.goutte {
		fill: var(--statut-info-texte);
		stroke: none;
		animation: eclabousse 0.6s ease-out infinite;
	}
	.g2 {
		animation-delay: 0.2s;
	}
	.g3 {
		animation-delay: 0.4s;
	}
	.jet-actif {
		animation: pulse 0.3s ease-in-out infinite alternate;
	}
	@keyframes pulse {
		to {
			translate: 0 -2px;
		}
	}
	@keyframes eclabousse {
		to {
			translate: 8px 10px;
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.tirer,
		.tirer * {
			animation: none !important;
			transition: none !important;
		}
	}
</style>
