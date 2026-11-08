<script lang="ts">
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
		<fieldset>
			<legend class="rubrique">Présence de Gyro</legend>
			{#each niveaux as n (n.valeur)}
				<label>
					<input type="radio" name="niveau" value={n.valeur} checked={niveauChoisi === n.valeur} />
					<span><strong>{n.nom}</strong><br /><span class="doux">{n.phrase}</span></span>
				</label>
			{/each}
		</fieldset>
		<fieldset>
			<legend class="rubrique">Thème</legend>
			{#each themes as t (t.valeur)}
				<label>
					<input type="radio" name="theme" value={t.valeur} checked={themeChoisi === t.valeur} />
					<strong>{t.nom}</strong>
				</label>
			{/each}
		</fieldset>
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
	fieldset {
		margin: 0;
		padding: 0;
		border: 0;
		display: flex;
		flex-direction: column;
		gap: var(--espace-12);
	}
	legend {
		padding: 0;
		margin-bottom: var(--espace-12);
	}
	/* Chaque choix est une rangée ; la choisie a un contour épais, en plus du bouton radio coché. */
	label {
		min-height: 56px;
		display: flex;
		align-items: center;
		gap: var(--espace-12);
		padding: var(--espace-12) var(--espace-16);
		border: 1px solid var(--trait-doux);
		border-radius: var(--rayon-grand);
		background: var(--surface);
		cursor: pointer;
	}
	label:has(input:checked) {
		border: 2px solid var(--encre);
		padding: var(--espace-8) var(--espace-12);
	}
	.doux {
		font-size: var(--texte-15);
	}
	input[type='radio'] {
		width: 1.5rem;
		height: 1.5rem;
		flex: none;
		margin: 0;
	}
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
