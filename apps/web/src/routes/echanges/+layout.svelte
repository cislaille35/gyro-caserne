<script lang="ts">
	import { page } from '$app/state';
	import Pastille from '#lib/ui/Pastille.svelte';
	import Vide from '#lib/ui/Vide.svelte';

	let { data, children } = $props();

	// Sur un mur : au téléphone, la liste laisse la place au mur ; à l'ordinateur, elle reste à gauche.
	const actif = $derived(page.params.mur);
	const SORTES = { centre: null, vie: null, equipe: 'Équipe', comite: 'Comité' } as const;
	const nouveautes = (n: number) => `${n} nouveauté${n > 1 ? 's' : ''}`;
</script>

<div class="echanges" class:sur-un-mur={actif !== undefined}>
	<nav class="murs" aria-labelledby="titre-murs">
		<svelte:element this={actif ? 'h2' : 'h1'} id="titre-murs">Échanges</svelte:element>
		{#if data.murs.length === 0}
			<Vide texte="Vous n’avez accès à aucun mur." />
		{:else}
			<ul>
				{#each data.murs as m (m.cle)}
					<li>
						<a href="/echanges/{m.cle}" aria-current={m.cle === actif ? 'page' : undefined}>
							<span class="nom">{m.nom}</span>
							<span class="details">
								{#if SORTES[m.type]}<span class="sorte">{SORTES[m.type]}</span>{/if}
								{#if m.lectureSeule}<Pastille ton="neutre">Lecture seule</Pastille>{/if}
								{#if m.nouveautes > 0 && m.cle !== actif}<Pastille ton="info">{nouveautes(m.nouveautes)}</Pastille>{/if}
							</span>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</nav>
	<div class="mur">{@render children()}</div>
</div>

<style>
	.echanges {
		display: grid;
		gap: 1rem;
	}
	h1,
	h2 {
		margin: 0 0 12px;
		font: 700 1.75rem var(--police-titre);
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	a {
		min-height: 56px;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 2px;
		padding: 8px 14px;
		background: var(--surface);
		border: 1px solid var(--trait-doux);
		border-radius: var(--rayon-grand);
		color: var(--encre);
		text-decoration: none;
	}
	a[aria-current='page'] {
		box-shadow: inset 4px 0 0 var(--accent);
		font-weight: 700;
	}
	.nom {
		font-weight: 600;
		font-size: 1.0625rem;
	}
	.details {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
	}
	.sorte {
		color: var(--doux);
		font-size: 0.9375rem;
	}
	/* Téléphone : la liste seule, ou le mur seul. */
	.sur-un-mur .murs {
		display: none;
	}
	.echanges:not(.sur-un-mur) .mur {
		display: none;
	}
	@media (min-width: 1024px) {
		.echanges {
			grid-template-columns: 18rem minmax(0, 1fr);
			align-items: start;
			gap: 1.5rem;
		}
		.sur-un-mur .murs,
		.echanges:not(.sur-un-mur) .mur {
			display: block;
		}
		.murs {
			position: sticky;
			top: 1rem;
		}
	}
</style>
