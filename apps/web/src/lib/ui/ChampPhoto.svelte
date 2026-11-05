<script lang="ts">
	import { onMount } from 'svelte';
	import { DESSINS } from './icones-roles.ts';

	// Choisir une ou des photos : le champ natif reste (clavier, lecteur d'écran), un bouton écrit le remplace à l'œil.
	// Sans JavaScript, le champ natif s'affiche : il dit lui-même ce qui est choisi.
	let {
		id,
		name,
		libelle,
		precision,
		aide,
		appel = 'Ajouter une photo',
		accept = 'image/*',
		capture,
		multiple = false,
		erreur,
		champ = $bindable()
	}: { id: string; name: string; libelle: string; precision?: string; aide?: string; appel?: string; accept?: string; capture?: 'environment'; multiple?: boolean; erreur?: string; champ?: HTMLInputElement } = $props();

	let js = $state(false);
	let choisi = $state('');
	const decrit = $derived([aide && `${id}-aide`, erreur && `${id}-erreur`].filter(Boolean).join(' ') || undefined);
	const lire = () => {
		const fichiers = champ?.files ?? [];
		choisi = fichiers.length > 1 ? `${fichiers.length} photos` : (fichiers[0]?.name ?? '');
	};
	const retirer = () => {
		if (!champ) return;
		champ.value = '';
		choisi = '';
		champ.focus();
	};
	onMount(() => {
		js = true;
		const formulaire = champ?.form;
		const vider = () => (choisi = '');
		formulaire?.addEventListener('reset', vider);
		return () => formulaire?.removeEventListener('reset', vider);
	});
</script>

<div class="champ" class:js>
	<label class="titre" for={id}>{libelle}{#if precision}{' '}<span class="doux">{precision}</span>{/if}</label>
	{#if aide}<p id="{id}-aide" class="aide">{aide}</p>{/if}
	<input bind:this={champ} class="fichier" {id} {name} type="file" {accept} {capture} {multiple} aria-invalid={erreur ? 'true' : undefined} aria-describedby={decrit} onchange={lire} />
	<div class="ligne" hidden={!js}>
		<label class="zone" for={id}
			><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d={DESSINS.photo} /></svg><span class="texte">{choisi || appel}</span></label
		>
		{#if choisi}<button type="button" class="retirer" onclick={retirer}>Retirer<span class="masque">{` : ${choisi}`}</span></button>{/if}
	</div>
	{#if erreur}<p id="{id}-erreur" class="erreur">{erreur}</p>{/if}
</div>

<style>
	p {
		margin: 0;
	}
	.champ {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.titre {
		font-weight: 700;
	}
	.doux {
		color: var(--doux);
		font-weight: 400;
	}
	.aide {
		color: var(--doux);
		font-size: 0.875rem;
	}
	.erreur {
		color: var(--accent);
		font-weight: 600;
		font-size: 0.9375rem;
	}
	/* Sans JavaScript : le champ natif, à la bonne taille. */
	.fichier {
		min-height: var(--cible);
		font: inherit;
	}
	/* Avec : masqué à l'œil, toujours atteignable ; le bouton écrit montre le focus. */
	.js .fichier {
		position: absolute;
		width: 1px;
		height: 1px;
		min-height: 0;
		opacity: 0;
	}
	.ligne {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 8px;
	}
	.ligne[hidden] {
		display: none;
	}
	.zone {
		min-width: 0;
		max-width: 100%;
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 0 16px 0 12px;
		border: 1px solid var(--trait);
		border-radius: 999px;
		background: var(--surface);
		color: var(--encre);
		font-weight: 600;
		cursor: pointer;
	}
	.zone:hover {
		border-color: var(--encre);
	}
	.zone svg {
		flex: none;
	}
	.texte {
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.fichier:focus-visible ~ .ligne .zone {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}
	.fichier[aria-invalid='true'] ~ .ligne .zone {
		border: 2px solid var(--accent);
	}
	.retirer {
		min-height: var(--cible);
		padding: 0 8px;
		border: 0;
		background: none;
		color: var(--encre);
		font: 600 0.9375rem var(--police);
		text-decoration: underline;
		cursor: pointer;
	}
</style>
