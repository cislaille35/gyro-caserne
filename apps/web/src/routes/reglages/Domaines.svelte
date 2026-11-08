<script lang="ts">
	import { onMount } from 'svelte';
	import type { Droit } from '@gyro-caserne/socle';
	import { DOMAINES, niveauxDe, type DomaineId } from '#lib/paquets.ts';
	import Groupe from '#lib/ui/Groupe.svelte';
	import SelecteurNiveaux from '#lib/ui/SelecteurNiveaux.svelte';

	// Un groupe par domaine, replié, avec son niveau en résumé.
	// « Revenir au modèle » envoie le formulaire `formRevenir` ; avec JavaScript, il change seulement le choix.
	let {
		droits,
		modele = null,
		choix = $bindable(),
		lectureSeule = false,
		profil = false,
		formRevenir
	}: {
		droits: Droit[];
		modele?: Droit[] | null;
		choix: Record<DomaineId, number | 'sur_mesure'>;
		lectureSeule?: boolean;
		profil?: boolean;
		formRevenir?: string;
	} = $props();

	const depart = $derived(niveauxDe(droits));
	const duModele = $derived(modele ? niveauxDe(modele) : null);
	const libelle = (d: (typeof DOMAINES)[number], n: number | 'sur_mesure') => (n === 'sur_mesure' ? 'Sur mesure' : d.niveaux[n]!.libelle);
	// Pour un profil, le premier niveau ne dit pas « comme tout agent ».
	const niveauxAffiches = (d: (typeof DOMAINES)[number]) => (profil ? d.niveaux.map((n, i) => (i === 0 ? { ...n, phrase: 'Rien dans ce domaine.' } : n)) : d.niveaux);

	// Une valeur par domaine : un bind sur `undefined` ferait échouer l'hydratation (Groupe a une valeur par défaut).
	let ouverts = $state<Record<string, boolean>>(Object.fromEntries(DOMAINES.map((d) => [d.id, false])));
	onMount(() => {
		if (matchMedia('(min-width: 1024px)').matches) ouverts = Object.fromEntries(DOMAINES.map((d) => [d.id, true]));
	});
</script>

<div class="domaines pile">
	{#each DOMAINES as d (d.id)}
		{@const modifie = choix[d.id] !== depart[d.id]}
		<Groupe titre={d.nom} resume={libelle(d, choix[d.id]) + (modifie ? ' · modifié' : '')} bind:ouvert={ouverts[d.id]}>
			<div class="domaine">
				<SelecteurNiveaux name="niveau-{d.id}" legende={d.nom} niveaux={niveauxAffiches(d)} bind:valeur={choix[d.id]} surMesure={depart[d.id] === 'sur_mesure'} desactive={lectureSeule} />
				{#if duModele && !lectureSeule && formRevenir && choix[d.id] !== duModele[d.id]}
					{@const cible = duModele[d.id]}
					<button
						type="submit"
						class="revenir"
						form={formRevenir}
						name="domaine"
						value={d.id}
						onclick={(e) => {
							e.preventDefault();
							choix[d.id] = cible;
						}}>↺ Revenir au modèle ({libelle(d, cible)})</button
					>
				{/if}
			</div>
		</Groupe>
	{/each}
</div>

<style>
	.domaine {
		padding: var(--espace-12) var(--espace-16) var(--espace-16);
		display: flex;
		flex-direction: column;
		gap: var(--espace-12);
	}
	.revenir {
		align-self: flex-start;
		min-height: var(--cible);
		padding: 0 var(--espace-16);
		border-radius: var(--rayon-bouton);
		border: 1px solid var(--statut-neutre-trait);
		background: var(--surface);
		color: var(--encre);
		font: 600 var(--texte-15) var(--police);
		cursor: pointer;
	}
</style>
