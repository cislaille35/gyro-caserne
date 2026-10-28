<script lang="ts">
	import ListeReglages from './ListeReglages.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Réglages du centre · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<h1>Réglages du centre</h1>
	<p class="intro">Les rôles du centre rangés par thème, les comités et les profils. Touchez une ligne pour la régler.</p>
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
	.intro {
		color: var(--doux);
	}
</style>
