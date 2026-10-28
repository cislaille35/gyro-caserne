<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { onMount, tick } from 'svelte';
	import { reduirePhoto } from '#lib/murs/reduire-photo.ts';
	import Bouton from './Bouton.svelte';
	import Champ from './Champ.svelte';
	import Choix from './Choix.svelte';

	type Valeurs = { type?: string; texte?: string; priseDeConnaissance?: boolean; debut?: string; lieu?: string; equipes?: string[]; question?: string; reponses?: string[] };
	let {
		mur,
		equipes,
		form
	}: {
		mur: { nom: string; type: string; peutModerer: boolean };
		equipes: { id: number; nom: string; active: number }[];
		form?: { cible?: string; succes?: string; message?: string; erreurs?: Record<string, string>; valeurs?: Valeurs } | null;
	} = $props();

	const TYPES = [
		{ valeur: 'message', libelle: 'Message' },
		{ valeur: 'annonce', libelle: 'Annonce' },
		{ valeur: 'evenement', libelle: 'Événement' },
		{ valeur: 'bravo', libelle: 'Bravo' }
	];
	const concerne = $derived(form?.cible === 'publier');
	const valeurs = $derived<Valeurs>(concerne && !form?.succes ? (form?.valeurs ?? {}) : {});
	const erreurs = $derived<Record<string, string>>(concerne ? (form?.erreurs ?? {}) : {});
	// svelte-ignore state_referenced_locally
	let type = $state(valeurs.type ?? 'message');
	// Sans JavaScript, tous les champs restent visibles ; avec, seuls ceux du type choisi.
	let js = $state(false);
	let erreurPhotos = $state('');
	let envoi = $state(false);
	onMount(() => (js = true));

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
		// Refusée : le premier champ en erreur prend le focus. Envoyée : la nouvelle publication, sinon le titre du mur
		// (page de publications plus anciennes), sinon le contenu.
		return async ({ update, result, formElement }) => {
			await update();
			envoi = false;
			await tick();
			if (result.type === 'failure') formElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
			else if (result.type === 'success') (document.getElementById(`publication-${result.data?.id}`) ?? document.getElementById('titre-mur') ?? document.getElementById('contenu'))?.focus();
		};
	};
	const erreurPhoto = $derived(erreurPhotos || erreurs.photos);
</script>

