<script lang="ts">
	import { DESSINS } from './icones-roles.ts';
	import type { Snippet } from 'svelte';
	import { entreesNavigation, rubriqueDe } from './navigation.ts';
	import Visage from './Visage.svelte';

	let {
		chemin,
		connecte,
		nomCentre,
		cloche = 0,
		nonLus = 0,
		visage = null,
		conversation = false,
		children
	}: { chemin: string; connecte: boolean; nomCentre: string; cloche?: number; nonLus?: number; visage?: { prenom: string; nom: string; couleur: string | null } | null; conversation?: boolean; children: Snippet } = $props();

	const entrees = $derived(entreesNavigation(connecte));
	// Sans connexion, seule la page elle-même est marquée.
	const actif = $derived(connecte ? rubriqueDe(chemin) : chemin);
	const courant = (href: string) => (actif === href ? 'page' : undefined);
	// Le nombre est dit dans le nom du lien ; la pastille le montre.
	const nomCloche = $derived(
		cloche > 99 ? 'Notifications, plus de 99 nouvelles' : cloche > 0 ? `Notifications, ${cloche} ${cloche > 1 ? 'nouvelles' : 'nouvelle'}` : 'Notifications'
	);

	const dessins: Record<string, string> = {
		accueil: 'M3 10.5 12 3l9 7.5V21H3z M9 21v-6h6v6',
		planning: 'M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4',
		caserne: 'M2 21h20 M4 21V10h11v11 M15 21V4h5v17 M7 21v-6h5v6',
		echanges: DESSINS.echanges,
		connexion: DESSINS.sortir,
		affichage: DESSINS.affichage,
		cloche: 'M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z M10 20a2 2 0 0 0 4 0',
		moi: DESSINS.profil
	};
</script>

