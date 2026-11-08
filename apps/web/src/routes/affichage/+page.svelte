<script lang="ts">
	import ChoixRadio from '#lib/ui/ChoixRadio.svelte';
	import Bouton from '#lib/ui/Bouton.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	let { data, form } = $props();

	const niveaux = [
		{ valeur: 'sobre', nom: 'Sobre', phrase: 'Sérieux : ni humour ni mouvement.' },
		{ valeur: 'equilibre', nom: 'Équilibré', phrase: 'Un peu de couleur et de légèreté.' },
		{ valeur: 'vivant', nom: 'Vivant', phrase: 'Toute la bonne humeur de la caserne.' }
	];
	const themes = [
		{ valeur: 'auto', nom: 'Comme le téléphone' },
		{ valeur: 'clair', nom: 'Clair' },
		{ valeur: 'sombre', nom: 'Sombre' }
	];

	const niveauChoisi = $derived(form?.niveau ?? data.affichage.niveau);
	const themeChoisi = $derived(form?.theme ?? data.affichage.theme);
</script>

<svelte:head>
	<title>Affichage · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<!-- Sans connexion, « Affichage » est un onglet : pas de retour. -->
	<EnTetePage titre="Affichage" phrase="Sur cet appareil seulement." retour={data.connecte ? { href: '/moi', libelle: 'Moi' } : undefined} />
	<form method="post">
		<ChoixRadio id="niveau" legende="Présence de Gyro" name="niveau" disposition="rangees" valeur={niveauChoisi} options={niveaux.map((n) => ({ valeur: n.valeur, libelle: n.nom, sous: n.phrase }))} />
		<ChoixRadio id="theme" legende="Thème" name="theme" disposition="rangees" valeur={themeChoisi} options={themes.map((t) => ({ valeur: t.valeur, libelle: t.nom }))} />
		<div><Bouton type="submit">Enregistrer</Bouton></div>
	</form>
	<div role="status">
		{#if form?.enregistre}
			<p class="succes">Votre affichage est enregistré.</p>
		{:else if form?.erreur}
			<p class="echec">{form.erreur}</p>
		{/if}
	</div>
</div>

<style>
	.page,
	form {
		display: flex;
		flex-direction: column;
		gap: var(--espace-20);
	}
	.page {
		max-width: 40rem;
	}
	/* Chaque choix est une rangée ; la choisie a un contour épais, en plus du bouton radio coché. */
	[role='status'] p {
		margin: 0;
		padding: var(--espace-12) var(--espace-16);
		border-radius: var(--rayon-grand);
		font-weight: 600;
	}
	.succes {
		border: 1px solid var(--statut-ok-trait);
		background: var(--statut-ok-fond);
		color: var(--statut-ok-texte);
	}
	.echec {
		border: 1px solid var(--statut-danger-trait);
		background: var(--statut-danger-fond);
		color: var(--statut-danger-texte);
	}
</style>
