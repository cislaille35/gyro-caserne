<script lang="ts">
	let {
		id,
		libelle,
		name,
		options,
		valeur = $bindable(''),
		erreur,
		aide,
		requis = false
	}: {
		id: string;
		libelle: string;
		name: string;
		options: { valeur: string; libelle: string }[];
		valeur?: string;
		erreur?: string;
		aide?: string;
		requis?: boolean;
	} = $props();

	const idAide = $derived(`${id}-aide`);
	const idErreur = $derived(`${id}-erreur`);
	const decrit = $derived([aide && idAide, erreur && idErreur].filter(Boolean).join(' ') || undefined);
</script>

<div class="champ">
	<label for={id}>{libelle}</label>
	{#if aide}<p id={idAide} class="aide">{aide}</p>{/if}
	<select {id} {name} required={requis} bind:value={valeur} aria-invalid={erreur ? 'true' : undefined} aria-describedby={decrit}>
		{#each options as option (option.valeur)}
			<option value={option.valeur}>{option.libelle}</option>
		{/each}
	</select>
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
	select {
		min-height: var(--cible);
		padding: 0 14px;
		border: 2px solid var(--doux);
		border-radius: var(--rayon-petit);
		background: var(--surface);
		color: var(--encre);
		font: 400 1rem var(--police);
	}
	select[aria-invalid='true'] {
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
