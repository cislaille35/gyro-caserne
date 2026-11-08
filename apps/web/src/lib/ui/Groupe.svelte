<script lang="ts">
	import type { Snippet } from 'svelte';
	import IconeRole from './IconeRole.svelte';
	import type { IconeRole as NomIcone } from './icones-roles.ts';

	let {
		titre,
		resume,
		ouvert = $bindable(false),
		niveauTitre = 2,
		couleur,
		alerte = false,
		icone,
		dessin,
		action,
		children
	}: { titre: string; resume?: string; ouvert?: boolean; niveauTitre?: 2 | 3; couleur?: string; alerte?: boolean; icone?: NomIcone; dessin?: string; action?: Snippet; children: Snippet } = $props();
	const id = $props.id();
</script>

<section class="groupe" style:border-left={couleur ? `6px solid ${couleur}` : undefined}>
	<div class="ligne">
		<svelte:element this={`h${niveauTitre}`} class="entete">
			<button type="button" aria-expanded={ouvert ? 'true' : 'false'} aria-controls={id} onclick={() => (ouvert = !ouvert)}>
				{#if icone}<IconeRole {icone} {dessin} taille={40} />{/if}
				<span class="textes">
					<span class="titre">{titre}</span>
					{#if resume}<span class="resume" class:alerte>{resume}</span>{/if}
				</span>
				<svg class="chevron" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6" /></svg>
			</button>
		</svelte:element>
		{#if action}{@render action()}{/if}
	</div>
	<div {id} class="contenu" hidden={!ouvert}>{@render children()}</div>
</section>

<style>
	.groupe {
		background: var(--surface);
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
		border-radius: var(--rayon-grand);
		overflow: hidden;
	}
	.ligne {
		display: flex;
		align-items: center;
	}
	.entete {
		flex: 1;
		min-width: 0;
		margin: 0;
		font: inherit;
	}
	button {
		width: 100%;
		min-height: 56px;
		display: flex;
		align-items: center;
		gap: var(--espace-12);
		padding: var(--espace-12) var(--espace-16);
		border: none;
		background: none;
		color: var(--encre);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	button:focus-visible {
		outline-offset: -3px;
	}
	.textes {
		flex: 1;
		display: flex;
		flex-direction: column;
	}
	.titre {
		font: 700 var(--texte-20) var(--police-titre);
	}
	.resume {
		font-size: var(--texte-14);
		color: var(--doux);
	}
	.resume.alerte {
		color: var(--statut-alerte-texte);
		font-weight: 600;
	}
	.chevron {
		flex: none;
		color: var(--doux);
		transition: transform var(--duree-etat) var(--courbe-sortie);
	}
	@media (prefers-reduced-motion: reduce) {
		.chevron {
			transition: none;
		}
	}
	[aria-expanded='true'] .chevron {
		transform: rotate(90deg);
	}
	.contenu {
		border-top: 1px solid var(--trait-doux);
	}
</style>
