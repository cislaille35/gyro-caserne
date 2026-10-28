<script lang="ts">
	import { page } from '$app/state';
	import ListeReglages from './ListeReglages.svelte';

	let { data, children } = $props();

	// Sur une page de réglage, la liste reste à côté sur ordinateur ; au téléphone, un lien y ramène.
	const enfant = $derived(page.url.pathname !== '/reglages');
</script>

<svelte:head>
	<!-- Sans JavaScript, les groupes ne se replient pas : tout reste visible. -->
	<noscript><style>.groupe > [hidden] { display: block !important; }</style></noscript>
</svelte:head>

<div class="reglages" class:enfant>
	{#if enfant}
		<nav class="cote" aria-label="Réglages du centre">
			<ListeReglages {data} niveauTitre={2} />
		</nav>
	{/if}
	<div class="principal">
		{#if enfant}<a class="retour" href="/reglages">‹ Réglages</a>{/if}
		{@render children()}
	</div>
</div>

<style>
	.reglages {
		display: flex;
		gap: 24px;
		align-items: flex-start;
	}
	.cote {
		display: none;
	}
	.principal {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.retour {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		min-height: var(--cible);
		color: var(--doux);
	}
	@media (min-width: 1024px) {
		.cote {
			display: block;
			flex: 0 1 380px;
			position: sticky;
			top: 16px;
		}
		.enfant .retour {
			display: none;
		}
	}
</style>
