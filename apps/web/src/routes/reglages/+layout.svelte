<script lang="ts">
	import { page } from '$app/state';
	import Retour from '#lib/ui/Retour.svelte';
	import { DESSINS } from '#lib/ui/icones-roles.ts';
	import ListeReglages from './ListeReglages.svelte';

	let { data, children } = $props();

	// Sur une page de réglage, la liste reste à côté sur ordinateur ; au téléphone, un lien y ramène.
	const enfant = $derived(page.url.pathname !== '/reglages');
</script>

<svelte:head>
	<!-- Sans JavaScript, les groupes ne se replient pas : tout reste visible. -->
	<noscript><style>.groupe > [hidden] { display: block !important; } .groupe .chevron { display: none; }</style></noscript>
</svelte:head>

{#snippet creer(href: string, libelle: string)}
	<a class="lien-secondaire" {href}
		><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d={DESSINS.plus} /></svg>{libelle}</a
	>
{/snippet}

<div class="reglages" class:enfant>
	{#if enfant}
		<nav class="cote" aria-label="Réglages du centre">
			<!-- Les créations restent à portée depuis une page de réglage, avec les mêmes droits que la page Réglages. -->
			{#if data.responsabilites || data.comites}
				<div class="creer">
					{#if data.responsabilites}{@render creer('/reglages/roles/nouveau', 'Nouveau rôle')}{/if}
					{#if data.comites}{@render creer('/reglages/comites/nouveau', 'Nouveau comité')}{/if}
				</div>
			{/if}
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
		gap: var(--espace-24);
		align-items: flex-start;
	}
	.cote {
		display: none;
	}
	.creer {
		display: flex;
		flex-wrap: wrap;
		gap: var(--espace-8);
		margin-bottom: var(--espace-20);
	}
	.principal {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
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
