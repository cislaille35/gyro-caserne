<script lang="ts">
	import { onMount } from 'svelte';
	import { DESSINS } from './icones-roles.ts';

	// Choisir une ou des photos, ou un fichier à importer : le champ natif reste (clavier, lecteur d'écran), invisible par-dessus un bouton écrit.
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
		desactive = false,
		onchange,
		icone = 'photo',
		champ = $bindable()
	}: { desactive?: boolean; onchange?: () => void; icone?: 'photo' | 'fichier'; id: string; name?: string; libelle: string; precision?: string; aide?: string; appel?: string; accept?: string; capture?: 'environment'; multiple?: boolean; erreur?: string; champ?: HTMLInputElement } = $props();

	let js = $state(false);
	let choisi = $state('');
	const decrit = $derived([aide && `${id}-aide`, erreur && `${id}-erreur`].filter(Boolean).join(' ') || undefined);
	// Un fichier à importer : l'écran montre lui-même la suite (aperçu, erreur) et vide le champ.
	const lire = () => {
		if (icone === 'fichier') return;
		const fichiers = champ?.files ?? [];
		choisi = fichiers.length > 1 ? `${fichiers.length} photos` : (fichiers[0]?.name ?? '');
	};
	const retirer = () => {
		if (!champ) return;
		champ.value = '';
		choisi = '';
		champ.focus();
	};
	onMount(() => (js = true));
</script>

<div class="champ" class:js>
	<label class="titre" for={id}>{libelle}{#if precision}{' '}<span class="doux">{precision}</span>{/if}</label>
	{#if aide}<p id="{id}-aide" class="aide">{aide}</p>{/if}
	<div class="ligne">
		<span class="zone">
			{#if js}<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d={icone === 'fichier' ? DESSINS.fichier : DESSINS.photo} /></svg><span class="texte">{choisi || appel}</span>{/if}
			<input bind:this={champ} {id} {name} type="file" {accept} {capture} {multiple} aria-invalid={erreur ? 'true' : undefined} aria-describedby={decrit} disabled={desactive} onchange={() => { lire(); onchange?.(); }} />
		</span>
		{#if choisi}<button type="button" class="retirer" onclick={retirer}>Retirer<span class="masque">{` : ${choisi}`}</span></button>{/if}
	</div>
	{#if erreur}<p id="{id}-erreur" class="erreur">{erreur}</p>{/if}
</div>

<style>
	p {
		margin: 0;
	}
	.champ {
		display: flex;
		flex-direction: column;
		gap: var(--espace-6);
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
		font-size: var(--texte-14);
	}
	.erreur {
		color: var(--accent);
		font-weight: 600;
		font-size: var(--texte-15);
	}
	.ligne {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--espace-4) var(--espace-8);
	}
	.zone {
		min-width: 0;
		max-width: 100%;
	}
	/* Sans JavaScript : le champ natif, à la bonne taille. */
	input {
		min-height: var(--cible);
		font: inherit;
	}
	.js .zone {
		position: relative;
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		gap: var(--espace-8);
		padding: 0 var(--espace-16) 0 var(--espace-12);
		border: 1px solid var(--trait);
		border-radius: var(--rayon-bouton);
		background: var(--surface);
		color: var(--encre);
		font-weight: 600;
	}
	.js .zone:has(input:disabled) {
		opacity: 0.6;
	}
	.js .zone:has(input:disabled) input {
		cursor: not-allowed;
	}
	.js .zone:hover {
		border-color: var(--encre);
	}
	/* Toute la zone est le champ ; c'est elle qui montre le focus. */
	.js input {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		opacity: 0;
		cursor: pointer;
	}
	.js .zone:has(input:focus-visible) {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}
	.js .zone:has(input[aria-invalid='true']) {
		border: 2px solid var(--accent);
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
	.retirer {
		min-height: var(--cible);
		padding: 0 var(--espace-8);
		border: 0;
		background: none;
		color: var(--encre);
		font: 600 var(--texte-15) var(--police);
		text-decoration: underline;
		cursor: pointer;
	}
</style>
