<script lang="ts">
	import { page } from '$app/state';
	import Retour from '#lib/ui/Retour.svelte';
	import ListeReglages from './ListeReglages.svelte';

	let { data, children } = $props();

	// Sur une page de réglage, la liste reste à côté sur ordinateur ; au téléphone, un lien y ramène.
	const enfant = $derived(page.url.pathname !== '/reglages');
</script>

<svelte:head>
	<!-- Sans JavaScript, les groupes ne se replient pas : tout reste visible. -->
	<noscript><style>.groupe > [hidden] { display: block !important; } .groupe .chevron { display: none; }</style></noscript>
</svelte:head>

<div class="reglages" class:enfant>
	{#if enfant}
		<nav class="cote" aria-label="Réglages du centre">
			<ListeReglages {data} niveauTitre={2} />
		</nav>
	{/if}
	<div class="principal">
		{#if enfant}<div class="retour"><Retour href="/reglages" libelle="Réglages" /></div>{/if}
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
		display: flex;
		margin-bottom: -12px;
	}
	@media (min-width: 1024px) {
		.cote {
			display: block;
			flex: 0 1 400px;
			position: sticky;
			top: 16px;
		}
		.enfant .retour {
			display: none;
		}
	}
</style>
