<script lang="ts">
	let {
		id,
		libelle,
		type = 'text',
		name,
		valeur = $bindable(''),
		erreur,
		aide,
		autocomplete
	}: {
		id: string;
		libelle: string;
		type?: string;
		name: string;
		valeur?: string;
		erreur?: string;
		aide?: string;
		autocomplete?: AutoFill;
	} = $props();

	const idAide = $derived(`${id}-aide`);
	const idErreur = $derived(`${id}-erreur`);
	const decrit = $derived([aide && idAide, erreur && idErreur].filter(Boolean).join(' ') || undefined);
</script>

<div class="champ">
	<label for={id}>{libelle}</label>
	{#if aide}<p id={idAide} class="aide">{aide}</p>{/if}
	<input
		{id}
		{name}
		{type}
		{autocomplete}
		bind:value={valeur}
		aria-invalid={erreur ? 'true' : undefined}
		aria-describedby={decrit}
	/>
	{#if erreur}<p id={idErreur} class="erreur">{erreur}</p>{/if}
</div>

<style>
	.champ {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	label {
		font-weight: 600;
	}
	input {
		min-height: var(--cible);
		padding: 0 14px;
		border: 2px solid var(--doux);
		border-radius: var(--rayon-petit);
		background: var(--surface);
		color: var(--encre);
		font: 400 1rem var(--police);
	}
	input[aria-invalid='true'] {
		border-color: var(--accent);
	}
	p {
		margin: 0;
		font-size: 0.9375rem;
	}
	.aide {
		color: var(--doux);
	}
	.erreur {
		color: var(--accent);
		font-weight: 600;
	}
</style>
