<script lang="ts">
	import type { Snippet } from 'svelte';
	import IconeRole from './IconeRole.svelte';
	import type { IconeRole as NomIcone } from './icones-roles.ts';

	// Une ligne d'un groupe (dans la carte de `ListeRangees`) : tête (tuile qui porte un sens, visage, date), titre, sous-ligne, valeur ou `droite` ;
	// avec `href`, toute la ligne est un lien, avec chevron. Avec `children` (des gestes sous le texte), le lien du titre s'étend à la ligne
	// et les gestes passent par-dessus. `courant` : la page affichée. `alerte` ajoute le signe d'alerte (en tête, ou à droite s'il y a une tête) ;
	// `discret`, pour ce qui n'existe pas encore. `sous` en liste : une ligne par info, quand elles sont trop nombreuses pour une seule.
	let {
		titre,
		sous,
		href,
		icone,
		dessin,
		valeur,
		alerte = false,
		discret = false,
		courant = false,
		tete,
		droite,
		children
	}: {
		titre: string;
		sous?: string | string[];
		href?: string;
		icone?: NomIcone;
		dessin?: string;
		valeur?: string;
		alerte?: boolean;
		discret?: boolean;
		courant?: boolean;
		tete?: Snippet;
		droite?: Snippet;
		children?: Snippet;
	} = $props();

	const lien = $derived(href !== undefined && !children);
</script>

{#snippet signe(aDroite: boolean)}
	<span class="signe" class:a-droite={aDroite} aria-hidden="true"
		><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5 2.5 20h19z M12 10v4.5 M12 17.2v.3" /></svg
		></span
	>
{/snippet}

{#snippet contenu()}
	{#if tete}
		{@render tete()}
	{:else if icone}
		<IconeRole {icone} {dessin} taille={40} />
	{:else if alerte}
		{@render signe(false)}
	{/if}
	<div class="corps">
		{#if href && !lien}<a class="titre etire" {href}>{titre}</a>{:else}<span class="titre">{titre}</span>{/if}
		{#each [sous ?? []].flat().filter(Boolean) as ligne, i (i)}<span class="sous">{ligne}</span>{/each}
		{#if children}<div class="inclus">{@render children()}</div>{/if}
	</div>
	<!-- Avec une icône en tête, le signe d'alerte passe à droite : jamais la couleur seule. -->
	{#if alerte && (tete || icone)}{@render signe(true)}{/if}
	{#if droite}
		<span class="droite">{@render droite()}</span>
	{:else if valeur}
		<span class="droite valeur">{valeur}</span>
	{/if}
	{#if lien}
		<svg class="chevron" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6" /></svg>
	{/if}
{/snippet}

{#if lien}
	<a class="rangee" class:alerte class:discret {href} aria-current={courant ? 'page' : undefined}>{@render contenu()}</a>
{:else}
	<div class="rangee" class:alerte class:discret class:gestes={children !== undefined}>{@render contenu()}</div>
{/if}

<style>
	.rangee {
		position: relative;
		isolation: isolate;
		min-height: var(--cible);
		display: flex;
		align-items: center;
		gap: var(--espace-12);
		padding: var(--espace-12) var(--espace-16);
		color: var(--encre);
		text-decoration: none;
	}
	@media (hover: hover) and (pointer: fine) {
		a.rangee:hover,
		.rangee:has(.etire:hover) {
			background: color-mix(in srgb, var(--encre) 4%, var(--surface));
		}
	}
	@media (hover: hover) and (pointer: fine) {
		a.rangee:hover .titre,
		.etire:hover {
			text-decoration: underline;
		}
	}
	/* Le repère du clavier à l'intérieur de la ligne : la carte rogne ce qui dépasse. */
	a.rangee:focus-visible {
		outline-offset: -3px;
	}
	/* La page affichée : fond, liseré et titre en gras, pas la couleur seule. */
	a.rangee[aria-current='page'] {
		background: var(--statut-neutre-fond);
		box-shadow: inset 4px 0 0 var(--encre);
	}
	a.rangee[aria-current='page'] .titre {
		font-weight: 800;
	}
	.gestes {
		align-items: flex-start;
	}
	.corps {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.titre {
		font-weight: 600;
		font-size: var(--texte-16);
		line-height: 1.3;
		color: inherit;
		overflow-wrap: anywhere;
	}
	a.titre {
		text-decoration: none;
	}
	/* Le lien du titre couvre toute la ligne ; son repère du clavier aussi. */
	.etire::after {
		content: '';
		position: absolute;
		inset: 0;
	}
	.etire:focus-visible {
		outline: none;
	}
	.etire:focus-visible::after {
		outline: 3px solid var(--focus);
		outline-offset: -3px;
	}
	/* Les gestes de la ligne restent touchables, au-dessus du lien ; entre eux, le clic va à la ligne. */
	.inclus {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		pointer-events: none;
	}
	.inclus > :global(*) {
		pointer-events: auto;
	}
	.sous {
		color: var(--doux);
		font-size: var(--texte-14);
		overflow-wrap: anywhere;
	}
	.droite {
		flex: none;
		display: inline-flex;
		align-items: center;
		gap: var(--espace-8);
	}
	.valeur {
		color: var(--doux);
		font-size: var(--texte-15);
		font-weight: 600;
	}
	.chevron {
		flex: none;
		margin-left: -4px;
		color: var(--doux);
	}
	/* À traiter : le signe d'alerte sur sa tuile, et le texte qui dit quoi. */
	.signe {
		flex: none;
		width: 40px;
		height: 40px;
		border-radius: var(--rayon-bouton);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: var(--statut-alerte-texte);
	}
	.a-droite {
		width: 32px;
		height: 32px;
		border-radius: var(--rayon-bouton);
	}
	/* Pas encore là : en retrait. */
	.discret .titre {
		color: var(--doux);
	}
</style>
