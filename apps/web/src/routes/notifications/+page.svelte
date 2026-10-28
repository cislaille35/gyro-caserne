<script lang="ts">
	import Vide from '#lib/ui/Vide.svelte';

	let { data } = $props();

	// Ce qu'il faut faire est écrit, pas seulement montré.
	const elements = $derived([
		...data.annonces.map((a) => ({ ...a, quoi: 'Annonce à prendre en compte' })),
		...data.evenements.map((e) => ({ ...e, quoi: e.demain ? 'Événement demain, à répondre' : 'Événement à répondre' })),
		...data.sondages.map((s) => ({ ...s, quoi: 'Sondage à répondre' }))
	]);
</script>

<svelte:head>
	<title>Notifications · Gyro Caserne</title>
</svelte:head>

<h1>Notifications</h1>
{#if elements.length > 0}
	<ul class="liste" role="list">
		{#each elements as e (`${e.quoi}:${e.id}`)}
			<li>
				<a class="ligne" href="/echanges/{e.cle}/{e.id}">
					<span class="texte"><span class="titre">{e.titre}</span><span class="doux">{e.quoi} · {e.nomMur}</span></span>
					<span aria-hidden="true">›</span>
				</a>
			</li>
		{/each}
	</ul>
{:else}
	<Vide texte="Rien de nouveau pour vous." />
{/if}

<style>
	h1 {
		margin: 0 0 16px;
	}
	.liste {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.ligne {
		min-height: var(--cible);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 10px 14px;
		background: var(--surface);
		border: 1px solid var(--trait-doux);
		border-radius: 12px;
		color: var(--encre);
		text-decoration: none;
	}
	.ligne:hover .titre {
		text-decoration: underline;
	}
	.texte {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.titre {
		font-weight: 700;
		overflow-wrap: anywhere;
	}
	.doux {
		color: var(--doux);
	}
</style>
