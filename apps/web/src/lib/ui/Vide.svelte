<script lang="ts">
	import Gyro from '../gyro/Gyro.svelte';
	import { DUREE_DECOR, arreterApres } from '../gyro/mouvement.ts';
	import { gyroSelonNiveau, lireAffichageContexte } from '../gyro/niveau.ts';

	let { texte }: { texte: string } = $props();

	const affichage = lireAffichageContexte();
	const reglage = $derived(gyroSelonNiveau(affichage.niveau));
	let enMouvement = $state(true);
	$effect(() => {
		if (enMouvement) return arreterApres(DUREE_DECOR, () => (enMouvement = false));
	});
</script>

<div class="vide">
	{#if reglage.visible}
		<Gyro tenue="vide" taille={120} anime={reglage.anime && enMouvement} decoratif />
	{/if}
	<p>{texte}</p>
</div>

<style>
	.vide {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		padding: 2rem 1rem;
		text-align: center;
	}
	p {
		margin: 0;
	}
</style>
