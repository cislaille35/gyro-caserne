<script lang="ts">
	import centre from '$centre';
	import ChoixRadio from '#lib/ui/ChoixRadio.svelte';
	import { untrack } from 'svelte';
	import Bouton from '../ui/Bouton.svelte';
	import Champ from '../ui/Champ.svelte';
	import type { EquipePlanning, ManoeuvreVue } from '@gyro-caserne/socle';

	// Le formulaire d'une manœuvre (nouvelle si `manoeuvre` est nul), dans sa page ou dans le panneau de « Préparer l'année ».
	// Une nouvelle prend les heures réglées par le centre.
	type Retour = { cible: string; message?: string; valeurs?: Record<string, string | string[]> } | null | undefined;
	let { manoeuvre, equipes, form = null }: { manoeuvre: ManoeuvreVue | null; equipes: EquipePlanning[]; form?: Retour } = $props();

	const m = $derived(manoeuvre);
	const saisi = (cle: string, defaut: string) => {
		const v = form?.cible === 'manoeuvre' ? form.valeurs?.[cle] : undefined;
		return typeof v === 'string' ? v : defaut;
	};
	const pourDefaut = $derived(m ? (m.convoques === 'tous' ? 'tous' : 'equipes') : 'tous');
	// Cocher une équipe choisit « Certaines équipes ».
	let pour = $state(untrack(() => saisi('pour', pourDefaut)));
	$effect(() => {
		pour = saisi('pour', pourDefaut);
	});
	const cochee = (id: number) => {
		const v = form?.cible === 'manoeuvre' ? form.valeurs?.equipes : undefined;
		if (Array.isArray(v)) return v.includes(String(id));
		return m !== null && m.convoques !== 'tous' && m.convoques.includes(id);
	};
	const petitDejeuner = $derived(form?.cible === 'manoeuvre' ? form.valeurs?.petitDejeuner === 'oui' : (m?.petitDejeuner ?? false));
</script>

<div class="formulaires">
	{#if m?.annulee}
		<p class="echec">Cette manœuvre est annulée.</p>
	{:else}
		<form method="POST" action="/planning/preparer/manoeuvre?/enregistrer" class="carte">
			<div role="alert">{#if form?.cible === 'manoeuvre' && form.message}<p class="echec">{form.message}</p>{/if}</div>
			{#if m || saisi('id', '')}<input type="hidden" name="id" value={m?.id ?? saisi('id', '')} />{/if}
			<Champ id="date" name="date" type="date" libelle="Date" requis valeur={saisi('date', m ? m.debut.slice(0, 10) : '')} />
			<div class="deux">
				<Champ id="heure" name="heure" type="time" libelle="Heure de début" requis valeur={saisi('heure', m ? m.debut.slice(11, 16) : centre.manoeuvres.debut)} />
				<Champ id="fin" name="fin" type="time" libelle="Heure de fin" requis valeur={saisi('fin', m ? (m.fin.slice(0, 10) === m.debut.slice(0, 10) ? m.fin.slice(11, 16) : '') : centre.manoeuvres.fin)} />
			</div>
			<Champ id="theme" name="theme" libelle="Thème" requis maxlength={100} aide="Par exemple « Feux de forêt » ou « Sport + SAP »." valeur={saisi('theme', m?.theme ?? '')} />
			<Champ id="lieu" name="lieu" libelle="Lieu" requis maxlength={200} valeur={saisi('lieu', m?.lieu ?? 'Caserne')} />
			<ChoixRadio id="pour" legende="Équipes convoquées" name="pour" disposition="rangees" bind:valeur={pour} options={[{ valeur: 'tous', libelle: 'Tout le centre' }, { valeur: 'equipes', libelle: 'Certaines équipes' }]} />
			<fieldset class="equipes">
				<legend class="masque">Les équipes convoquées</legend>
					{#each equipes as e (e.id)}
						<label class="case"><input type="checkbox" name="equipes" value={e.id} checked={cochee(e.id)} onchange={(ev) => ev.currentTarget.checked && (pour = 'equipes')} /> {e.nom}</label>
					{/each}
				</fieldset>
			<label class="case"><input type="checkbox" name="petitDejeuner" value="oui" checked={petitDejeuner} /> Petit-déjeuner (un sondage jusqu’au vendredi d’avant : {centre.manoeuvres.petitDejeuner.join(', ')})</label>
			<Bouton type="submit">{m ? 'Enregistrer' : 'Ajouter la manœuvre'}</Bouton>
		</form>

		{#if m}
			<form method="POST" action="/planning/preparer/manoeuvre?/supprimer" class="carte">
				<div role="alert">{#if form?.cible === 'supprimer' && form.message}<p class="echec">{form.message}</p>{/if}</div>
				<input type="hidden" name="id" value={m.id} />
				<p>{m.publiee ? 'Annuler la manœuvre : la publication reste, marquée « Annulée », et les convoqués sont prévenus.' : 'Pas encore annoncée : elle disparaît simplement.'}</p>
				<Bouton type="submit" variante="secondaire">{m.publiee ? 'Annuler la manœuvre' : 'Supprimer la manœuvre'}</Bouton>
			</form>
		{/if}
	{/if}
</div>

<style>
	.formulaires {
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
	}
	p {
		margin: 0;
	}
	.carte {
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
		padding: var(--espace-16);
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
		border-radius: var(--rayon-grand);
		background: var(--surface);
	}
	.carte > :global(button) {
		align-self: flex-start;
	}
	.deux {
		display: grid;
		gap: var(--espace-16);
	}
	@media (min-width: 560px) {
		.deux {
			grid-template-columns: 1fr 1fr;
		}
	}
	fieldset.equipes {
		margin: 0;
		border: 0;
		min-width: 0;
	}
	.equipes {
		display: flex;
		flex-direction: column;
		padding-left: var(--espace-32);
	}
	.case {
		display: flex;
		align-items: center;
		gap: var(--espace-12);
		min-height: var(--cible);
	}
	.echec {
		padding: var(--espace-12) var(--espace-16);
		border-radius: var(--rayon-petit);
		border: 2px solid var(--accent);
		font-weight: 600;
	}
</style>
