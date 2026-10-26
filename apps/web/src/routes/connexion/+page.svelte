<script lang="ts">
	import Bouton from '#lib/ui/Bouton.svelte';
	import Champ from '#lib/ui/Champ.svelte';
	import Carte from '#lib/ui/Carte.svelte';
	import GyroDuMoment from '#lib/gyro/GyroDuMoment.svelte';

	let { form } = $props();
</script>

<svelte:head>
	<title>Connexion · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<GyroDuMoment tenue="bienvenue" taille={120} decoratif />
	<h1>Connexion</h1>
	<Carte titre="Recevoir un lien">
		{#if form?.envoye}
			<p role="status">Si cette adresse est autorisée, un lien vient de partir. Pensez à regarder dans vos courriers indésirables.</p>
		{:else}
			<form method="post">
				<Champ id="email" name="email" type="email" libelle="Adresse e-mail" autocomplete="email" />
				<Bouton type="submit">Recevoir un lien de connexion</Bouton>
			</form>
		{/if}
	</Carte>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
		max-width: 28rem;
		margin: 0 auto;
	}
	h1 {
		margin: 0;
	}
	.page :global(section) {
		width: 100%;
		box-sizing: border-box;
	}
	form {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	p {
		margin: 0;
	}
</style>
