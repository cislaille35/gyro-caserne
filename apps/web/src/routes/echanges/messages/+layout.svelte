<script lang="ts">
	import { page } from '$app/state';
	import ListeConversations from '#lib/messagerie/ListeConversations.svelte';
	import { lireNonLus } from '#lib/messagerie/pastille.ts';
	import FiltresEchanges from '#lib/ui/FiltresEchanges.svelte';

	let { data, children } = $props();

	const nonLus = lireNonLus();
	const actif = $derived(page.params.id ? Number(page.params.id) : null);
</script>

<!-- À l'ordinateur, dans une conversation : la liste à gauche, la conversation au centre (les infos à droite, par la page).
     La liste vient d'abord, à l'écran comme au clavier. Au téléphone, la conversation seule. -->
{#if data.conversations}
	<div class="cadre">
		<nav class="liste" aria-label="Conversations">
			<div class="entete">
				<!-- Pas de titre ici : celui de la conversation (h1) vient en premier. -->
				<p class="titre">Échanges</p>
				<a class="crayon" href="/echanges/messages/nouveau" aria-label="Nouveau message"
					><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
						><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></svg
					></a
				>
			</div>
			<FiltresEchanges actif="messages" nonLus={nonLus.nombre} />
			<ListeConversations conversations={data.conversations} breve {actif} />
		</nav>
		<div class="contenu">{@render children()}</div>
	</div>
{:else}
	{@render children()}
{/if}

<style>
	.liste {
		display: none;
	}
	@media (min-width: 1024px) {
		/* Toute la place de la page, comme la conversation seule. */
		.cadre {
			margin: -1rem -1rem -1.5rem;
			display: grid;
			grid-template-columns: 19rem minmax(0, 1fr);
		}
		.liste {
			position: sticky;
			top: 0;
			align-self: start;
			max-height: 100dvh;
			overflow-y: auto;
			display: flex;
			flex-direction: column;
			gap: 12px;
			padding: 16px 12px 16px 16px;
			border-right: 1px solid var(--trait-doux);
			background: color-mix(in srgb, var(--surface) 50%, var(--fond));
		}
		.contenu {
			min-width: 0;
		}
		/* La conversation n'a plus à déborder : la place lui est faite ici. */
		.contenu :global(.conversation) {
			margin: 0;
		}
		.entete {
			display: flex;
			align-items: center;
			gap: 8px;
		}
		.titre {
			flex: 1;
			margin: 0;
			font: 700 1.625rem/1.1 var(--police-titre);
		}
		.crayon {
			flex: none;
			width: var(--cible);
			height: var(--cible);
			border-radius: 14px;
			display: flex;
			align-items: center;
			justify-content: center;
			background: var(--rouge);
			color: var(--sur-rouge);
		}
		.crayon:hover {
			background: color-mix(in srgb, var(--rouge) 88%, black);
			color: var(--sur-rouge);
		}
	}
	@media (min-width: 1280px) {
		.cadre {
			grid-template-columns: 18rem minmax(0, 1fr);
		}
	}
</style>
