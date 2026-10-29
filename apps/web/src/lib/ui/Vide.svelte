<script lang="ts">
	import GyroDuMoment from '../gyro/GyroDuMoment.svelte';

	// Un écran ou une liste vide : ce que c'est (titre), à quoi ça servira (texte), et quoi faire (action) ; Gyro selon le niveau d'affichage.
	let { titre, texte, action, gyro = true }: { titre?: string; texte: string; action?: { href: string; libelle: string }; gyro?: boolean } = $props();
</script>

<div class="vide">
	{#if gyro}<GyroDuMoment tenue="vide" taille={120} decoratif />{/if}
	{#if titre}<p class="titre">{titre}</p>{/if}
	<p class="texte">{texte}</p>
	{#if action}<a class="action" href={action.href}>{action.libelle}</a>{/if}
</div>

<style>
	.vide {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 2rem 1rem;
		text-align: center;
	}
	p {
		margin: 0;
		max-width: 26rem;
	}
	.titre {
		margin-top: 6px;
		font: 700 1.375rem/1.2 var(--police-titre);
	}
	.titre + .texte {
		color: var(--doux);
	}
	.action {
		min-height: var(--cible);
		margin-top: 10px;
		padding: 0 20px;
		display: inline-flex;
		align-items: center;
		border: 1px solid var(--trait);
		border-radius: 999px;
		background: var(--surface);
		color: var(--encre);
		font-weight: 600;
		text-decoration: none;
	}
	.action:hover {
		border-color: var(--encre);
	}
</style>
