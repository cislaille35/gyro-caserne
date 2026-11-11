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
		// Ce qui l'a ouvert : l'élément qui a le focus, sinon un lien vers cette adresse. Retrouvé à la fermeture, la page ayant pu être redessinée.
		const actif = document.activeElement;
		const adresse = actif instanceof HTMLAnchorElement && !fenetre.contains(actif) ? actif.href : location.href;
		if (fenetre.open) fenetre.close();
		fenetre.showModal();
		tete.focus();
		return () => {
			setTimeout(() => {
				if (document.activeElement !== document.body && document.activeElement !== null) return;
				[...document.querySelectorAll<HTMLAnchorElement>('a[href]')].find((a) => a.href === adresse && a.checkVisibility())?.focus();
			});
		};
	});
	// Échap ferme, sauf pendant une saisie : il ne doit pas perdre ce qui a été tapé.
	const touche = (e: KeyboardEvent) => {
		if (e.key === 'Escape' && (e.target as HTMLElement).closest('input, textarea, select')) e.preventDefault();
	};
	const annuler = (e: Event) => {
		e.preventDefault();
		sortir();
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

<a class="voile" href={fermer} tabindex="-1" aria-hidden="true" data-sveltekit-reset="false"></a>
<!-- Le clic vise le voile ; au clavier, Échap ferme. -->
<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
<dialog class="panneau" open aria-labelledby={id} bind:this={fenetre} onkeydown={touche} oncancel={annuler} onclose={fermee} onclick={toucher}>
	<div class="tete">
		<h2 {id} tabindex="-1" bind:this={tete}>{titre}</h2>
		<a class="fermer" href={fermer} data-sveltekit-reset="false"
			><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg><span class="masque">Fermer</span></a
		>
	</div>
	<div class="corps">{@render children()}</div>
</dialog>

<style>
	/* Le panneau glisse depuis son bord, le voile apparaît ; rien si le mouvement est réduit. */
	@media (prefers-reduced-motion: no-preference) {
		.panneau {
			transition: transform var(--duree-panneau) var(--courbe-tiroir);
			@starting-style {
				transform: translateY(100%);
			}
		}
		.voile {
			transition: opacity var(--duree-panneau) var(--courbe-sortie);
			@starting-style {
				opacity: 0;
			}
		}
		@media (min-width: 1024px) {
			.panneau {
				@starting-style {
					transform: translateX(100%);
				}
			}
		}
	}
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
		border-radius: var(--rayon-grand) var(--rayon-grand) 0 0;
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
		gap: var(--espace-12);
		padding: var(--espace-16) var(--espace-16) var(--espace-12);
		border-bottom: 1px solid var(--trait-doux);
	}
	h2 {
		flex: 1;
		margin: 0;
		font: 700 var(--texte-20) var(--police-titre);
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
		border-radius: var(--rayon-bouton);
		border: 1px solid var(--trait);
		background: var(--surface);
		color: var(--encre);
	}
	.corps {
		overflow: auto;
		padding: var(--espace-16) var(--espace-16) calc(var(--espace-16) + env(safe-area-inset-bottom));
	}
	@media (min-width: 1024px) {
		.panneau {
			inset: 0 0 0 auto;
			height: auto;
			width: min(30rem, 100vw);
			max-height: none;
			border-radius: var(--rayon-grand) 0 0 var(--rayon-grand);
			box-shadow: -8px 0 30px color-mix(in srgb, #000 25%, transparent);
		}
	}
</style>
