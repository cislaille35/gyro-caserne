<script lang="ts">
	import Bouton from '#lib/ui/Bouton.svelte';
	import Champ from '#lib/ui/Champ.svelte';
	import centre from '$centre';
	import GyroDuMoment from '#lib/gyro/GyroDuMoment.svelte';

	let { data, form } = $props();

	// Un courriel par minute : « Renvoyer l’e-mail » attend la fin de la minute, compte à rebours à l'appui.
	let ecoule = $state(0);
	const restant = $derived(Math.max(0, (form?.renvoiDans ?? 0) - ecoule));
	$effect(() => {
		const depart = Date.now();
		const total = form?.renvoiDans ?? 0;
		ecoule = 0;
		if (total <= 0) return;
		const minuteur = setInterval(() => {
			ecoule = Math.floor((Date.now() - depart) / 1000);
			if (ecoule >= total) clearInterval(minuteur);
		}, 1000);
		return () => clearInterval(minuteur);
	});
</script>

<svelte:head>
	<title>Connexion · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<GyroDuMoment tenue="bienvenue" taille={120} decoratif />
	{#if data?.ecusson != null}<img class="ecusson" src="/ecusson?v={data.ecusson}" alt="Écusson de {centre.nom}" width="72" height="72" />{/if}
	<h1>Connexion</h1>
	{#if form?.envoye}
		<form method="post" action="?/code" class="carte">
			<div class="annonce" role="status">
				<p class="titre">Lien envoyé</p>
				<p>
					Si cette adresse est autorisée, un courriel vient de partir{#if form.email}{' '}vers <strong class="adresse">{form.email}</strong>{/if}. Ouvrez son lien, ou tapez ici son code à 6 chiffres. Pensez à regarder dans vos courriers indésirables.
				</p>
			</div>
			<input type="hidden" name="email" value={form.email} />
			<input type="hidden" name="envoyeLe" value={form.envoyeLe} />
			<Champ id="code" name="code" libelle="Code reçu par courriel" inputmode="numeric" autocomplete="one-time-code" maxlength={7} requis erreur={form.erreur} />
			<Bouton type="submit">Me connecter</Bouton>
		</form>
		<form method="post" action="?/envoyer" class="renvoi">
			<input type="hidden" name="email" value={form.email} />
			<Bouton type="submit" variante="secondaire" desactive={restant > 0}>Renvoyer l’e-mail</Bouton>
			{#if restant > 0}<p class="attente">Possible dans {restant} s</p>{/if}
		</form>
		<a class="changer" href="/connexion">Changer d’adresse</a>
	{:else}
		<p class="phrase">Pas de mot de passe : recevez un lien de connexion par courriel.</p>
		<form method="post" action="?/envoyer" class="carte">
			<Champ id="email" name="email" type="email" libelle="Adresse e-mail" autocomplete="email" requis />
			<Bouton type="submit">Recevoir un lien de connexion</Bouton>
		</form>
	{/if}
	<a class="donnees" href="/donnees">Vos données dans Gyro Caserne</a>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--espace-16);
		max-width: 26rem;
		margin: 0 auto;
		padding-top: 1rem;
		text-align: center;
	}
	/* L'écusson du centre, s'il y en a un, au-dessus du titre. */
	.ecusson {
		width: var(--ecusson-connexion);
		height: var(--ecusson-connexion);
		object-fit: contain;
	}
	h1 {
		margin: 0;
		font: 700 var(--texte-30)/1.1 var(--police-titre);
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
		gap: var(--espace-16);
		padding: var(--espace-20);
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
		border-radius: var(--rayon-grand);
		background: var(--surface);
		text-align: left;
	}
	.carte :global(button) {
		width: 100%;
	}
	.annonce {
		display: flex;
		flex-direction: column;
		gap: var(--espace-6);
	}
	.renvoi {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--espace-6);
	}
	.attente {
		color: var(--doux);
		font-size: var(--texte-15);
	}
	.titre {
		font: 700 var(--texte-20) var(--police-titre);
	}
	.adresse {
		overflow-wrap: anywhere;
	}
	.changer,
	.donnees {
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		padding: 0 var(--espace-12);
		color: var(--encre);
		font-weight: 600;
	}
</style>
