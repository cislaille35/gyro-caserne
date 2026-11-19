<script lang="ts">
	import Bouton from './Bouton.svelte';

	// Un interrupteur : une ligne pleine largeur, le libellé à gauche, la glissière à droite, comme les Réglages de l'iPhone.
	// Toute la ligne se touche. `envoyer` : dans un formulaire, la bascule l'envoie ; sans JavaScript, « Enregistrer » le fait.
	// Cochée, la case envoie `nom=1` ; décochée, rien.
	let {
		libelle,
		description,
		nom,
		coche = $bindable(false),
		envoyer = false
	}: { libelle: string; description?: string; nom?: string; coche?: boolean; envoyer?: boolean } = $props();
	const id = $props.id();
	const basculer = (e: Event & { currentTarget: HTMLInputElement }) => {
		if (envoyer) e.currentTarget.form?.requestSubmit();
	};
</script>

<label class="interrupteur"
	><span class="texte"
		><span id="{id}-libelle" class="libelle">{libelle}</span>{#if description}<span id="{id}-aide" class="aide">{description}</span>{/if}</span
	><input type="checkbox" role="switch" name={nom} value={nom ? '1' : undefined} aria-labelledby="{id}-libelle" aria-describedby={description ? `${id}-aide` : undefined} bind:checked={coche} onchange={basculer} /></label
>{#if envoyer}<noscript><Bouton type="submit" variante="secondaire">Enregistrer<span class="masque">{` : ${libelle}`}</span></Bouton></noscript>{/if}

<style>
	.interrupteur {
		display: flex;
		align-items: center;
		gap: var(--espace-16);
		min-height: var(--cible);
		padding-block: var(--espace-8);
		cursor: pointer;
	}
	.texte {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: var(--espace-4);
	}
	.libelle {
		font-weight: 600;
	}
	.aide {
		color: var(--doux);
		font-size: var(--texte-15);
	}
	/* La glissière : une piste qui se remplit à l'encre, un rond qui glisse d'un bout à l'autre. */
	input {
		--glissiere-l: var(--espace-48);
		--glissiere-h: calc(var(--espace-24) + var(--espace-4));
		--glissiere-bord: 2px;
		--glissiere-rond: var(--espace-16);
		--glissiere-marge: var(--espace-4);
		appearance: none;
		flex: none;
		position: relative;
		width: var(--glissiere-l);
		height: var(--glissiere-h);
		margin: 0;
		border: var(--glissiere-bord) solid var(--doux);
		border-radius: var(--rayon-grand);
		background: var(--surface);
		cursor: pointer;
	}
	input::after {
		content: '';
		position: absolute;
		top: var(--glissiere-marge);
		left: var(--glissiere-marge);
		width: var(--glissiere-rond);
		height: var(--glissiere-rond);
		border-radius: 50%;
		background: var(--doux);
		transition: transform var(--duree-etat) var(--courbe-sortie);
	}
	input:checked {
		border-color: var(--encre);
		background: var(--encre);
	}
	input:checked::after {
		background: var(--surface);
		transform: translateX(calc(var(--glissiere-l) - var(--glissiere-rond) - 2 * (var(--glissiere-marge) + var(--glissiere-bord))));
	}
	/* En mode contrasté, la case du système. */
	@media (forced-colors: active) {
		input {
			appearance: auto;
		}
		input::after {
			content: none;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		input::after {
			transition: none;
		}
	}
</style>
