<script lang="ts">
	import Bouton from '#lib/ui/Bouton.svelte';
	import Champ from '#lib/ui/Champ.svelte';
	import GyroDuMoment from '#lib/gyro/GyroDuMoment.svelte';

	let { form } = $props();
</script>

<svelte:head>
	<title>Connexion · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<GyroDuMoment tenue="bienvenue" taille={120} decoratif />
	<h1>Connexion</h1>
	{#if form?.envoye}
		<div class="carte" role="status">
			<p class="titre">Regardez vos courriels</p>
			<p>
				Si cette adresse est autorisée, un lien vient de partir{#if form.email}{' '}vers <strong class="adresse">{form.email}</strong>{/if}. Pensez à regarder dans vos courriers indésirables.
			</p>
		</div>
		<a class="changer" href="/connexion">Changer d’adresse</a>
	{:else}
		<p class="phrase">Pas de mot de passe : recevez un lien de connexion par courriel.</p>
		<form method="post" class="carte">
			<Champ id="email" name="email" type="email" libelle="Adresse e-mail" autocomplete="email" requis />
			<Bouton type="submit">Recevoir un lien de connexion</Bouton>
		</form>
	{/if}
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
		max-width: 26rem;
		margin: 0 auto;
		padding-top: 1rem;
		text-align: center;
	}
	h1 {
		margin: 0;
		font: 700 2rem/1.1 var(--police-titre);
	}
	p {
		margin: 0;
	}
	.phrase {
		color: var(--doux);
	}
	.carte {
		align-self: stretch;
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 20px;
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
		border-radius: var(--rayon-grand);
		background: var(--surface);
		text-align: left;
	}
	.carte :global(button) {
		width: 100%;
	}
	div.carte {
		gap: 6px;
	}
	.titre {
		font: 700 1.25rem var(--police-titre);
	}
	.adresse {
		overflow-wrap: anywhere;
	}
	.changer {
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		padding: 0 12px;
		color: var(--encre);
		font-weight: 600;
	}
</style>
