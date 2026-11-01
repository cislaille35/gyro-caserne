<script lang="ts">
	import Bouton from '#lib/ui/Bouton.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';

	let { data, form } = $props();

	let copie = $state<'' | 'ok' | 'echec'>('');
	// Copie refusée par le navigateur : le lien est sélectionné, à copier à la main.
	async function copier() {
		if (!data.lien) return;
		try {
			await navigator.clipboard.writeText(data.lien);
			copie = 'ok';
		} catch {
			copie = 'echec';
			const champ = document.getElementById('lien') as HTMLInputElement | null;
			champ?.focus();
			champ?.select();
		}
	}
	const AGENDA = 'M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4 M12 13v5 M9.5 15.5h5';
</script>

<svelte:head>
	<title>Ajouter à mon agenda · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<EnTetePage titre="Ajouter à mon agenda" phrase="Votre planning dans l’agenda de votre téléphone." retour={{ href: '/moi', libelle: 'Moi' }} />

	{#if !data.lien}
		<p>{data.sansPlanning ? 'Le planning est réservé aux agents du centre.' : 'Le super administrateur n’a pas de planning à ajouter.'}</p>
	{:else}
		<section class="carte" aria-labelledby="a-quoi">
			<h2 id="a-quoi">À quoi ça sert ?</h2>
			<ul class="sert">
				<li>Votre planning s’affiche dans l’agenda de votre téléphone, à côté de vos rendez-vous.</li>
				<li>Il se met à jour tout seul : astreintes, manœuvres, remplacements.</li>
				<li>Une seule fois, et plus rien à recopier.</li>
			</ul>
			<div class="gestes">
				<a class="principal" href={data.webcal}
					><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d={AGENDA} /></svg>Ajouter à mon agenda</a
				>
				<Bouton variante="secondaire" onclick={copier}>Copier le lien</Bouton>
			</div>
			<div role="status">
				{#if copie === 'ok'}<p class="succes">Lien copié : collez-le dans votre agenda.</p>{:else if copie === 'echec'}<p class="succes">Copie impossible ici : le lien est sélectionné ci-dessous, copiez-le à la main.</p>{/if}
			</div>
			<label for="lien">Votre lien personnel</label>
			<input id="lien" type="text" readonly value={data.lien} onfocus={(e) => e.currentTarget.select()} />
		</section>

		<section class="carte" aria-labelledby="mode-emploi">
			<h2 id="mode-emploi">Mode d’emploi</h2>
			<p class="doux">Si le bouton n’ouvre pas votre agenda, suivez les étapes de votre application.</p>
			<details open={data.appareil === 'android'}>
				<summary>Google Agenda (Android)</summary>
				<ol>
					<li>Touchez « Copier le lien » ci-dessus.</li>
					<li>Sur un ordinateur, ouvrez Google Agenda, puis « Autres agendas », « + », « À partir de l’URL ».</li>
					<li>Collez le lien, puis « Ajouter l’agenda ». Il apparaît aussi sur le téléphone.</li>
				</ol>
			</details>
			<details open={data.appareil === 'iphone'}>
				<summary>iPhone (Calendrier)</summary>
				<ol>
					<li>Touchez « Ajouter à mon agenda » ci-dessus.</li>
					<li>Confirmez « S’abonner », puis « Ajouter ».</li>
					<li>Ou : Réglages, Calendrier, Comptes, Ajouter un compte, Autre, « Ajouter un calendrier avec abonnement », puis collez le lien.</li>
				</ol>
			</details>
			<details>
				<summary>Outlook</summary>
				<ol>
					<li>Touchez « Copier le lien » ci-dessus.</li>
					<li>Dans Outlook, « Ajouter un calendrier », puis « S’abonner à partir du web ».</li>
					<li>Collez le lien, donnez-lui un nom, puis « Importer ».</li>
				</ol>
			</details>
		</section>

		<section class="carte" aria-labelledby="changer">
			<h2 id="changer">Bon à savoir</h2>
			<p>L’agenda peut mettre quelques heures à se mettre à jour ; l’appli est toujours à jour.</p>
			<p class="avertissement">Ce lien est personnel : ne le partagez pas. Quiconque l’a peut lire votre planning.</p>
			<p>Lien perdu ou partagé ? Le changer arrête l’ancien tout de suite ; il faudra ajouter le nouveau dans votre agenda.</p>
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
	p {
		margin: 0;
	}
	h2 {
		font: 700 1.5rem var(--police-titre);
	}
	ul,
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
		gap: 12px;
		padding: 16px;
		border: 1px solid var(--trait-doux);
		border-radius: var(--rayon-grand);
		background: var(--surface);
	}
	.gestes {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
	}
	.principal {
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 0 22px 0 18px;
		border: 2px solid var(--encre);
		border-radius: var(--rayon-petit);
		background: var(--rouge);
		color: var(--sur-rouge);
		font: 700 1.0625rem var(--police);
		text-decoration: none;
	}
	.principal:hover {
		background: var(--rouge-survol);
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
	details {
		border-top: 1px solid var(--trait-doux);
		padding-top: 4px;
	}
	summary {
		min-height: var(--cible);
		display: flex;
		align-items: center;
		font: 700 1.125rem var(--police-titre);
		cursor: pointer;
	}
	details ol {
		padding-bottom: 8px;
	}
	.doux {
		color: var(--doux);
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
