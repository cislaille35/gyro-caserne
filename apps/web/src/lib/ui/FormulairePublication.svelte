<script module lang="ts">
	import type { Mur } from '@gyro-caserne/socle';

	export type MurPropose = Pick<Mur, 'cle' | 'nom' | 'type' | 'peutModerer'> & { audience: number; icone: string | null; couleur: string | null; numero: number | null };
</script>

<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { onMount, tick } from 'svelte';
	import { clotureParDefaut } from '#lib/aujourdhui.ts';
	import { phraseAudience } from '#lib/murs/phrases.ts';
	import { reduirePhoto } from '#lib/murs/reduire-photo.ts';
	import { teinteDuMur } from '#lib/murs/teinte.ts';
	import ChampPhoto from './ChampPhoto.svelte';
	import Champ from './Champ.svelte';
	import ChoixRadio from './ChoixRadio.svelte';

	type Valeurs = { mur?: string; type?: string; texte?: string; priseDeConnaissance?: boolean; debut?: string; lieu?: string; equipes?: string[]; question?: string; reponses?: string[]; ouverture?: string; cloture?: string };
	let {
		murs,
		choisi,
		equipes,
		defauts,
		form
	}: {
		murs: MurPropose[];
		choisi: string | null;
		equipes: { id: number; nom: string; active: number }[];
		defauts: { texte: string; ouverture: string; cloture: string };
		form?: { cible?: string; message?: string; erreurs?: Record<string, string>; valeurs?: Valeurs } | null;
	} = $props();

	const GENRES = [
		{ valeur: 'message', libelle: 'Message', sous: 'pour discuter' },
		{ valeur: 'evenement', libelle: 'Événement', sous: 'qui vient ?' },
		{ valeur: 'bravo', libelle: 'Bravo', sous: 'une réussite' },
		{ valeur: 'annonce', libelle: 'Annonce', sous: 'à lire' }
	];
	const concerne = $derived(form?.cible === 'publier');
	const valeurs = $derived<Valeurs>(concerne ? (form?.valeurs ?? {}) : {});
	const erreurs = $derived<Record<string, string>>(concerne ? (form?.erreurs ?? {}) : {});

	// Sans JavaScript, tout reste visible : chaque mur avec sa phrase, chaque genre, tous les champs.
	let js = $state(false);
	onMount(() => (js = true));

	// svelte-ignore state_referenced_locally
	let mur = $state(valeurs.mur || choisi || '');
	// svelte-ignore state_referenced_locally
	let type = $state(valeurs.type || 'message');
	// svelte-ignore state_referenced_locally
	let debut = $state(valeurs.debut ?? '');
	// svelte-ignore state_referenced_locally
	let ouverture = $state(valeurs.ouverture ?? defauts.ouverture);
	// La clôture suit l'ouverture et le début de l'événement (un an au plus), tant qu'on ne l'a pas changée soi-même.
	// svelte-ignore state_referenced_locally
	let cloture = $state(valeurs.cloture ?? '');
	// svelte-ignore state_referenced_locally
	let clotureChoisie = $state(Boolean(valeurs.cloture));
	const dateHeure = (x: string) => /^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(x);
	const clotureAffichee = $derived(
		clotureChoisie ? cloture : dateHeure(ouverture) ? clotureParDefaut(ouverture, type === 'evenement' && dateHeure(debut) ? debut : undefined) : defauts.cloture
	);
	// svelte-ignore state_referenced_locally
	let nombreReponses = $state(Math.max(2, (valeurs.reponses ?? []).filter((r) => r.trim()).length));

	const choix = $derived(murs.find((m) => m.cle === mur));
	const unModere = $derived(murs.some((m) => m.peutModerer));
	// Masquée, la case ne part pas avec le formulaire (par exemple après un changement de mur).
	const masquerPrise = $derived(js && (type !== 'annonce' || !choix?.peutModerer));
	const convoquables = $derived(equipes.filter((e) => e.active === 1));

	let erreurPhotos = $state('');
	let envoi = $state(false);
	// Les photos sont réduites avant l'envoi ; un fichier illisible arrête l'envoi avec un message.
	let champPhotos = $state<HTMLInputElement>();
	const surEnvoi: SubmitFunction = async ({ formData, cancel }) => {
		erreurPhotos = '';
		const fichiers = formData.getAll('photos').filter((f): f is File => typeof f !== 'string' && f.size > 0);
		formData.delete('photos');
		envoi = true;
		try {
			for (const [i, f] of fichiers.entries()) formData.append('photos', await reduirePhoto(f), `photo-${i + 1}.jpg`);
		} catch (e) {
			erreurPhotos = e instanceof Error ? `${e.message}.` : 'Photo illisible.';
			envoi = false;
			cancel();
			await tick();
			champPhotos?.focus();
			return;
		}
		// Envoyée : on part sur le mur, à la publication. Refusée : le premier champ en erreur prend le focus.
		return async ({ update, result, formElement }) => {
			await update({ reset: false });
			envoi = false;
			await tick();
			if (result.type === 'failure') formElement.querySelector<HTMLElement>('.en-erreur input, [aria-invalid="true"]')?.focus();
		};
	};
	const erreurPhoto = $derived(erreurPhotos || erreurs.photos);
