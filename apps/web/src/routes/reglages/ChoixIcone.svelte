<script lang="ts">
	import IconeRole from '#lib/ui/IconeRole.svelte';
	import { ICONES_ROLES, type IconeRole as Icone } from '#lib/ui/icones-roles.ts';
	import { NOMS_ICONES } from './roles.ts';

	// L'icône d'un rôle, choisie dans la petite liste fixe.
	let { valeur, erreur }: { valeur: Icone; erreur?: string } = $props();
	const id = $props.id();
</script>

<fieldset class="icones" aria-describedby={erreur ? `${id}-erreur` : undefined}>
	<legend>Icône</legend>
	<div class="tuiles">
		{#each Object.keys(ICONES_ROLES) as Icone[] as icone (icone)}
			<label class="tuile">
				<input type="radio" name="icone" value={icone} checked={icone === valeur} />
				<IconeRole {icone} taille={40} />
				<span class="cache">{NOMS_ICONES[icone]}</span>
			</label>
		{/each}
	</div>
	{#if erreur}<p class="erreur" id="{id}-erreur">{erreur}</p>{/if}
</fieldset>

<style>
	.icones {
		border: none;
		margin: 0;
		padding: 0;
	}
	legend {
		font-weight: 600;
		padding: 0;
		margin-bottom: 6px;
	}
	.tuiles {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.tuile {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 52px;
		height: 52px;
		border: 2px solid transparent;
		border-radius: 14px;
		cursor: pointer;
	}
	.tuile input {
		position: absolute;
		opacity: 0;
		inset: 0;
		margin: 0;
		cursor: pointer;
	}
	/* L'icône choisie : cadre épais et coche, pas seulement une couleur. */
	.tuile:has(input:checked) {
		border-color: var(--encre);
	}
	.tuile:has(input:checked)::after {
		content: '✓';
		position: absolute;
		top: -6px;
		right: -6px;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--encre);
		color: var(--surface);
		font-size: 0.75rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.tuile:has(input:focus-visible) {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}
	.cache {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
	.erreur {
		margin: 6px 0 0;
		color: var(--accent);
		font-weight: 600;
	}
</style>
