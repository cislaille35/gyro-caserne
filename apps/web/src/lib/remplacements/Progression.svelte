<script lang="ts">
	// « Étape 2 sur 3 » : les étapes faites sont des liens pour y revenir ; l'étape en cours est marquée (texte, pas seulement la couleur).
	let { etapes, courante, lien }: { etapes: { id: string; titre: string }[]; courante: string; lien: (id: string) => string } = $props();
	const index = $derived(etapes.findIndex((e) => e.id === courante));
</script>

<nav class="progression" aria-label="Étapes">
	<p class="ou">Étape {index + 1} sur {etapes.length}<span class="titre">{` · ${etapes[index]?.titre ?? ''}`}</span></p>
	<ol role="list">
		{#each etapes as e, i (e.id)}
			<li class:faite={i < index} class:courante={i === index}>
				{#if i < index}
					<a href={lien(e.id)}><span class="trait" aria-hidden="true"></span><span class="nom">{e.titre}<span class="masque">{' (faite, modifier)'}</span></span></a>
				{:else}
					<span aria-current={i === index ? 'step' : undefined}><span class="trait" aria-hidden="true"></span><span class="nom">{e.titre}</span></span>
				{/if}
			</li>
		{/each}
	</ol>
</nav>

<style>
	.progression {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.ou {
		margin: 0;
		font-weight: 700;
	}
	.titre {
		font-weight: 400;
		color: var(--doux);
	}
	ol {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		grid-auto-columns: 1fr;
		grid-auto-flow: column;
		gap: 6px;
	}
	li > a,
	li > span {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-height: var(--cible);
		color: var(--doux);
		font-size: 0.8125rem;
		font-weight: 600;
		line-height: 1.2;
		text-decoration: none;
	}
	li > a {
		color: var(--encre);
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.trait {
		height: 6px;
		border-radius: 3px;
		background: var(--trait-doux);
	}
	.faite .trait {
		background: var(--encre);
	}
	.courante .trait {
		background: var(--rouge);
	}
	.courante .nom {
		color: var(--encre);
	}
</style>
