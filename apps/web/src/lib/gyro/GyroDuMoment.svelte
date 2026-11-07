<script lang="ts">
	import centre from '$centre';
	import Gyro from './Gyro.svelte';
	import { gyroSelonNiveau, lireAffichageContexte } from './niveau.ts';
	import { tenueDuMoment } from './moment.ts';
	import { DUREE_DECOR, arreterApres } from './mouvement.ts';
	import type { Tenue } from './tenues.ts';

	let {
		taille = 160,
		tenue,
		decoratif = false,
		duree = DUREE_DECOR,
		enMouvement = $bindable(true)
	}: { taille?: number; tenue?: Tenue; decoratif?: boolean; duree?: number; enMouvement?: boolean } = $props();

	const affichage = lireAffichageContexte();
	const reglage = $derived(gyroSelonNiveau(affichage.niveau));

	// Gyro bouge à l'arrivée, puis s'immobilise ; le parent peut le relancer ou l'arrêter.
	$effect(() => {
		if (enMouvement) return arreterApres(duree, () => (enMouvement = false));
	});
</script>

{#if reglage.visible}
	<Gyro tenue={tenue ?? tenueDuMoment(new Date(), null, centre.position)} {taille} anime={reglage.anime && enMouvement} {decoratif} />
{/if}
