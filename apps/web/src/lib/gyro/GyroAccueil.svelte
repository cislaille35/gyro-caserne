<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import GyroDuMoment from './GyroDuMoment.svelte';
	import { cinqTouches } from './cinqTouches.ts';
	import { DUREE_ACCUEIL } from './mouvement.ts';
	import { gyroSelonNiveau, lireAffichageContexte } from './niveau.ts';

	let { taille = 160 }: { taille?: number } = $props();

	const affichage = lireAffichageContexte();
	let appuis: number[] = [];
	let surprise = $state(false);
	let pret = $state(false);
	let enMouvement = $state(true);
	let minuteur: ReturnType<typeof setTimeout> | undefined;

	function appuyer() {
		const maintenant = Date.now();
		appuis = [...appuis.filter((t) => maintenant - t <= 2000), maintenant];
		if (cinqTouches(appuis, maintenant)) {
			appuis = [];
			surprise = true;
			enMouvement = true;
			clearTimeout(minuteur);
			minuteur = setTimeout(() => (surprise = false), 3000);
		} else {
			enMouvement = !enMouvement;
		}
	}

	onMount(() => (pret = true));
	onDestroy(() => clearTimeout(minuteur));
</script>

{#if gyroSelonNiveau(affichage.niveau).visible}
	<div class="accueil" data-pret={pret || undefined}>
		<button type="button" aria-label="Faire réagir Gyro" onclick={appuyer}>
			<GyroDuMoment {taille} decoratif duree={DUREE_ACCUEIL} bind:enMouvement tenue={surprise ? 'chargement' : undefined} />
		</button>
		<p class="pinpon" aria-live="polite">{surprise ? 'pin-pon !' : ''}</p>
	</div>
{/if}

<style>
	.accueil {
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	button {
		min-width: 44px;
		min-height: 44px;
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
		border-radius: 1rem;
	}
	.pinpon {
		margin: 0.25rem 0 0;
		min-height: 1.5em;
		font-weight: 700;
	}
</style>
