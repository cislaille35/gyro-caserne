<script lang="ts">
	import { plat } from '../messagerie/recherche.ts';
	import { pluriel } from '../pluriel.ts';
	import Visage from '../ui/Visage.svelte';
	import { DESSINS } from '../ui/icones-roles.ts';

	type Collegue = { id: number; prenom: string; nom: string; equipe: { nom: string; couleur: string } | null; aptitudes: string[]; manque: string[] };

	// Les collègues libres, en boutons radio, avec une recherche (envoyée au serveur sans JavaScript, filtrée en direct avec).
	// `tous` : le nombre de disponibles prévenus si l'agent choisit « Tout le monde » (remplacement seulement).
	let {
		collegues,
		name,
		choisi,
		recherche,
		etape,
		tous = null,
		legende
	}: {
		collegues: Collegue[];
		name: string;
		choisi: number | 'tous' | null;
		recherche: string;
		etape: string;
		tous?: number | null;
		legende: string;
	} = $props();

	// svelte-ignore state_referenced_locally
	let filtre = $state(recherche);
	const visibles = $derived(collegues.filter((c) => !plat(filtre) || plat(`${c.prenom} ${c.nom}`).includes(plat(filtre)) || c.id === choisi));
	const sous = (c: Collegue) => [c.equipe?.nom, c.aptitudes.length ? c.aptitudes.join(', ') : 'Pas d’aptitude inscrite'].filter(Boolean).join(' · ');
</script>

<fieldset class="choix">
	<legend>{legende}</legend>
	{#if tous !== null}
		<label class="rangee">
			<input type="radio" {name} value="tous" checked={choisi === 'tous' || choisi === null} />
			<span class="corps">
				<span class="titre">Tout le monde</span>
				<span class="sous">{tous > 0 ? `${pluriel(tous, 'collègue disponible prévenu', 'collègues disponibles prévenus')} en même temps. Le premier qui accepte vous remplace.` : 'Aucun collègue n’est libre sur ces périodes pour l’instant.'}</span>
			</span>
		</label>
		<p class="ou">Ou un collègue précis</p>
	{/if}
	<p class="aide" id="{name}-aide">Seuls les collègues libres sur ces périodes sont proposés.</p>
	{#if collegues.length > 0}
		<div class="recherche">
			<label for="{name}-q" class="masque">Chercher un collègue</label>
			<input id="{name}-q" type="search" name="q" bind:value={filtre} placeholder="Chercher un collègue" aria-describedby="{name}-aide" autocomplete="off" />
			<button type="submit" name="etape" value={etape} class="loupe"
				><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d={DESSINS.loupe} /></svg><span class="masque">Chercher</span></button
			>
		</div>
	{/if}
	<ul role="list">
		{#each visibles as c (c.id)}
			<li>
				<label class="rangee">
					<input type="radio" {name} value={c.id} checked={choisi === c.id || (tous === null && visibles.length === 1)} />
					<Visage prenom={c.prenom} nom={c.nom} couleur={c.equipe?.couleur ?? null} taille={40} />
					<span class="corps">
						<span class="titre">{c.prenom} {c.nom}</span>
						<span class="sous">{sous(c)}</span>
						{#if c.manque.length > 0}<span class="manque"><strong>Il lui manque {c.manque.join(', ')}</strong> : votre chef d’équipe devra valider.</span>{/if}
					</span>
				</label>
			</li>
		{:else}
			<li class="vide">{collegues.length === 0 ? 'Personne n’est libre sur ces périodes pour l’instant.' : 'Aucun collègue libre à ce nom.'}</li>
		{/each}
	</ul>
</fieldset>

<style>
	.choix {
		margin: 0;
		padding: 0;
		border: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 0;
	}
	legend {
		float: left;
		padding: 0;
		font: 700 1.125rem var(--police-titre);
	}
	p {
		margin: 0;
		clear: both;
	}
	.ou {
		margin-top: 8px;
		font-weight: 700;
	}
	.aide,
	.sous,
	.vide {
		color: var(--doux);
		font-size: 0.9375rem;
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 6px;
	}
	.rangee {
		clear: both;
		min-height: 56px;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 14px;
		border: 1px solid var(--trait);
		border-radius: var(--rayon-grand);
		background: var(--surface);
		cursor: pointer;
	}
	.rangee:has(input:checked) {
		border: 2px solid var(--encre);
		padding: 7px 13px;
	}
	.rangee:has(input:focus-visible) {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}
	.rangee > input {
		flex: none;
		width: 22px;
		height: 22px;
		margin: 0;
		accent-color: var(--encre);
	}
	.corps {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.titre {
		font-weight: 700;
	}
	.manque {
		margin-top: 4px;
		padding: 4px 10px;
		border-radius: 10px;
		background: var(--statut-alerte-fond);
		color: var(--statut-alerte-texte);
		border: 1px solid var(--statut-alerte-trait);
		font-size: 0.9375rem;
	}
	.recherche {
		display: flex;
		gap: 6px;
	}
	.recherche input {
		flex: 1;
		min-width: 0;
		min-height: var(--cible);
		padding: 0 14px;
		border: 2px solid var(--doux);
		border-radius: 999px;
		background: var(--surface);
		color: var(--encre);
		font: 400 1rem var(--police);
	}
	.loupe {
		flex: none;
		width: var(--cible);
		height: var(--cible);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--trait);
		border-radius: 999px;
		background: var(--surface);
		color: var(--encre);
		cursor: pointer;
	}
	@media (min-width: 900px) {
		ul {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
