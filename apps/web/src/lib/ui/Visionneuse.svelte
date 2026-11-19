<script lang="ts">
	import { pushState } from '$app/navigation';
	import { page } from '$app/state';
	import { photoVisee } from './visionneuse.ts';

	// Une photo en grand, sans quitter la page (l'appli installée sur iPhone n'a pas de retour). Posée une fois dans la racine :
	// un appui sur un lien marqué `data-visionneuse` l'ouvre. Sans JavaScript, le lien mène à la photo.
	// L'ouverture ajoute un pas à l'historique : le retour du téléphone la ferme, et chaque fermeture revient de ce pas.
	let fenetre: HTMLDialogElement;
	let cadre: HTMLDivElement;
	let origine: HTMLElement | null = null;
	const photo = $derived(page.state.photo ?? null);

	// Avant SvelteKit (phase de capture) : le lien ne doit pas être suivi.
	const appui = (e: MouseEvent) => {
		const vue = photoVisee(e);
		if (!vue) return;
		e.preventDefault();
		origine = vue.lien as unknown as HTMLElement;
		pushState('', { photo: { src: vue.src, alt: vue.alt } });
	};
	$effect(() => {
		if (photo && !fenetre.open) fenetre.showModal();
		else if (!photo && fenetre.open) fenetre.close();
	});
	const fermer = () => {
		if (page.state.photo) history.back();
		else fenetre.close();
	};
	// Échap : on passe aussi par l'historique.
	const annuler = (e: Event) => {
		e.preventDefault();
		fermer();
	};
	// Un appui hors de la photo ferme.
	const toucher = (e: MouseEvent) => {
		if (e.target === fenetre || e.target === cadre) fermer();
	};
	const fermee = () => {
		origine?.focus();
		origine = null;
	};
</script>

<svelte:document onclickcapture={appui} />

<!-- Le clic vise le fond ; au clavier, Échap ou « Fermer ». -->
<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
<dialog class="visionneuse" aria-label="Photo en grand" bind:this={fenetre} oncancel={annuler} onclose={fermee} onclick={toucher}>
	<button type="button" class="fermer" onclick={fermer}
		><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg><span class="masque">Fermer</span></button
	>
	<div class="cadre" bind:this={cadre}>
		{#if photo}<img src={photo.src} alt={photo.alt} />{/if}
	</div>
</dialog>

<style>
	.visionneuse {
		position: fixed;
		inset: 0;
		width: 100vw;
		height: 100dvh;
		max-width: none;
		max-height: none;
		margin: 0;
		padding: 0;
		border: none;
		background: var(--fond-photo);
		color: #ffffff;
	}
	.visionneuse:not([open]) {
		display: none;
	}
	.visionneuse::backdrop {
		background: var(--fond-photo);
	}
	.cadre {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: calc(var(--cible) + var(--espace-16) + env(safe-area-inset-top)) var(--espace-8) calc(var(--espace-16) + env(safe-area-inset-bottom));
		box-sizing: border-box;
	}
	img {
		display: block;
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}
	.fermer {
		position: absolute;
		top: calc(var(--espace-8) + env(safe-area-inset-top));
		right: var(--espace-8);
		width: var(--cible);
		height: var(--cible);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: 1px solid color-mix(in srgb, #ffffff 40%, transparent);
		border-radius: var(--rayon-bouton);
		background: color-mix(in srgb, #000000 50%, transparent);
		color: #ffffff;
	}
	.fermer:focus-visible {
		outline: 3px solid var(--entete-focus);
		outline-offset: 2px;
	}
</style>
