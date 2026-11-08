<script lang="ts">
	let {
		id,
		libelle,
		type = 'text',
		name,
		valeur = $bindable(''),
		erreur,
		aide,
		autocomplete,
		requis = false,
		maxlength,
		lignes
	}: {
		id: string;
		libelle: string;
		type?: string;
		name: string;
		valeur?: string;
		erreur?: string;
		aide?: string;
		autocomplete?: AutoFill;
		requis?: boolean;
		maxlength?: number;
		// Plusieurs lignes : une zone de texte de cette hauteur.
		lignes?: number;
	} = $props();

	const idAide = $derived(`${id}-aide`);
	const idErreur = $derived(`${id}-erreur`);
	const decrit = $derived([aide && idAide, erreur && idErreur].filter(Boolean).join(' ') || undefined);
</script>

<div class="champ">
	<label for={id}>{libelle}</label>
	{#if aide}<p id={idAide} class="aide">{aide}</p>{/if}
	{#if lignes}
		<textarea {id} {name} required={requis} {maxlength} rows={lignes} bind:value={valeur} aria-invalid={erreur ? 'true' : undefined} aria-describedby={decrit}></textarea>
	{:else}
	<input
		{id}
		{name}
		{type}
		{autocomplete}
		required={requis}
		{maxlength}
		bind:value={valeur}
		aria-invalid={erreur ? 'true' : undefined}
		aria-describedby={decrit}
	/>
	{/if}
	{#if erreur}<p id={idErreur} class="erreur">{erreur}</p>{/if}
</div>

<style>
	.champ {
		display: flex;
		flex-direction: column;
		gap: var(--espace-6);
	}
	label {
		font-weight: 600;
	}
	input,
	textarea {
		min-height: var(--cible);
		padding: 0 var(--espace-16);
		background: var(--surface);
		color: var(--encre);
		font: 400 var(--texte-16) var(--police);
	}
	textarea {
		padding: var(--espace-12) var(--espace-16);
		resize: vertical;
		line-height: 1.4;
	}
	:is(input, textarea)[aria-invalid='true'] {
		border-color: var(--accent);
	}
	p {
		margin: 0;
		font-size: var(--texte-15);
	}
	.aide {
		color: var(--doux);
	}
	.erreur {
		color: var(--accent);
		font-weight: 600;
	}
</style>
