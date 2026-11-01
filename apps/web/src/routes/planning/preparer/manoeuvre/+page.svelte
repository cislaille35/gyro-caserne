<script lang="ts">
	import { untrack } from 'svelte';
	import Bouton from '#lib/ui/Bouton.svelte';
	import Champ from '#lib/ui/Champ.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';

	let { data, form } = $props();

	const m = $derived(data.manoeuvre);
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
	const retourHref = $derived(`/planning/preparer?annee=${m ? m.debut.slice(0, 4) : data.annee}#manoeuvres`);
</script>

<svelte:head>
	<title>{m ? m.theme : 'Nouvelle manœuvre'} · Planning · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<EnTetePage titre={m ? 'Modifier la manœuvre' : 'Nouvelle manœuvre'} phrase={m?.publiee ? 'Déjà annoncée : la publication sera mise à jour et les convoqués prévenus.' : 'Elle sera annoncée sur « Le centre » deux semaines avant.'} retour={{ href: retourHref, libelle: 'Préparer l’année' }} />

	{#if m?.annulee}
		<p class="echec">Cette manœuvre est annulée.</p>
	{:else}
		<form method="POST" action="?/enregistrer" class="carte">
			<div role="alert">{#if form?.cible === 'manoeuvre' && form.message}<p class="echec">{form.message}</p>{/if}</div>
			{#if m}<input type="hidden" name="id" value={m.id} />{/if}
			<div class="deux">
				<Champ id="date" name="date" type="date" libelle="Date" requis valeur={saisi('date', m ? m.debut.slice(0, 10) : '')} />
				<Champ id="heure" name="heure" type="time" libelle="Heure de début" requis valeur={saisi('heure', m ? m.debut.slice(11, 16) : '08:30')} />
			</div>
			<Champ id="theme" name="theme" libelle="Thème" requis maxlength={100} aide="Par exemple « Feux de forêt » ou « Sport + SAP »." valeur={saisi('theme', m?.theme ?? '')} />
			<Champ id="lieu" name="lieu" libelle="Lieu" requis maxlength={200} valeur={saisi('lieu', m?.lieu ?? 'Caserne')} />
			<fieldset>
				<legend>Équipes convoquées</legend>
				<label class="case"><input type="radio" name="pour" value="tous" bind:group={pour} /> Tout le centre</label>
				<label class="case"><input type="radio" name="pour" value="equipes" bind:group={pour} /> Certaines équipes</label>
				<div class="equipes">
					{#each data.equipes as e (e.id)}
						<label class="case"><input type="checkbox" name="equipes" value={e.id} checked={cochee(e.id)} onchange={(ev) => ev.currentTarget.checked && (pour = 'equipes')} /> {e.nom}</label>
					{/each}
				</div>
			</fieldset>
			<label class="case"><input type="checkbox" name="petitDejeuner" value="oui" checked={petitDejeuner} /> Petit-déjeuner (un sondage demande qui en prend, jusqu’au vendredi d’avant)</label>
			<Bouton type="submit">{m ? 'Enregistrer' : 'Ajouter la manœuvre'}</Bouton>
		</form>

		{#if m}
			<form method="POST" action="?/supprimer" class="carte">
				<div role="alert">{#if form?.cible === 'supprimer' && form.message}<p class="echec">{form.message}</p>{/if}</div>
				<input type="hidden" name="id" value={m.id} />
				<p>{m.publiee ? 'Annuler la manœuvre : la publication reste, marquée « Annulée », et les convoqués sont prévenus.' : 'Pas encore annoncée : elle disparaît simplement.'}</p>
				<Bouton type="submit" variante="secondaire">{m.publiee ? 'Annuler la manœuvre' : 'Supprimer la manœuvre'}</Bouton>
			</form>
		{/if}
	{/if}
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 16px;
		max-width: 40rem;
	}
	p {
		margin: 0;
	}
	.carte {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 16px;
		border: 1px solid var(--trait-doux);
		border-radius: var(--rayon-grand);
		background: var(--surface);
	}
	.carte > :global(button) {
		align-self: flex-start;
	}
	.deux {
		display: grid;
		gap: 16px;
	}
	@media (min-width: 560px) {
		.deux {
			grid-template-columns: 1fr 1fr;
		}
	}
	fieldset {
		margin: 0;
		padding: 0;
		border: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	legend {
		margin-bottom: 6px;
		font-weight: 600;
	}
	.equipes {
		display: flex;
		flex-direction: column;
		padding-left: 32px;
	}
	.case {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: var(--cible);
	}
	.case input {
		width: 22px;
		height: 22px;
		flex: none;
	}
	.echec {
		padding: 10px 14px;
		border-radius: var(--rayon-petit);
		border: 2px solid var(--accent);
		font-weight: 600;
	}
</style>
