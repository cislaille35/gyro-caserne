<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	// Un panneau par-dessus la page : feuille du bas au téléphone, panneau latéral à l'ordinateur.
	// Il s'ouvre et se ferme par l'adresse (liens). Rendu ouvert par le serveur (sans JavaScript), il devient une fenêtre modale :
	// le focus y entre et y reste, le reste de la page est inerte, Échap ferme, puis le focus revient à ce qui l'a ouvert.
	let { titre, fermer, children }: { titre: string; fermer: string; children: Snippet } = $props();
	const id = $props.id();
	let fenetre: HTMLDialogElement;
	let tete: HTMLHeadingElement;
	const sortir = () => goto(fermer, { reset: false });

	onMount(() => {
		// Ce qui l'a ouvert : l'élément qui a le focus, sinon le lien vers cette adresse.
		const actif = document.activeElement;
		const ouvreur =
			actif instanceof HTMLElement && actif !== document.body && !fenetre.contains(actif)
				? actif
				: [...document.querySelectorAll<HTMLAnchorElement>('a[href]')].find((a) => a.href === location.href && !fenetre.contains(a));
		if (fenetre.open) fenetre.close();
		fenetre.showModal();
		tete.focus();
		return () => {
			setTimeout(() => {
				if (ouvreur?.isConnected && (document.activeElement === document.body || document.activeElement === null)) ouvreur.focus();
			});
		};
	});
	// Pas pendant une saisie : Échap ne doit pas perdre ce qui a été tapé.
	const annuler = (e: Event) => {
		e.preventDefault();
		if (!document.activeElement?.closest('input, textarea, select')) sortir();
	};
	// Fermée par le navigateur (sans passer par « annuler ») : l'adresse suit.
	const fermee = () => {
		if (!fenetre.open) sortir();
	};
	// Toucher le voile (hors du panneau) ferme.
	const toucher = (e: MouseEvent) => {
		if (e.target === fenetre) sortir();
	};
</script>

<a class="voile" href={fermer} tabindex="-1" aria-hidden="true" data-sveltekit-noscroll></a>
<!-- Le clic vise le voile ; au clavier, Échap ferme. -->
<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
<dialog class="panneau" open aria-labelledby={id} bind:this={fenetre} oncancel={annuler} onclose={fermee} onclick={toucher}>
	<div class="tete">
		<h2 {id} tabindex="-1" bind:this={tete}>{titre}</h2>
		<a class="fermer" href={fermer} data-sveltekit-reset="false"
			><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg><span class="masque">Fermer</span></a
		>
	</div>
	<div class="corps">{@render children()}</div>
</dialog>

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
		inset: auto 0 0;
		width: auto;
		max-width: none;
		margin: 0;
		padding: 0;
		border: none;
		color: var(--encre);
		max-height: 88dvh;
		display: flex;
		flex-direction: column;
		border-radius: 22px 22px 0 0;
		background: var(--fond);
		box-shadow: 0 -8px 30px color-mix(in srgb, #000 25%, transparent);
	}
	.panneau:not([open]) {
		display: none;
	}
	/* Le voile est déjà là, sous la fenêtre. */
	.panneau::backdrop {
		background: transparent;
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
			inset: 0 0 0 auto;
			height: auto;
			width: min(30rem, 100vw);
			max-height: none;
			border-radius: 22px 0 0 22px;
			box-shadow: -8px 0 30px color-mix(in srgb, #000 25%, transparent);
		}
	}
</style>
