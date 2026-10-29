<script lang="ts">
	import ListeConversations from '#lib/messagerie/ListeConversations.svelte';
	import FiltresEchanges from '#lib/ui/FiltresEchanges.svelte';
	import Vide from '#lib/ui/Vide.svelte';

	let { data } = $props();

	const total = $derived(data.conversations.reduce((n, c) => n + c.nonLus, 0));
</script>

<svelte:head>
	<title>Messages · Gyro Caserne</title>
</svelte:head>

<div class="messages">
	<header class="entete">
		<h1>Échanges</h1>
		<a class="crayon" href="/echanges/messages/nouveau" aria-label="Nouveau message">
			<svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
				><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></svg
			>
		</a>
	</header>

	<FiltresEchanges actif="messages" nonLus={total} />

	{#if data.conversations.length === 0}
		<Vide texte="Aucune conversation. Écrivez à un collègue avec le crayon." />
	{:else}
		<ListeConversations conversations={data.conversations} q={data.q} />
	{/if}
</div>

<style>
	.messages {
		max-width: 44rem;
		display: flex;
		flex-direction: column;
		gap: 12px;
		/* Le bouton crayon flotte au-dessus de la barre du bas : la fin de liste passe toujours au-dessus de lui. */
		padding-bottom: 5rem;
	}
	.entete {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	h1 {
		flex: 1;
		margin: 0;
		font: 700 1.875rem/1.1 var(--police-titre);
	}

	.crayon {
		position: fixed;
		right: 16px;
		bottom: calc(4.5rem + env(safe-area-inset-bottom));
		z-index: 10;
		width: 60px;
		height: 60px;
		border-radius: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--rouge);
		color: var(--sur-rouge);
		box-shadow: 0 6px 16px color-mix(in srgb, var(--rouge) 35%, transparent);
	}
	.crayon:hover {
		background: color-mix(in srgb, var(--rouge) 88%, black);
		color: var(--sur-rouge);
	}

	/* À l'ordinateur : le crayon prend place à côté du titre, rien ne flotte. */
	@media (min-width: 1024px) {
		.messages {
			padding-bottom: 0;
		}
		.crayon {
			position: static;
			width: 48px;
			height: 48px;
			border-radius: 16px;
		}
	}
</style>
