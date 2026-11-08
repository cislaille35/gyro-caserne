<script lang="ts">
	import { DESSINS } from './icones-roles.ts';

	// Champ de recherche à loupe, dans un formulaire GET : libellé lu, aide reliée au champ, la loupe envoie le formulaire.
	// `bouton` : le nom et la valeur que la loupe envoie (le filtre en cours, par exemple).
	let {
		id,
		name,
		valeur,
		libelle,
		aide,
		bouton,
		oninput
	}: { id: string; name: string; valeur: string; libelle: string; aide: string; bouton?: { name: string; value: string }; oninput?: (valeur: string) => void } = $props();
</script>

<div class="recherche">
	<label for={id} class="masque">{libelle}</label>
	<button type="submit" class="loupe" name={bouton?.name} value={bouton?.value}
		><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d={DESSINS.loupe} /></svg><span class="masque"
			>Rechercher</span
		></button
	>
	<input {id} type="search" {name} value={valeur} placeholder={aide} aria-describedby="{id}-aide" autocomplete="off" oninput={(e) => oninput?.(e.currentTarget.value)} />
	<p id="{id}-aide" class="masque">{aide}</p>
</div>

<style>
	.recherche {
		position: relative;
		display: flex;
	}
	input {
		flex: 1;
		min-width: 0;
		min-height: 48px;
		padding: 0 var(--espace-16) 0 var(--espace-48);
		background: var(--surface);
		color: var(--encre);
		font: 400 var(--texte-16) var(--police);
	}
	input::placeholder {
		color: var(--doux);
	}
	@media (hover: hover) and (pointer: fine) {
		input:hover {
			border-color: var(--doux);
		}
	}
	.loupe {
		position: absolute;
		left: 2px;
		top: 2px;
		width: 44px;
		height: 44px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 0;
		border-radius: var(--rayon-bouton);
		background: none;
		color: var(--doux);
		cursor: pointer;
	}
	@media (hover: hover) and (pointer: fine) {
		.loupe:hover {
			color: var(--encre);
		}
	}
</style>
