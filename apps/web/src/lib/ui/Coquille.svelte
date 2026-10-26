<script lang="ts">
	import type { Snippet } from 'svelte';
	import { entreesNavigation } from './navigation.ts';

	let {
		chemin,
		connecte,
		nomCentre,
		children
	}: { chemin: string; connecte: boolean; nomCentre: string; children: Snippet } = $props();

	const entrees = $derived(entreesNavigation(connecte));

	const dessins: Record<string, string> = {
		accueil: 'M3 10.5 12 3l9 7.5V21H3z M9 21v-6h6v6',
		connexion: 'M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4 M10 17l5-5-5-5 M15 12H3',
		affichage: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.5 1.5 M17.5 17.5 19 19 M5 19l1.5-1.5 M17.5 6.5 19 5'
	};
</script>

<a class="evitement" href="#contenu">Aller au contenu</a>

<div class="coquille">
	<header>
		<span class="appli">Gyro Caserne</span>
		<span class="centre">{nomCentre}</span>
	</header>

	<nav aria-label="Navigation principale">
		{#each entrees as entree (entree.href)}
			<a href={entree.href} aria-current={chemin === entree.href ? 'page' : undefined}>
				<svg
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d={dessins[entree.icone]}></path>
				</svg>
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
		flex-direction: column;
		padding: 0.75rem 1rem;
		background: var(--surface);
		border-bottom: 1px solid var(--trait);
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
			grid-template-columns: 16rem 1fr;
			grid-template-rows: auto 1fr;
			grid-template-areas:
				'menu entete'
				'menu contenu';
		}
		header {
			grid-area: entete;
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