{#snippet icone(nom: string)}
	<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
		<path d={dessins[nom]}></path>
	</svg>
{/snippet}

<a class="evitement" href="#contenu">Aller au contenu</a>

<div class="coquille" class:conversation>
	<header>
		<div class="titre">
			<span class="appli">Gyro Caserne</span>
			<span class="centre">{nomCentre}</span>
		</div>
		{#if connecte}
			<a class="rond cloche" href="/notifications" aria-label={nomCloche} aria-current={courant('/notifications')}>
				{@render icone('cloche')}
				{#if cloche > 0}<span class="nombre" aria-hidden="true">{cloche > 99 ? '99+' : cloche}</span>{/if}
			</a>
			<!-- « Moi » : le visage de la personne ; sans fiche (super administrateur), l'icône de profil. -->
			<a class="moi" href="/moi" aria-current={courant('/moi')}>
				{#if visage}<Visage prenom={visage.prenom} nom={visage.nom} couleur={visage.couleur} taille={44} />{:else}<span class="rond">{@render icone('moi')}</span>{/if}
				<span class="masque">Moi</span>
			</a>
		{/if}
	</header>
	<div class="marquage" aria-hidden="true"></div>

	<nav aria-label="Navigation principale">
		{#each entrees as entree (entree.href)}
			{@const pastille = entree.href === '/echanges' && nonLus > 0}
			<a href={entree.href} aria-current={courant(entree.href)}>
				<span class="dessin">
					{@render icone(entree.icone)}
					{#if pastille}<span class="nombre" aria-hidden="true">{nonLus > 99 ? '99+' : nonLus}</span>{/if}
				</span>
				<span>{entree.libelle}{#if pastille}<span class="masque">, {nonLus} {nonLus > 1 ? 'messages non lus' : 'message non lu'}</span>{/if}</span>
			</a>
		{/each}
	</nav>

	<main id="contenu" tabindex="-1">
		{@render children()}
	</main>
</div>

<style>
	.evitement {
		position: absolute;
		left: 0.5rem;
		top: -4rem;
		z-index: 20;
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		padding: 0 1rem;
		background: var(--surface);
		color: var(--encre);
		border: 2px solid var(--encre);
		border-radius: var(--rayon-petit);
	}
	.evitement:focus {
		top: 0.5rem;
	}
	.coquille {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
	}
	/* L'en-tête anthracite, la marque de l'appli : le repère du clavier y est clair. */
	header {
		min-height: 60px;
		display: flex;
		align-items: center;
		gap: var(--espace-12);
		padding: var(--espace-8) var(--espace-12) var(--espace-8) var(--espace-16);
		background: var(--entete-fond);
		color: var(--entete-texte);
		--focus: var(--entete-focus);
	}
	/* La bande de marquage jaune et rouge des engins, fine et immobile. */
	.marquage {
		height: 4px;
		flex: none;
		background: var(--marquage);
	}
	.titre {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		column-gap: var(--espace-12);
	}
	header a {
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--entete-texte);
		text-decoration: none;
	}
	.rond {
		width: var(--cible);
		height: var(--cible);
		flex: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--rayon-bouton);
		background: var(--entete-bouton);
		color: var(--entete-texte);
	}
	header :global(.visage) {
		border-radius: var(--rayon-bouton);
	}
	.cloche {
		position: relative;
	}
	.nombre {
		position: absolute;
		top: -4px;
		right: -6px;
		min-width: 22px;
		height: 22px;
		padding: 0 var(--espace-4);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		border: 2px solid var(--entete-fond);
		background: var(--rouge);
		color: var(--sur-rouge);
		font-size: var(--texte-12);
		font-weight: 700;
		line-height: 1;
	}
	nav .nombre {
		border-color: var(--surface);
	}
	.dessin {
		position: relative;
		display: inline-flex;
	}
	.dessin .nombre {
		top: -8px;
		right: -14px;
	}
	.moi {
		border-radius: var(--rayon-bouton);
	}
	/* La page « Moi » ou la cloche : un trait clair dessous, pour ne pas ressembler au repère du clavier. */
	header a.moi[aria-current='page'] :global(.visage),
	header a.moi[aria-current='page'] .rond,
	header a.rond[aria-current='page'] {
		box-shadow: 0 4px 0 -1px var(--entete-texte);
	}
	/* Le mode contrasté retire les ombres. */
	@media (forced-colors: active) {
		header a.moi[aria-current='page'] :global(.visage),
		header a.moi[aria-current='page'] .rond,
		header a.rond[aria-current='page'] {
			outline: 2px solid CanvasText;
			outline-offset: 2px;
		}
	}
	.appli {
		font: 700 var(--texte-20)/1.1 var(--police-titre);
		letter-spacing: 0.02em;
		text-transform: uppercase;
	}
	.centre {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--entete-doux);
		font-size: var(--texte-14);
	}
	main {
		flex: 1;
		padding: 1rem 1rem 6rem;
	}
	main:focus {
		outline: none;
	}
	nav {
		position: fixed;
		inset: auto 0 0 0;
		z-index: 10;
		display: flex;
		padding-bottom: env(safe-area-inset-bottom);
		background: var(--surface);
		border-top: 1px solid var(--trait-doux);
	}
	nav a {
		position: relative;
		flex: 1;
		min-height: 4rem;
		min-width: var(--cible);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.125rem;
		padding: 0.25rem;
		color: var(--doux);
		text-decoration: none;
		font-size: var(--texte-14);
	}
	nav a[aria-current='page'] {
		color: var(--encre);
		font-weight: 700;
	}
	/* L'onglet actif : une barre rouge en haut, en plus du gras. */
	nav a[aria-current='page']::before {
		content: '';
		position: absolute;
		top: 0;
		left: 22%;
		right: 22%;
		height: 3px;
		border-radius: 0 0 3px 3px;
		background: var(--accent);
	}

	/* Au téléphone, une conversation garde tout l'écran : son propre en-tête ramène à la liste. */
	@media (max-width: 1023px) {
		.conversation header,
		.conversation .marquage,
		.conversation nav {
			display: none;
		}
	}

	@media (min-width: 1024px) {
		.coquille {
			display: grid;
			grid-template-columns: 13.75rem minmax(0, 1fr);
			grid-template-rows: auto auto 1fr;
			grid-template-areas:
				'entete entete'
				'marquage marquage'
				'menu contenu';
			/* Le fond du menu descend jusqu'en bas, même sur une page plus haute que l'écran. */
			background: linear-gradient(to right, var(--menu-fond) 13.75rem, transparent 13.75rem);
		}
		header {
			grid-area: entete;
			gap: var(--espace-12);
			padding: var(--espace-8) var(--espace-20);
		}
		.marquage {
			grid-area: marquage;
		}
		.appli {
			font-size: var(--texte-24);
		}
		.centre {
			font-size: var(--texte-14);
		}
		nav {
			grid-area: menu;
			position: sticky;
			top: 0;
			align-self: start;
			flex-direction: column;
			gap: var(--espace-4);
			padding: var(--espace-16) var(--espace-12);
			border-top: 0;
			background: var(--menu-fond);
		}
		nav a {
			flex: none;
			min-height: 46px;
			flex-direction: row;
			justify-content: flex-start;
			gap: var(--espace-12);
			padding: 0 var(--espace-16);
			border-radius: var(--rayon-bouton);
			font-size: var(--texte-16);
			font-weight: 500;
		}
		nav a[aria-current='page'] {
			background: var(--menu-actif);
			color: var(--encre);
			font-weight: 700;
		}
		nav a[aria-current='page']::before {
			display: none;
		}
		nav .nombre {
			border-color: var(--menu-fond);
		}
		main {
			grid-area: contenu;
			padding-bottom: 1.5rem;
		}
	}
</style>
