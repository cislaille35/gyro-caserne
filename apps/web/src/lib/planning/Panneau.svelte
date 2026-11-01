<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	// Un panneau par-dessus la page : feuille du bas au téléphone, panneau latéral à l'ordinateur.
	// Il s'ouvre et se ferme par l'adresse (liens), le titre prend le focus, Échap ferme.
	let { titre, fermer, children }: { titre: string; fermer: string; children: Snippet } = $props();
	const id = $props.id();
	let tete: HTMLHeadingElement;

	onMount(() => tete.focus());
	const touche = (e: KeyboardEvent) => {
		// Pas pendant une saisie : Échap ne doit pas perdre ce qui a été tapé.
		const cible = e.target as HTMLElement | null;
		if (e.key === 'Escape' && !cible?.closest('input, textarea, select')) goto(fermer, { reset: false });
	};
</script>

<svelte:window onkeydown={touche} />

<a class="voile" href={fermer} tabindex="-1" aria-hidden="true" data-sveltekit-noscroll></a>
<section class="panneau" aria-labelledby={id}>
	<div class="tete">
		<h2 {id} tabindex="-1" bind:this={tete}>{titre}</h2>
		<a class="fermer" href={fermer} data-sveltekit-noscroll
			><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg><span class="masque">Fermer</span></a
		>
	</div>
	<div class="corps">{@render children()}</div>
</section>

<style>
	.voile {
		position: fixed;
		inset: 0;
		z-index: 40;
		background: color-mix(in srgb, #000 40%, transparent);
	}
	.panneau {
		position: fixed;
		z-index: 41;
		left: 0;
		right: 0;
		bottom: 0;
		max-height: 88dvh;
		display: flex;
		flex-direction: column;
		border-radius: 22px 22px 0 0;
		background: var(--fond);
		box-shadow: 0 -8px 30px color-mix(in srgb, #000 25%, transparent);
	}
	.tete {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 16px 10px;
		border-bottom: 1px solid var(--trait-doux);
	}
	h2 {
		flex: 1;
		margin: 0;
		font: 700 1.375rem var(--police-titre);
	}
	h2:focus {
		outline: none;
	}
	.fermer {
		width: var(--cible);
		height: var(--cible);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		border: 1px solid var(--trait);
		background: var(--surface);
		color: var(--encre);
	}
	.corps {
		overflow: auto;
		padding: 16px 16px calc(16px + env(safe-area-inset-bottom));
	}
	@media (min-width: 1024px) {
		.panneau {
			left: auto;
			top: 0;
			width: min(30rem, 100vw);
			max-height: none;
			border-radius: 22px 0 0 22px;
			box-shadow: -8px 0 30px color-mix(in srgb, #000 25%, transparent);
		}
	}
</style>
