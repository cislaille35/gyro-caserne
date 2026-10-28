<script lang="ts">
	import { onMount } from 'svelte';

	// Un groupe de boutons radio : un niveau par domaine. « Sur mesure » n'apparaît que si les droits
	// ne tombent sur aucun niveau ; l'envoyer laisse le domaine tel quel.
	let {
		name,
		legende,
		niveaux,
		valeur = $bindable(0),
		surMesure = false,
		desactive = false
	}: {
		name: string;
		legende: string;
		niveaux: { libelle: string; phrase: string }[];
		valeur?: number | 'sur_mesure';
		surMesure?: boolean;
		desactive?: boolean;
	} = $props();

	const phrase = $derived(valeur === 'sur_mesure' ? 'Des droits choisis un par un : voir le détail droit par droit.' : niveaux[valeur]?.phrase);
	let groupe: HTMLFieldSetElement;

	// Un choix fait avant que la page soit prête n'est pas perdu.
	onMount(() => {
		const coche = groupe.querySelector<HTMLInputElement>('input:checked')?.value;
		if (coche !== undefined) valeur = coche === 'sur_mesure' ? coche : Number(coche);
	});
</script>

<fieldset class="selecteur" bind:this={groupe} disabled={desactive}>
	<legend class="cache">{legende}</legend>
	<div class="options">
		{#each niveaux as niveau, i (niveau.libelle)}
			<label class="option"
				><input type="radio" {name} value={String(i)} checked={valeur === i} onchange={() => (valeur = i)} /><span>{niveau.libelle}</span></label
			>
		{/each}
		{#if surMesure}
			<label class="option"
				><input type="radio" {name} value="sur_mesure" checked={valeur === 'sur_mesure'} onchange={() => (valeur = 'sur_mesure')} /><span>Sur mesure</span></label
			>
		{/if}
	</div>
	{#if phrase}<p class="phrase">{phrase}</p>{/if}
</fieldset>

<style>
	.selecteur {
		border: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
		min-width: 0;
	}
	.cache {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
	.options {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(7.5rem, 1fr));
		gap: 6px;
	}
	.option {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: var(--cible);
		padding: 4px 10px;
		border: 1px solid var(--statut-neutre-trait);
		border-radius: 10px;
		background: var(--surface);
		color: var(--encre);
		text-align: center;
		cursor: pointer;
	}
	.option input {
		position: absolute;
		opacity: 0;
		inset: 0;
		margin: 0;
		cursor: pointer;
	}
	/* Le niveau choisi : fond foncé, gras et coche, pas seulement une couleur. */
	.option:has(input:checked) {
		background: var(--encre);
		border-color: var(--encre);
		color: var(--surface);
		font-weight: 700;
	}
	.option:has(input:checked) span::before {
		content: '✓ ' / '';
	}
	.option:has(input:focus-visible) {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}
	.selecteur:disabled .option {
		cursor: default;
	}
	.selecteur:disabled .option:not(:has(input:checked)) {
		color: var(--doux);
	}
	.phrase {
		margin: 0;
	}
</style>
