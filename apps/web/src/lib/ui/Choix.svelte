<script lang="ts">
	import { onMount, untrack } from 'svelte';

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

	// La sélection vit dans le navigateur ; on ne l'impose pas quand la page devient prête, sinon un choix
	// fait avant serait perdu : c'est `valeur` qui reprend ce choix. Ensuite, une nouvelle `valeur` venue
	// de la page est appliquée, et une remise à zéro du formulaire revient au choix de départ.
	let liste: HTMLSelectElement;
	const depart = untrack(() => valeur);
	let monte = false;
	$effect(() => {
		const voulue = valeur;
		if (!monte) {
			monte = true;
			if (liste.value !== voulue) valeur = liste.value;
		} else if (liste.value !== voulue) liste.value = voulue;
	});
	onMount(() => {
		const formulaire = liste.form;
		const apresRemiseAZero = () => queueMicrotask(() => (valeur = liste.value));
		formulaire?.addEventListener('reset', apresRemiseAZero);
		return () => formulaire?.removeEventListener('reset', apresRemiseAZero);
	});
</script>

<div class="champ">
	<label for={id}>{libelle}</label>
	{#if aide}<p id={idAide} class="aide">{aide}</p>{/if}
	<select
		bind:this={liste}
		{id}
		{name}
		required={requis}
		onchange={() => (valeur = liste.value)}
		aria-invalid={erreur ? 'true' : undefined}
		aria-describedby={decrit}
	>
		{#each options as option (option.valeur)}
			<option value={option.valeur} selected={option.valeur === depart}>{option.libelle}</option>
		{/each}
	</select>
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
	select {
		min-height: var(--cible);
		padding: 0 var(--espace-16);
		background: var(--surface);
		color: var(--encre);
		font: 400 var(--texte-16) var(--police);
	}
	select[aria-invalid='true'] {
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
