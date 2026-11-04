<script lang="ts">
	import { page } from '$app/state';
	import ReessaiCoupure from '#lib/attente/ReessaiCoupure.svelte';
	import { MESSAGE_COUPURE } from '#lib/attente/attente.ts';

	// Le statut n'est jamais montré : SvelteKit le laisse à 200 quand le rechargement qui suit un geste échoue.
	// Nos messages sont en français ; ceux de la plateforme (panne, limite du serveur) deviennent une phrase simple.
	const MESSAGES_TECHNIQUES = ['Internal Error', 'Not Found', 'Service Unavailable', 'Bad Gateway', 'Gateway Timeout'];
	const coupure = $derived(page.error?.message === MESSAGE_COUPURE);
	const message = $derived.by(() => {
		const brut = page.error?.message ?? '';
		if (brut === 'Not Found') return 'Cette page n’existe pas.';
		return brut && !MESSAGES_TECHNIQUES.includes(brut) ? brut : 'Le serveur n’a pas pu répondre. Réessayez dans un instant.';
	});
</script>

<svelte:head>
	<title>Page indisponible · Gyro Caserne</title>
</svelte:head>

<div class="erreur" class:coupure role={coupure ? 'status' : 'alert'}>
	{#if coupure}
		<ReessaiCoupure />
		<h1>Un instant, ça arrive…</h1>
		<p>Le serveur reprend dans quelques secondes. La page va se recharger toute seule.</p>
	{:else}
		<h1>Page indisponible</h1>
		<p>{message}</p>
	{/if}
	<p class="sorties"><a href={page.url.pathname + page.url.search} data-sveltekit-reload>Réessayer</a> <a href="/">Retour à l’accueil</a></p>
</div>

<style>
	.erreur {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 16px;
		background: var(--statut-alerte-fond);
		border: 1px solid var(--statut-alerte-trait);
		border-radius: var(--rayon-grand);
		color: var(--statut-alerte-texte);
	}
	.coupure {
		background: var(--surface);
		border-color: var(--trait-doux);
		color: var(--encre);
	}
	h1,
	p {
		margin: 0;
	}
	h1 {
		font: 700 1.5rem/1.2 var(--police-titre);
	}
	.sorties {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
	}
	a {
		display: inline-flex;
		align-items: center;
		min-height: var(--cible);
		color: inherit;
		font-weight: 600;
	}
</style>
