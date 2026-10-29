<script module lang="ts">
	import type { Mur } from '@gyro-caserne/socle';

	export type MurPropose = Pick<Mur, 'cle' | 'nom' | 'type' | 'peutModerer'> & { audience: number; icone: string | null; couleur: string | null; numero: number | null };
</script>

<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { onMount, tick } from 'svelte';
	import { phraseAudience } from '#lib/murs/phrases.ts';
	import { reduirePhoto } from '#lib/murs/reduire-photo.ts';
	import { teinteDuMur } from '#lib/murs/teinte.ts';
	import Champ from './Champ.svelte';

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
	// La clôture suit le début de l'événement, tant qu'on ne l'a pas changée soi-même.
	// svelte-ignore state_referenced_locally
	let cloture = $state(valeurs.cloture ?? '');
	// svelte-ignore state_referenced_locally
	let clotureChoisie = $state(Boolean(valeurs.cloture));
	const clotureAffichee = $derived(clotureChoisie ? cloture : type === 'evenement' && debut ? debut : defauts.cloture);
	// svelte-ignore state_referenced_locally
	let nombreReponses = $state(Math.max(2, (valeurs.reponses ?? []).filter((r) => r.trim()).length));

	const choix = $derived(murs.find((m) => m.cle === mur));
	const unModere = $derived(murs.some((m) => m.peutModerer));
	const convoquables = $derived(equipes.filter((e) => e.active === 1));

	let erreurPhotos = $state('');
	let envoi = $state(false);
	// Les photos sont réduites avant l'envoi ; un fichier illisible arrête l'envoi avec un message.
	let champPhotos: HTMLInputElement;
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
			champPhotos.focus();
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
	<fieldset class="bloc" aria-describedby={erreurs.mur ? 'publier-mur-erreur' : undefined}>
		<legend>Où publier ?</legend>
		{#if erreurs.mur}<p id="publier-mur-erreur" class="erreur">{erreurs.mur}</p>{/if}
		<div class="murs" class:js class:en-erreur={Boolean(erreurs.mur)}>
			{#each murs as m (m.cle)}
				{@const t = teinteDuMur(m.type, m)}
				<label class="mur" style:--choix-fond={t.fond} style:--choix-encre={t.encre} style:--choix-trait={t.trait === 'transparent' ? 'var(--encre)' : t.trait}>
					<input
						type="radio"
						name="mur"
						value={m.cle}
						bind:group={mur}
						required
					/>
					<span class="nom">{m.nom}</span>
					<span class="qui" hidden={js}>{phraseAudience(m.type, m.nom, m.audience)}.</span>
				</label>
			{/each}
		</div>
		{#if js}
			{@const t = choix ? teinteDuMur(choix.type, choix) : null}
			<p class="visible" aria-live="polite" hidden={!choix} style:--visible-fond={t?.fond} style:--visible-encre={t?.encre}>
				<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
				<span>{choix ? `${phraseAudience(choix.type, choix.nom, choix.audience)}.` : ''}</span>
			</p>
		{/if}
	</fieldset>

	<fieldset class="bloc" aria-describedby={erreurs.type ? 'publier-type-erreur' : undefined}>
		<legend>Quel genre ?</legend>
		<div class="genres">
			{#each GENRES as g (g.valeur)}
				<label class="genre">
					<input type="radio" name="type" value={g.valeur} bind:group={type} />
					<span class="textes"><strong>{g.libelle}</strong><span class="sous">{g.sous}</span></span>
				</label>
			{/each}
		</div>
		{#if erreurs.type}<p id="publier-type-erreur" class="erreur">{erreurs.type}</p>{/if}
	</fieldset>

	{#if unModere}
		<!-- Sans JavaScript, la case reste visible avec sa mention ; avec, seulement pour une annonce sur un mur qu'on modère. -->
		<label class="case" hidden={js && (type !== 'annonce' || !choix?.peutModerer)}>
			<input
				type="checkbox"
				name="priseDeConnaissance"
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

	<div class="champ">
		<label for="publier-photos">Photos</label>
		<p id="publier-photos-aide" class="aide">4 au plus, en JPEG ou WebP. Elles sont réduites avant l’envoi.</p>
		<input
			bind:this={champPhotos}
			id="publier-photos"
			name="photos"
			type="file"
			accept="image/jpeg,image/webp,image/*"
			multiple
			aria-invalid={erreurPhoto ? 'true' : undefined}
			aria-describedby={erreurPhoto ? 'publier-photos-aide publier-photos-erreur' : 'publier-photos-aide'}
		/>
		{#if erreurPhoto}<p id="publier-photos-erreur" class="erreur">{erreurPhoto}</p>{/if}
	</div>

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
						value={valeurs.ouverture ?? defauts.ouverture}
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
	.bloc {
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
	label,
	summary {
		font-weight: 600;
	}

	/* Où publier ? */
	.murs {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.murs.js {
		flex-direction: row;
		flex-wrap: wrap;
	}
	.mur {
		min-height: var(--cible);
		padding: 8px 14px;
		border: 1px solid var(--trait-doux);
		border-radius: var(--rayon-grand);
		background: var(--surface);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		column-gap: 8px;
		cursor: pointer;
	}
	.js .mur {
		padding: 0 14px;
		border-radius: 999px;
	}
	.en-erreur .mur {
		border-color: var(--accent);
	}
	.mur:has(input:checked) {
		border: 2px solid var(--choix-trait);
		background: var(--choix-fond);
		color: var(--choix-encre);
	}
	.mur input,
	.genre input {
		margin: 0;
		width: 20px;
		height: 20px;
		accent-color: var(--encre);
	}
	.qui {
		flex-basis: 100%;
		padding-left: 28px;
		font-weight: 400;
		font-size: 0.9375rem;
	}
	.qui[hidden],
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

	/* Quel genre ? */
	.genres {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px;
	}
	.genre {
		min-height: 64px;
		padding: 10px 12px;
		border: 1px solid var(--trait-doux);
		border-radius: var(--rayon-grand);
		background: var(--surface);
		display: flex;
		align-items: center;
		gap: 10px;
		font-weight: 400;
		cursor: pointer;
	}
	.genre:has(input:checked) {
		border: 2px solid var(--encre);
	}
	.textes {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.sous {
		font-size: 0.8125rem;
		color: var(--doux);
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
	.saisie,
	input[type='file'] {
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
	input[type='file'] {
		padding: 10px 12px;
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
		border: 1px solid var(--trait-doux);
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
	.case input {
		width: 24px;
		height: 24px;
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
		border-radius: 999px;
		border: 2px solid var(--encre);
		background: var(--rouge);
		color: var(--sur-rouge);
		font: 700 1.0625rem var(--police);
		cursor: pointer;
	}
	.publier:hover {
		background: color-mix(in srgb, var(--rouge) 88%, black);
	}
	.publier:disabled {
		opacity: 0.6;
	}
</style>