</script>

<!-- Annoncé par la zone unique de la page ; ici, seulement visible. -->
{#if concerne && (form?.message || form?.erreurs)}<p class="echec">{form?.message ?? 'La publication contient des erreurs.'}</p>{/if}
<form method="POST" action="?/publier" enctype="multipart/form-data" class="formulaire" use:enhance={surEnvoi}>
	<ChoixRadio
		id="publier-mur"
		legende="Où publier ?"
		name="mur"
		bind:valeur={mur}
		requis
		disposition={js ? 'pastilles' : 'rangees'}
		erreur={erreurs.mur}
		options={murs.map((m) => {
			const t = teinteDuMur(m.type, m);
			return { valeur: m.cle, libelle: m.nom, sous: js ? undefined : `${phraseAudience(m.type, m.nom, m.audience)}.`, teinte: { fond: t.fond, encre: t.encre, trait: t.trait === 'transparent' ? 'var(--encre)' : t.trait } };
		})}
	/>
	{#if js}
		{@const t = choix ? teinteDuMur(choix.type, choix) : null}
		<p class="visible" aria-live="polite" hidden={!choix} style:--visible-fond={t?.fond} style:--visible-encre={t?.encre}>
			<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
			<span>{choix ? `${phraseAudience(choix.type, choix.nom, choix.audience)}.` : ''}</span>
		</p>
	{/if}

	<ChoixRadio id="publier-type" legende="Quel genre ?" name="type" bind:valeur={type} disposition="tuiles" erreur={erreurs.type} options={GENRES} />

	{#if unModere}
		<!-- Sans JavaScript, la case reste visible avec sa mention ; avec, seulement pour une annonce sur un mur qu'on modère. -->
		<label class="case" hidden={masquerPrise}>
			<input
				type="checkbox"
				name="priseDeConnaissance"
				disabled={masquerPrise}
				value="oui"
				checked={valeurs.priseDeConnaissance}
				aria-invalid={erreurs.priseDeConnaissance ? 'true' : undefined}
				aria-describedby={erreurs.priseDeConnaissance ? 'publier-prise-erreur' : undefined}
			/>
			<span>Demander une prise de connaissance (annonce){#if !js}<span class="aide mention">réservé aux modérateurs du mur</span>{/if}</span>
		</label>
		{#if erreurs.priseDeConnaissance}<p id="publier-prise-erreur" class="erreur">{erreurs.priseDeConnaissance}</p>{/if}
	{/if}

	<div class="champ">
		<label for="publier-texte">Votre message</label>
		<textarea
			id="publier-texte"
			name="texte"
			rows="4"
			maxlength="4000"
			required
			aria-invalid={erreurs.texte ? 'true' : undefined}
			aria-describedby={erreurs.texte ? 'publier-texte-erreur' : undefined}
			value={valeurs.texte ?? defauts.texte}
		></textarea>
		{#if erreurs.texte}<p id="publier-texte-erreur" class="erreur">{erreurs.texte}</p>{/if}
	</div>

	<fieldset class="groupe" hidden={js && type !== 'evenement'}>
		<legend>Pour un événement</legend>
		<Champ id="publier-debut" name="debut" type="datetime-local" libelle="Date et heure" bind:valeur={debut} erreur={erreurs.debut} />
		<Champ id="publier-lieu" name="lieu" libelle="Lieu" maxlength={200} valeur={valeurs.lieu ?? ''} erreur={erreurs.lieu} />
		{#if js && choix?.type === 'equipe'}
			<p class="aide">Toute l’équipe est convoquée.</p>
		{:else if convoquables.length > 0 && murs.some((m) => m.type !== 'equipe')}
			<fieldset class="convoques" aria-describedby="publier-convoques-aide">
				<legend>Équipes convoquées</legend>
				<p id="publier-convoques-aide" class="aide">Aucune équipe cochée : tout le mur est convoqué.{js ? '' : ' Sur un mur d’équipe, toute l’équipe est convoquée.'}</p>
				{#each convoquables as e (e.id)}
					<label class="case"><input type="checkbox" name="equipe" value={e.id} checked={valeurs.equipes?.includes(String(e.id))} /> {e.nom}</label>
				{/each}
				{#if erreurs.convoques}<p class="erreur">{erreurs.convoques}</p>{/if}
			</fieldset>
		{/if}
	</fieldset>

	<ChampPhoto bind:champ={champPhotos} id="publier-photos" name="photos" libelle="Photos" aide="4 au plus, en JPEG ou WebP. Elles sont réduites avant l’envoi." appel="Ajouter des photos" accept="image/jpeg,image/webp,image/*" multiple erreur={erreurPhoto} />

	<details class="sondage" open={Boolean(valeurs.question || erreurs.sondage || erreurs.ouverture || erreurs.cloture)}>
		<summary>Sondage</summary>
		<div class="contenu-sondage">
			<Champ id="publier-question" name="question" libelle="Question" maxlength={200} valeur={valeurs.question ?? ''} erreur={erreurs.sondage} />
			<div class="reponses" role="group" aria-labelledby="publier-reponses-titre">
				<span id="publier-reponses-titre" class="titre-reponses">Réponses (2 à 6)</span>
				{#if !js}<p class="aide">Une seule par personne. Laissez vides les réponses en trop.</p>{/if}
				{#each [0, 1, 2, 3, 4, 5] as i (i)}
					<input class="saisie" name="reponse" aria-label="Réponse {i + 1}" maxlength="100" value={valeurs.reponses?.[i] ?? ''} hidden={js && i >= nombreReponses} />
				{/each}
				{#if js && nombreReponses < 6}
					<button type="button" class="ajouter" onclick={() => nombreReponses++}>+ Ajouter une réponse</button>
				{/if}
			</div>
			<div class="dates">
				<div class="champ">
					<label for="publier-ouverture">Ouvre le</label>
					<input
						class="saisie"
						id="publier-ouverture"
						name="ouverture"
						type="datetime-local"
						value={ouverture}
						oninput={(e) => (ouverture = e.currentTarget.value)}
						aria-invalid={erreurs.ouverture ? 'true' : undefined}
						aria-describedby={erreurs.ouverture ? 'publier-ouverture-erreur' : undefined}
					/>
					{#if erreurs.ouverture}<p id="publier-ouverture-erreur" class="erreur">{erreurs.ouverture}</p>{/if}
				</div>
				<div class="champ">
					<label for="publier-cloture">Ferme le</label>
					<input
						class="saisie"
						id="publier-cloture"
						name="cloture"
						type="datetime-local"
						value={clotureAffichee}
						aria-invalid={erreurs.cloture ? 'true' : undefined}
						aria-describedby={erreurs.cloture ? 'publier-cloture-erreur' : undefined}
						oninput={(e) => {
							cloture = e.currentTarget.value;
							clotureChoisie = true;
						}}
					/>
					{#if erreurs.cloture}<p id="publier-cloture-erreur" class="erreur">{erreurs.cloture}</p>{/if}
				</div>
			</div>
			<p class="aide">Ouvert dès la publication par défaut. Fermé, plus personne ne vote et les résultats s’affichent pour tous. Pour un événement, il ferme au plus tard à son début.</p>
		</div>
	</details>

	<button type="submit" class="publier" disabled={envoi}>{envoi ? 'Envoi…' : js && choix ? `Publier dans ${choix.nom}` : 'Publier'}</button>
</form>

<style>
	p {
		margin: 0;
	}
	.formulaire {
		display: flex;
		flex-direction: column;
		gap: 18px;
	}
	fieldset {
		margin: 0;
		min-width: 0;
	}
	legend {
		padding: 0 0 8px;
		font-weight: 700;
	}
	label,
	summary {
		font-weight: 600;
	}

	/* Où publier ? */
	.visible[hidden] {
		display: none;
	}
	.visible {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px;
		border-radius: 12px;
		background: var(--visible-fond);
		color: var(--visible-encre);
		font-size: 0.9375rem;
	}
	.visible svg {
		flex: none;
	}

	/* Champs */
	.champ {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.champ > label {
		font-weight: 700;
	}
	textarea,
	.saisie {
		min-height: var(--cible);
		box-sizing: border-box;
		width: 100%;
		padding: 0 12px;
		border: 1px solid var(--statut-neutre-trait);
		border-radius: 12px;
		background: var(--surface);
		color: var(--encre);
		font: 400 1rem var(--police);
	}
	textarea {
		padding: 12px;
		border-radius: 14px;
		resize: vertical;
	}
	[aria-invalid='true'] {
		border: 2px solid var(--accent);
	}
	.groupe {
		border: 1px solid var(--trait-doux);
		border-radius: var(--rayon-grand);
		padding: 0 14px 14px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.groupe > legend {
		padding: 0 6px;
	}
	.groupe[hidden] {
		display: none;
	}
	.convoques {
		border: 0;
		padding: 0;
	}

	/* Sondage */
	.sondage {
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
		border-radius: var(--rayon-grand);
		background: var(--surface);
	}
	summary {
		min-height: var(--cible);
		padding: 0 14px;
		display: flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
		list-style: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary::before {
		content: '+';
		font-weight: 700;
	}
	.sondage[open] summary::before {
		content: '−';
	}
	.contenu-sondage {
		padding: 0 14px 14px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.reponses {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.titre-reponses {
		font-weight: 600;
	}
	.saisie[hidden] {
		display: none;
	}
	.ajouter {
		align-self: flex-start;
		min-height: var(--cible);
		padding: 0;
		border: 0;
		background: none;
		color: var(--statut-info-texte);
		font: 600 0.9375rem var(--police);
		cursor: pointer;
	}
	/* Côte à côte s'il y a la place, l'une sous l'autre au téléphone. */
	.dates {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
		gap: 10px;
	}
	.dates .saisie {
		padding: 0 8px;
		font-size: 0.9375rem;
	}

	.case {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: var(--cible);
		font-weight: 400;
	}
	.case[hidden] {
		display: none;
	}
	.mention {
		display: block;
	}
	.aide {
		color: var(--doux);
		font-size: 0.875rem;
	}
	.erreur {
		color: var(--accent);
		font-weight: 600;
		font-size: 0.9375rem;
	}
	.echec {
		padding: 12px 16px;
		border-radius: var(--rayon-petit);
		border: 2px solid var(--accent);
		font-weight: 600;
	}
	.publier {
		min-height: 52px;
		border-radius: var(--rayon-bouton);
		border: 2px solid var(--encre);
		background: var(--rouge);
		color: var(--sur-rouge);
		font: 700 1.0625rem var(--police);
		cursor: pointer;
	}
	.publier:hover {
		background: var(--rouge-survol);
	}
	.publier:disabled {
		opacity: 0.6;
	}
</style>
