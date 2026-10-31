<script lang="ts">
	import { DESSINS } from './icones-roles.ts';
	import type { Snippet } from 'svelte';
	import { entreesNavigation, rubriqueDe } from './navigation.ts';

	let {
		chemin,
		connecte,
		nomCentre,
		cloche = 0,
		nonLus = 0,
		children
	}: { chemin: string; connecte: boolean; nomCentre: string; cloche?: number; nonLus?: number; children: Snippet } = $props();

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
		caserne: 'M3 21V9l9-5 9 5v12 M9 21v-6h6v6',
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

<div class="coquille">
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
			<a class="moi" href="/moi" aria-current={courant('/moi')}>
				<span class="rond">{@render icone('moi')}</span>
				<span>Moi</span>
			</a>
		{/if}
	</header>

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
	header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		background: var(--surface);
		border-bottom: 1px solid var(--trait);
	}
	.titre {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	header a {
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--encre);
		text-decoration: none;
	}
	.rond {
		width: var(--cible);
		height: var(--cible);
		flex: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		border: 1px solid var(--trait-doux);
		background: var(--surface);
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
		padding: 0 5px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		border: 2px solid var(--surface);
		background: var(--rouge);
		color: var(--sur-rouge);
		font-size: 0.75rem;
		font-weight: 700;
		line-height: 1;
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
		padding-right: 0.25rem;
		font-weight: 600;
	}
	header a[aria-current='page'] {
		text-decoration: underline;
		text-underline-offset: 4px;
	}
	header a[aria-current='page'] .rond,
	header a.rond[aria-current='page'] {
		border: 2px solid var(--accent);
	}
	.appli {
		font-family: var(--police-titre);
		font-size: 1.4rem;
		font-weight: 700;
		text-transform: uppercase;
		line-height: 1.1;
	}
	.centre {
		color: var(--doux);
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
		border-top: 1px solid var(--trait);
	}
	nav a {
		flex: 1;
		min-height: 3.5rem;
		min-width: var(--cible);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.125rem;
		padding: 0.25rem;
		color: var(--doux);
		text-decoration: none;
		font-size: 0.875rem;
	}
	nav a[aria-current='page'] {
		color: var(--encre);
		font-weight: 700;
		box-shadow: inset 0 3px 0 var(--accent);
	}

	@media (min-width: 1024px) {
		.coquille {
			display: grid;
			grid-template-columns: 16rem minmax(0, 1fr);
			grid-template-rows: auto 1fr;
			grid-template-areas:
				'menu entete'
				'menu contenu';
			/* Le fond et le trait du menu descendent jusqu'en bas, même sur une page plus haute que l'écran. */
			background: linear-gradient(to right, var(--surface) calc(16rem - 1px), var(--trait) calc(16rem - 1px) 16rem, transparent 16rem);
		}
		header {
			grid-area: entete;
		}
		.titre {
			flex-direction: row;
			align-items: baseline;
			gap: 0.75rem;
		}
		nav {
			grid-area: menu;
			position: sticky;
			top: 0;
			height: 100dvh;
			flex-direction: column;
			gap: 0.25rem;
			padding: 1.5rem 1rem;
			border-top: 0;
			margin-right: 1px;
		}
		nav a {
			flex: none;
			flex-direction: row;
			justify-content: flex-start;
			gap: 0.75rem;
			padding: 0 0.75rem;
			font-size: 1rem;
			border-radius: var(--rayon-petit);
		}
		nav a[aria-current='page'] {
			background: var(--fond);
			box-shadow: inset 4px 0 0 var(--accent);
		}
		main {
			grid-area: contenu;
			padding-bottom: 1.5rem;
		}
	}
</style>
