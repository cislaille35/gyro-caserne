<script lang="ts">
	import FormulairePublication from '#lib/ui/FormulairePublication.svelte';

	let { data, form } = $props();

	const retour = $derived(data.choisi ? `/echanges/${encodeURIComponent(data.choisi)}` : '/echanges');
	// Une seule zone annoncée par page.
	const annonceEchec = $derived(form ? (form.message ?? 'La publication contient des erreurs.') : '');
</script>

<svelte:head>
	<title>Nouvelle publication · Échanges · Gyro Caserne</title>
</svelte:head>

<header class="entete">
	<a class="annuler" href={retour}>Annuler</a>
	<h1 id="titre-publier" tabindex="-1">Nouvelle publication</h1>
</header>

<div class="annonce" role="alert">{annonceEchec}</div>

{#if data.murs.length === 0}
	<p class="aucun">Vous ne pouvez publier sur aucun mur.</p>
{:else}
	<FormulairePublication murs={data.murs} choisi={data.choisi} equipes={data.equipes} defauts={{ texte: data.texte, ouverture: data.ouverture, cloture: data.cloture }} {form} />
{/if}

<style>
	.entete {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 8px;
		margin-bottom: 16px;
	}
	.annuler {
		min-height: var(--cible);
		display: flex;
		align-items: center;
		color: var(--encre);
		font-weight: 600;
		text-decoration: none;
	}
	.annuler:hover {
		text-decoration: underline;
	}
	h1 {
		margin: 0;
		text-align: center;
		font: 700 1.375rem var(--police-titre);
	}
	.annonce {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.aucun {
		margin: 0;
		color: var(--doux);
	}
</style>
