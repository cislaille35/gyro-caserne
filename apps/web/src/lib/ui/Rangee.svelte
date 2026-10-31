<script lang="ts">
	import type { Snippet } from 'svelte';
	import IconeRole from './IconeRole.svelte';
	import type { IconeRole as NomIcone } from './icones-roles.ts';

	// Une rangée de liste : tête (icône, visage, pastille), titre, sous-ligne, valeur ou `droite` ; lien avec chevron si `href`.
	// `courant` : la page affichée (liste à côté d'une page). Avec `children` (des gestes sous le texte), seul le titre est un lien. `alerte` ajoute le signe d'alerte (en tête, ou à droite s'il y a déjà une icône) ; `discret`, pour ce qui n'existe pas encore.
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
		sous?: string;
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
		{#if href && !lien}<a class="titre" {href}>{titre}</a>{:else}<span class="titre">{titre}</span>{/if}
		{#if sous}<span class="sous">{sous}</span>{/if}
		{#if children}{@render children()}{/if}
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
		min-height: 56px;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		border: 1px solid var(--trait-doux);
		border-radius: 18px;
		background: var(--surface);
		color: var(--encre);
		text-decoration: none;
	}
	a.rangee:hover {
		border-color: var(--trait);
		box-shadow: 0 2px 10px color-mix(in srgb, var(--encre) 8%, transparent);
	}
	a.rangee:hover .titre,
	a.titre:hover {
		text-decoration: underline;
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
		font-size: 1.0625rem;
		line-height: 1.3;
		color: inherit;
		overflow-wrap: anywhere;
	}
	/* Cible de 44 px, sans écarter la sous-ligne. */
	a.titre {
		min-height: var(--cible);
		margin: -10px 0;
		display: inline-flex;
		align-items: center;
		align-self: flex-start;
		text-decoration: none;
	}
	.sous {
		color: var(--doux);
		font-size: 0.875rem;
		overflow-wrap: anywhere;
	}
	.droite {
		flex: none;
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}
	.valeur {
		color: var(--doux);
		font-size: 0.9375rem;
		font-weight: 600;
	}
	.chevron {
		flex: none;
		margin-left: -4px;
		color: var(--doux);
	}
	.signe {
		flex: none;
		width: 40px;
		height: 40px;
		border-radius: 12px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--surface);
		color: var(--statut-alerte-texte);
	}
	.a-droite {
		width: 32px;
		height: 32px;
		border-radius: 10px;
	}
	/* À traiter : fond chaud, icône d'alerte, texte qui dit quoi. */
	.alerte {
		background: var(--statut-alerte-fond);
		border-color: var(--statut-alerte-trait);
		color: var(--statut-alerte-texte);
	}
	.alerte .chevron,
	.alerte .sous {
		color: inherit;
	}
	/* Pas encore là : en retrait, sans ombre ni survol. */
	.discret {
		background: transparent;
		border-style: dashed;
	}
	.discret .titre {
		color: var(--doux);
	}
</style>
