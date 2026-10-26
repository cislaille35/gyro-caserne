<script lang="ts">
	import centre from '$centre';
	import GyroAccueil from '#lib/gyro/GyroAccueil.svelte';
	import { lireAffichageContexte } from '#lib/gyro/niveau.ts';

	let { data } = $props();

	const affichage = lireAffichageContexte();
	const phrase = $derived(
		affichage.niveau === 'vivant' ? 'Gyro a fait le plein de café.' : affichage.niveau === 'equilibre' ? 'Bienvenue sur Gyro Caserne.' : ''
	);
</script>

<svelte:head>
	<title>Accueil · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<GyroAccueil taille={96} />
	<div>
		<h1>{data.prenom ? `Bonjour ${data.prenom}` : 'Bonjour'}</h1>
		<p class="centre">{centre.nom}</p>
		{#if phrase}<p class="phrase">{phrase}</p>{/if}
	</div>
</div>

<style>
	.page {
		display: flex;
		align-items: center;
		gap: 16px;
		flex-wrap: wrap;
	}
	h1 {
		margin: 0;
	}
	p {
		margin: 4px 0 0;
	}
	.centre,
	.phrase {
		color: var(--doux);
	}
</style>
