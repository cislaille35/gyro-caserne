<script lang="ts">
	// Un choix unique à portée de doigt : boutons radio natifs (clavier et lecteur d'écran), sans liste déroulante.
	// « pastilles » pour des libellés courts, « tuiles » en deux colonnes avec une précision, « rangees » l'une sous l'autre.
	type Option = { valeur: string; libelle: string; sous?: string; teinte?: { fond: string; encre: string; trait: string } };
	let {
		id,
		legende,
		name,
		options,
		valeur = $bindable(''),
		disposition = 'pastilles',
		requis = false,
		erreur
	}: { id: string; legende: string; name: string; options: Option[]; valeur?: string; disposition?: 'pastilles' | 'tuiles' | 'rangees'; requis?: boolean; erreur?: string } = $props();
</script>

<fieldset aria-describedby={erreur ? `${id}-erreur` : undefined}>
	<legend>{legende}</legend>
	{#if erreur}<p id="{id}-erreur" class="erreur">{erreur}</p>{/if}
	<div class="options {disposition}" class:en-erreur={Boolean(erreur)}>
		{#each options as o (o.valeur)}
			<label class="option" style:--choix-fond={o.teinte?.fond} style:--choix-encre={o.teinte?.encre} style:--choix-trait={o.teinte?.trait}>
				<input type="radio" {name} value={o.valeur} bind:group={valeur} required={requis} />
				<span class="textes"><span class="nom">{o.libelle}</span>{#if o.sous}<span class="sous">{o.sous}</span>{/if}</span>
			</label>
		{/each}
	</div>
</fieldset>

<style>
	fieldset {
		min-width: 0;
		margin: 0;
		padding: 0;
		border: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	legend {
		padding: 0 0 8px;
		font-weight: 700;
	}
	.options {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.pastilles {
		flex-direction: row;
		flex-wrap: wrap;
	}
	.tuiles {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	.option {
		min-height: var(--cible);
		padding: 8px 14px;
		border: 1px solid var(--trait-doux);
		border-radius: var(--rayon-grand);
		background: var(--surface);
		display: flex;
		align-items: center;
		gap: 10px;
		cursor: pointer;
	}
	.pastilles .option {
		padding: 0 14px;
		border-radius: 999px;
	}
	.tuiles .option {
		min-height: 64px;
		padding: 10px 12px;
	}
	/* Choisi : cadre épais et rond rempli, pas la couleur seule. */
	.option:has(input:checked) {
		border: 2px solid var(--choix-trait, var(--encre));
		background: var(--choix-fond, var(--surface));
		color: var(--choix-encre, var(--encre));
	}
	.en-erreur .option {
		border-color: var(--accent);
	}
	input {
		flex: none;
		margin: 0;
		width: 20px;
		height: 20px;
		accent-color: var(--encre);
	}
	.textes {
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.nom {
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.sous {
		font-size: 0.875rem;
	}
	.tuiles .sous {
		color: var(--doux);
	}
	.erreur {
		margin: 0;
		color: var(--accent);
		font-weight: 600;
		font-size: 0.9375rem;
	}
</style>
