<script lang="ts">
	import Bouton from '#lib/ui/Bouton.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';

	let { data, form } = $props();

	let copie = $state(false);
	async function copier() {
		if (!data.lien) return;
		await navigator.clipboard.writeText(data.lien).catch(() => {});
		copie = true;
	}
</script>

<svelte:head>
	<title>Ajouter à mon agenda · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<EnTetePage titre="Ajouter à mon agenda" phrase="Vos astreintes, vos manœuvres et vos gardes de fêtes dans l’agenda de votre téléphone." retour={{ href: '/moi', libelle: 'Moi' }} />

	{#if !data.lien}
		<p>{data.sansPlanning ? 'Le planning est réservé aux agents du centre.' : 'Le super administrateur n’a pas de planning à ajouter.'}</p>
	{:else}
		<section class="carte" aria-labelledby="mon-lien">
			<h2 id="mon-lien">Mon lien</h2>
			<p>Ajoutez-le une seule fois : l’agenda se met ensuite à jour tout seul quand le planning change (souvent en quelques heures).</p>
			<label for="lien">Lien d’abonnement</label>
			<input id="lien" type="text" readonly value={data.lien} onfocus={(e) => e.currentTarget.select()} />
			<div class="gestes">
				<Bouton onclick={copier}>Copier le lien</Bouton>
				<a class="lien-secondaire" href={data.webcal}>Ouvrir dans l’agenda</a>
			</div>
			<div role="status">{#if copie}<p class="succes">Lien copié.</p>{/if}</div>
			<p class="avertissement">Ce lien est personnel : ne le partagez pas. Quiconque l’a peut lire votre planning.</p>
		</section>

		<section class="carte" aria-labelledby="mode-emploi">
			<h2 id="mode-emploi">Mode d’emploi</h2>
			<h3>Google Agenda</h3>
			<ol>
				<li>Copiez le lien ci-dessus.</li>
				<li>Sur un ordinateur, ouvrez Google Agenda, puis « Autres agendas », « + », « À partir de l’URL ».</li>
				<li>Collez le lien, puis « Ajouter l’agenda ». Il apparaît aussi sur le téléphone.</li>
			</ol>
			<h3>iPhone (Calendrier)</h3>
			<ol>
				<li>Touchez « Ouvrir dans l’agenda » ci-dessus.</li>
				<li>Confirmez « S’abonner », puis « Ajouter ».</li>
				<li>Ou : Réglages, Calendrier, Comptes, Ajouter un compte, Autre, « Ajouter un calendrier avec abonnement », puis collez le lien.</li>
			</ol>
			<h3>Outlook</h3>
			<ol>
				<li>Copiez le lien ci-dessus.</li>
				<li>Dans Outlook, « Ajouter un calendrier », puis « S’abonner à partir du web ».</li>
				<li>Collez le lien, donnez-lui un nom, puis « Importer ».</li>
			</ol>
		</section>

		<section class="carte" aria-labelledby="changer">
			<h2 id="changer">Lien perdu ou partagé ?</h2>
			<p>Changer le lien arrête l’ancien tout de suite. Il faudra ajouter le nouveau dans votre agenda.</p>
			<div role="status">{#if form?.change}<p class="succes">Nouveau lien créé : ajoutez-le dans votre agenda et retirez l’ancien.</p>{/if}</div>
			<form method="POST" action="?/changer"><Bouton type="submit" variante="secondaire">Changer le lien</Bouton></form>
		</section>
	{/if}
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 16px;
		max-width: 40rem;
	}
	h2,
	h3,
	p {
		margin: 0;
	}
	h2 {
		font: 700 1.5rem var(--police-titre);
	}
	h3 {
		margin-top: 6px;
		font: 700 1.125rem var(--police-titre);
	}
	ol {
		margin: 0;
		padding-left: 1.4em;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.carte {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 16px;
		border: 1px solid var(--trait-doux);
		border-radius: var(--rayon-grand);
		background: var(--surface);
	}
	label {
		font-weight: 600;
	}
	input {
		min-height: var(--cible);
		padding: 0 12px;
		border: 2px solid var(--doux);
		border-radius: var(--rayon-petit);
		background: var(--fond);
		color: var(--encre);
		font: 400 0.9375rem var(--police);
		text-overflow: ellipsis;
	}
	.gestes {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px 20px;
	}
	.avertissement {
		color: var(--statut-alerte-texte);
		font-weight: 600;
	}
	.succes {
		padding: 10px 14px;
		border: 2px solid var(--ok);
		border-radius: var(--rayon-petit);
		font-weight: 600;
	}
</style>
