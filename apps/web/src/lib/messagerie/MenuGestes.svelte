<script module lang="ts">
	export type Geste = 'repondre' | 'copier' | 'modifier' | 'supprimer' | 'signaler';
</script>

<script lang="ts">
	import { REACTIONS } from '@gyro-caserne/socle';
	import { onMount } from 'svelte';

	let {
		id,
		etiquette,
		reactions,
		maReaction,
		gestes,
		choisir,
		reagir,
		fermer
	}: {
		id: string;
		// L'id du bouton « ⋯ » qui ouvre le menu.
		etiquette: string;
		reactions: boolean;
		maReaction: string | null;
		gestes: Geste[];
		choisir: (geste: Geste) => void;
		reagir: (emoji: string) => void;
		// `rendreFocus` : au bouton « ⋯ » (Échap, Tab).
		fermer: (rendreFocus: boolean) => void;
	} = $props();

	const LIBELLES: Record<Geste, string> = { repondre: 'Répondre', copier: 'Copier le texte', modifier: 'Modifier', supprimer: 'Supprimer', signaler: 'Signaler' };

	let menu: HTMLElement;
	const elements = () => [...menu.querySelectorAll<HTMLElement>('[role^="menuitem"]')];
	onMount(() => {
		elements()[0]?.focus();
		menu.scrollIntoView?.({ block: 'nearest' });
	});

	// Flèches pour aller d'un geste à l'autre (en boucle), Début et Fin, Échap ou Tab pour fermer.
	function clavier(e: KeyboardEvent) {
		const liste = elements();
		const i = liste.indexOf(document.activeElement as HTMLElement);
		const aller = (j: number) => liste[(j + liste.length) % liste.length]?.focus();
		if (e.key === 'ArrowDown' || e.key === 'ArrowRight') aller(i + 1);
		else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') aller(i - 1);
		else if (e.key === 'Home') aller(0);
		else if (e.key === 'End') aller(liste.length - 1);
		else if (e.key === 'Escape' || e.key === 'Tab') fermer(true);
		else return;
		e.preventDefault();
	}
</script>

<!-- svelte-ignore a11y_interactive_supports_focus -->
<div class="menu" role="menu" {id} aria-labelledby={etiquette} tabindex="-1" bind:this={menu} onkeydown={clavier}>
	{#if reactions}
		<div class="reactions" role="group" aria-label="Réagir">
			{#each REACTIONS as emoji (emoji)}
				<button type="button" role="menuitemradio" tabindex="-1" class="reaction" aria-checked={maReaction === emoji} aria-label="Réagir : {emoji}" onclick={() => reagir(emoji)}>{emoji}</button>
			{/each}
		</div>
	{/if}
	{#each gestes as g (g)}
		<button type="button" role="menuitem" tabindex="-1" class="geste" class:danger={g === 'supprimer' || g === 'signaler'} onclick={() => choisir(g)}>{LIBELLES[g]}</button>
	{/each}
</div>

<style>
	.menu {
		position: absolute;
		z-index: 6;
		top: calc(100% + 4px);
		min-width: 14rem;
		padding: 6px;
		display: flex;
		flex-direction: column;
		border: 1px solid var(--trait);
		border-radius: var(--rayon-grand);
		background: var(--surface);
		box-shadow: 0 8px 24px color-mix(in srgb, var(--encre) 18%, transparent);
	}
	.reactions {
		display: flex;
		justify-content: space-between;
		gap: 2px;
		padding-bottom: 6px;
		margin-bottom: 4px;
		border-bottom: 1px solid var(--trait-doux);
	}
	.reaction {
		width: var(--cible);
		height: var(--cible);
		border: 0;
		border-radius: 50%;
		background: none;
		font-size: 1.375rem;
		cursor: pointer;
	}
	.reaction[aria-checked='true'] {
		background: var(--statut-info-fond);
		box-shadow: inset 0 0 0 2px var(--statut-info-texte);
	}
	.geste {
		min-height: var(--cible);
		padding: 0 12px;
		border: 0;
		border-radius: var(--rayon-petit);
		background: none;
		color: var(--encre);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.reaction:hover,
	.geste:hover {
		background: var(--fond);
	}
	.danger {
		color: var(--statut-danger-texte);
	}
</style>
