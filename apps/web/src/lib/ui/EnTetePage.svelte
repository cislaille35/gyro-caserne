<script lang="ts">
	import type { Snippet } from 'svelte';
	import Retour from './Retour.svelte';
	import { DESSINS } from './icones-roles.ts';

	// En-tête d'écran, comme Échanges : retour « ‹ Moi », titre (h1), phrase, complément sous la phrase, une tête à droite du titre (Gyro de l’Accueil), action secondaire, action principale (bouton rouge, icône et libellé).
	let {
		titre,
		phrase,
		complement,
		tete,
		retour,
		secondaire,
		action
	}: {
		titre: string;
		phrase?: string;
		complement?: Snippet;
		tete?: Snippet;
		retour?: { href: string; libelle: string };
		secondaire?: Snippet;
		action?: { href: string; libelle: string; dessin?: string; discrete?: boolean };
	} = $props();
</script>

<header class="entete">
	{#if retour}<Retour href={retour.href} libelle={retour.libelle} />{/if}
	<div class="ligne">
		<div class="titres" class:avec-tete={tete}>
			<h1 tabindex="-1">{titre}</h1>
			{#if phrase}<p class="phrase">{phrase}</p>{/if}
			{#if complement}{@render complement()}{/if}
		</div>
		{#if tete}<span class="tete">{@render tete()}</span>{/if}
		{#if secondaire || action}
			<div class="actions">
				{#if secondaire}<span class="secondaire">{@render secondaire()}</span>{/if}
				{#if action}
					<a class="action" class:discrete={action.discrete} href={action.href}>
						<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"
							><path d={action.dessin ?? DESSINS.plus} /></svg
						>
						<span class="libelle">{action.libelle}</span>
					</a>
				{/if}
			</div>
		{/if}
	</div>
</header>

<style>
	.entete {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--espace-4);
	}
	/* Les actions passent sous le titre quand la place manque (téléphone, titre long). */
	.ligne {
		align-self: stretch;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--espace-12);
	}
	.actions {
		margin-left: auto;
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		align-items: center;
		gap: var(--espace-8);
	}
	/* Gyro posé à droite du titre, sur la plaque qui suit. */
	.tete {
		flex: none;
		align-self: flex-end;
		margin-bottom: -8px;
	}
	.titres {
		flex: 1 1 11rem;
		min-width: 0;
	}
	h1 {
		margin: 0;
		font: 700 var(--texte-30)/1.1 var(--police-titre);
		overflow-wrap: anywhere;
	}
	h1:focus {
		outline: none;
	}
	/* Le bouton d'action reste à côté du titre ; la phrase passe dessous, sur toute la largeur. */
	.titres:not(.avec-tete) {
		display: contents;
	}
	.titres:not(.avec-tete) h1 {
		flex: 1 1 8rem;
		min-width: 0;
	}
	.phrase {
		flex-basis: 100%;
		order: 1;
		margin: 2px 0 0;
		color: var(--doux);
		font-size: var(--texte-15);
	}
	.secondaire {
		flex: none;
		display: inline-flex;
		gap: var(--espace-8);
	}
	.action {
		flex: none;
		min-width: 48px;
		height: 48px;
		border-radius: var(--rayon-bouton);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--espace-6);
		padding: 0 var(--espace-16) 0 var(--espace-16);
		background: var(--rouge);
		color: var(--sur-rouge);
		font-weight: 600;
		text-decoration: none;
	}
	@media (hover: hover) and (pointer: fine) {
		.action:hover {
			background: var(--rouge-survol);
			color: var(--sur-rouge);
		}
	}
	/* Une action rare : le rouge reste à ce qu'on fait tous les jours. */
	.action.discrete {
		border: 1px solid var(--trait);
		background: var(--surface);
		color: var(--encre);
	}
	@media (hover: hover) and (pointer: fine) {
		.action.discrete:hover {
			background: var(--surface);
			color: var(--encre);
			border-color: var(--encre);
		}
	}
	/* Le libellé se voit à toutes les tailles : le bouton dit ce qu'il fait. */
	.libelle {
		white-space: nowrap;
	}
</style>