<section id="publier" class="carte" aria-labelledby="titre-publier">
	<h2 id="titre-publier">Publier sur {mur.nom}</h2>
	<!-- Annoncé par la zone unique de la page ; ici, seulement visible. -->
	{#if concerne && (form?.message || form?.erreurs)}<p class="echec">{form?.message ?? 'La publication contient des erreurs.'}</p>{/if}
	{#if concerne && form?.succes}<p class="succes">{form.succes}</p>{/if}
	<form method="POST" action="?/publier" enctype="multipart/form-data" class="formulaire" use:enhance={surEnvoi}>
		<Choix id="publier-type" name="type" libelle="Type" options={TYPES} bind:valeur={type} erreur={erreurs.type} />

		<div class="champ">
			<label for="publier-texte">Texte</label>
			<textarea
				id="publier-texte"
				name="texte"
				rows="4"
				maxlength="4000"
				required
				aria-invalid={erreurs.texte ? 'true' : undefined}
				aria-describedby={erreurs.texte ? 'publier-texte-erreur' : undefined}
				value={valeurs.texte ?? ''}
			></textarea>
			{#if erreurs.texte}<p id="publier-texte-erreur" class="erreur">{erreurs.texte}</p>{/if}
		</div>

		{#if mur.peutModerer}
			<label class="case" hidden={js && type !== 'annonce'}>
				<input type="checkbox" name="priseDeConnaissance" value="oui" checked={valeurs.priseDeConnaissance} />
				Demander une prise de connaissance (annonce)
			</label>
		{/if}

		<fieldset class="groupe" hidden={js && type !== 'evenement'}>
			<legend>Pour un événement</legend>
			<Champ id="publier-debut" name="debut" type="datetime-local" libelle="Date et heure" valeur={valeurs.debut ?? ''} erreur={erreurs.debut} />
			<Champ id="publier-lieu" name="lieu" libelle="Lieu" maxlength={200} valeur={valeurs.lieu ?? ''} erreur={erreurs.lieu} />
			{#if mur.type === 'equipe'}
				<p class="aide">Toute l’équipe est convoquée.</p>
			{:else if equipes.some((e) => e.active === 1)}
				<fieldset class="convoques" aria-describedby="publier-convoques-aide">
					<legend>Équipes convoquées</legend>
					<p id="publier-convoques-aide" class="aide">Aucune équipe cochée : tout le mur est convoqué.</p>
					{#each equipes.filter((e) => e.active === 1) as e (e.id)}
						<label class="case"><input type="checkbox" name="equipe" value={e.id} checked={valeurs.equipes?.includes(String(e.id))} /> {e.nom}</label>
					{/each}
					{#if erreurs.convoques}<p class="erreur">{erreurs.convoques}</p>{/if}
				</fieldset>
			{/if}
		</fieldset>

		<details class="groupe" open={Boolean(valeurs.question || erreurs.sondage)}>
			<summary>Ajouter un sondage</summary>
			<div class="sondage">
				<Champ id="publier-question" name="question" libelle="Question" maxlength={200} valeur={valeurs.question ?? ''} erreur={erreurs.sondage} />
				<p class="aide">De 2 à 6 réponses, une seule par personne. Laissez vides les réponses en trop.</p>
				{#each [0, 1, 2, 3, 4, 5] as i (i)}
					<Champ id="publier-reponse-{i}" name="reponse" libelle="Réponse {i + 1}" maxlength={100} valeur={valeurs.reponses?.[i] ?? ''} />
				{/each}
			</div>
		</details>

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

		<Bouton type="submit" desactive={envoi}>{envoi ? 'Envoi…' : 'Publier'}</Bouton>
	</form>
</section>

<style>
	.carte {
		background: var(--surface);
		border: 1px solid var(--trait-doux);
		border-radius: var(--rayon-grand);
		padding: 14px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		scroll-margin-top: 1rem;
	}
	h2 {
		margin: 0;
		font: 700 1.375rem var(--police-titre);
	}
	p {
		margin: 0;
	}
	.formulaire {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.formulaire > :global(button) {
		align-self: flex-start;
	}
	.champ {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	label,
	legend,
	summary {
		font-weight: 600;
	}
	textarea,
	input[type='file'] {
		padding: 10px 14px;
		border: 2px solid var(--doux);
		border-radius: var(--rayon-petit);
		background: var(--surface);
		color: var(--encre);
		font: 400 1rem var(--police);
	}
	[aria-invalid='true'] {
		border-color: var(--accent);
	}
	.groupe {
		border: 1px solid var(--trait);
		border-radius: var(--rayon-petit);
		padding: 0 12px 12px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.groupe[hidden] {
		display: none;
	}
	details.groupe {
		display: block;
	}
	summary {
		min-height: var(--cible);
		display: flex;
		align-items: center;
		cursor: pointer;
	}
	.sondage {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.convoques {
		border: 0;
		padding: 0;
		margin: 0;
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
	.case input {
		width: 24px;
		height: 24px;
	}
	.aide {
		color: var(--doux);
		font-size: 0.9375rem;
	}
	.erreur {
		color: var(--accent);
		font-weight: 600;
		font-size: 0.9375rem;
	}
	.echec,
	.succes {
		padding: 12px 16px;
		border-radius: var(--rayon-petit);
		border: 2px solid var(--accent);
		font-weight: 600;
	}
	.succes {
		border-color: var(--ok);
	}
</style>
