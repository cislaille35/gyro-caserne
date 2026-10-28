<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		titre,
		resume,
		ouvert = $bindable(false),
		niveauTitre = 2,
		couleur,
		alerte = false,
		children
	}: { titre: string; resume?: string; ouvert?: boolean; niveauTitre?: 2 | 3; couleur?: string; alerte?: boolean; children: Snippet } = $props();
	const id = $props.id();
</script>

<section class="groupe" style:border-left={couleur ? `6px solid ${couleur}` : undefined}>
	<svelte:element this={`h${niveauTitre}`} class="entete">
		<button type="button" aria-expanded={ouvert ? 'true' : 'false'} aria-controls={id} onclick={() => (ouvert = !ouvert)}>
			<span class="textes">
				<span class="titre">{titre}</span>
				{#if resume}<span class="resume" class:alerte>{resume}</span>{/if}
			</span>
			<span class="chevron" aria-hidden="true">›</span>
		</button>
	</svelte:element>
	<div {id} class="contenu" hidden={!ouvert}>{@render children()}</div>
</section>

<style>
	.groupe {
		background: var(--surface);
		border: 1px solid var(--trait-doux);
		border-radius: var(--rayon-grand);
		overflow: hidden;
	}
	.entete {
		margin: 0;
		font: inherit;
	}
	button {
		width: 100%;
		min-height: 56px;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 14px;
		border: none;
		background: none;
		color: var(--encre);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	button:focus-visible {
		outline-offset: -3px;
	}
	.textes {
		flex: 1;
		display: flex;
		flex-direction: column;
	}
	.titre {
		font: 700 1.25rem var(--police-titre);
	}
	.resume {
		font-size: 0.875rem;
		color: var(--doux);
	}
	.resume.alerte {
		color: var(--statut-alerte-texte);
		font-weight: 600;
	}
	.chevron {
		font-size: 1.25rem;
		color: var(--doux);
		transition: transform 0.15s;
	}
	[aria-expanded='true'] .chevron {
		transform: rotate(90deg);
	}
	.contenu {
		border-top: 1px solid var(--trait-doux);
	}
</style>
