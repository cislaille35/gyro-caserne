<script lang="ts">
	import ListeReglages from './ListeReglages.svelte';

	let { data } = $props();

	const MO = 1024 * 1024;
	// Sous 10 Mo, une décimale (« 2,3 Mo ») ; au-delà, des Mo entiers.
	const enMo = (octets: number) => (octets < 10 * MO ? (octets / MO).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) : String(Math.round(octets / MO)));
</script>

<svelte:head>
	<title>Réglages du centre · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<h1>Réglages du centre</h1>
	<p class="intro">Les rôles du centre rangés par thème, les comités et les profils. Touchez une ligne pour la régler.</p>
	{#if data.photos}
		<p class="jauge">Photos : {enMo(data.photos.octets)} Mo sur {enMo(data.photos.limite)} Mo</p>
		{#if data.photos.alerte}
			<p class="alerte">La base des photos est presque pleine : il faudra choisir entre l’offre payante (5 $/mois) ou un stockage R2.</p>
		{/if}
	{/if}
	<ListeReglages {data} />
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 12px;
		max-width: 44rem;
	}
	h1,
	.intro {
		margin: 0;
	}
	.intro,
	.jauge {
		color: var(--doux);
	}
	.jauge,
	.alerte {
		margin: 0;
	}
	.alerte {
		padding: 12px 16px;
		border: 1px solid var(--statut-alerte-trait);
		border-radius: var(--rayon-grand);
		background: var(--statut-alerte-fond);
		color: var(--statut-alerte-texte);
	}
</style>
