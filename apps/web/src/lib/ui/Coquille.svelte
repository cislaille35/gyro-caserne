<script lang="ts">
	import type { Snippet } from 'svelte';
	import { entreesNavigation, rubriqueDe } from './navigation.ts';

	let { chemin, connecte, nomCentre, cloche = 0, children }: { chemin: string; connecte: boolean; nomCentre: string; cloche?: number; children: Snippet } = $props();

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
		echanges: 'M4 5h16v11H8l-4 4z',
		connexion: 'M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4 M10 17l5-5-5-5 M15 12H3',
		affichage: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.5 1.5 M17.5 17.5 19 19 M5 19l1.5-1.5 M17.5 6.5 19 5',
		cloche: 'M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z M10 20a2 2 0 0 0 4 0',
		moi: 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1'
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
			<a href={entree.href} aria-current={courant(entree.href)}>
				{@render icone(entree.icone)}
				<span>{entree.libelle}</span>
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
			border-right: 1px solid var(--trait);
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
