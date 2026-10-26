<script lang="ts">
	import Bouton from '#lib/ui/Bouton.svelte';
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
	<h1>Affichage</h1>
	<form method="post">
		<fieldset>
			<legend>Niveau de vie</legend>
			{#each niveaux as n (n.valeur)}
				<label>
					<input type="radio" name="niveau" value={n.valeur} checked={niveauChoisi === n.valeur} />
					<span><strong>{n.nom}</strong><br />{n.phrase}</span>
				</label>
			{/each}
		</fieldset>
		<fieldset>
			<legend>Thème</legend>
			{#each themes as t (t.valeur)}
				<label>
					<input type="radio" name="theme" value={t.valeur} checked={themeChoisi === t.valeur} />
					<span>{t.nom}</span>
				</label>
			{/each}
		</fieldset>
		<Bouton type="submit">Enregistrer</Bouton>
	</form>
	<div role="status">
		{#if form?.enregistre}
			<p>Votre affichage est enregistré.</p>
		{:else if form?.erreur}
			<p>{form.erreur}</p>
		{/if}
	</div>
</div>

<style>
	.page {
		max-width: 40rem;
		margin: 0 auto;
		padding: 1rem;
	}
	h1 {
		font-family: var(--police-titre);
	}
	fieldset {
		margin: 0 0 1rem;
		padding: 0.75rem 1rem;
		border: 1px solid var(--trait);
		border-radius: var(--rayon-grand);
		background: var(--surface);
	}
	legend {
		padding: 0 0.5rem;
		font-weight: 600;
	}
	label {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-height: var(--cible);
		padding: 0.25rem 0;
	}
	input[type='radio'] {
		width: 1.5rem;
		height: 1.5rem;
		flex: none;
		accent-color: var(--accent);
	}
	[role='status'] {
		margin-top: 1rem;
		min-height: 1.5rem;
	}
</style>
