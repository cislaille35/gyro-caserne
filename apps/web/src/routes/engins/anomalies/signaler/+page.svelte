<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { GENRES } from '#lib/engins/textes.ts';
	import { reduirePhoto } from '#lib/murs/reduire-photo.ts';
	import Bouton from '#lib/ui/Bouton.svelte';
	import ChampPhoto from '#lib/ui/ChampPhoto.svelte';
	import ChoixRadio from '#lib/ui/ChoixRadio.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';

	type Donnees = { engins: { id: number; nom: string; type: string }[]; enginId: number | null; peutSignaler: boolean };
	type Reponse = { engin?: string; libelle?: string; genre?: string; note?: string; message?: string } | null;
	let { data, form }: { data: Donnees; form: Reponse } = $props();

	const choisi = $derived(form?.engin ?? (data.enginId === null ? '' : String(data.enginId)));
	const nomChoisi = $derived(data.engins.find((e) => String(e.id) === choisi)?.nom);

	// Avec JavaScript, la photo est réduite avant l'envoi (200 Ko au plus, comme ailleurs).
	let erreurPhoto = $state('');
	let envoi = $state(false);
	const soumettre: SubmitFunction = async ({ formData, cancel }) => {
		erreurPhoto = '';
		const fichier = formData.get('photo');
		if (fichier instanceof File && fichier.size > 0) {
			try {
				formData.set('photo', await reduirePhoto(fichier), 'photo.jpg');
			} catch (x) {
				erreurPhoto = x instanceof Error ? `${x.message}.` : 'Photo illisible.';
				return cancel();
			}
		}
		envoi = true;
		return async ({ update }) => {
			await update();
			envoi = false;
		};
	};
</script>

<svelte:head>
	<title>Signaler un problème · Engins · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<EnTetePage
		titre="Signaler un problème"
		phrase={nomChoisi ? `Sur ${nomChoisi}. L’engin reste disponible : le référent engins et les chefs sont prévenus et décident.` : 'L’engin reste disponible : le référent engins et les chefs sont prévenus et décident.'}
		retour={data.enginId !== null && nomChoisi ? { href: `/engins/${data.enginId}`, libelle: nomChoisi } : { href: '/engins/anomalies', libelle: 'Anomalies' }}
	/>

	{#if !data.peutSignaler}
		<p class="panneau">Le signalement est réservé aux agents du centre.</p>
	{:else}
		<form method="POST" enctype="multipart/form-data" use:enhance={soumettre} class="panneau">
			<ChoixRadio id="engin" legende="Engin" name="engin" disposition="tuiles" requis valeur={choisi} options={data.engins.map((e) => ({ valeur: String(e.id), libelle: e.nom, sous: e.nom === e.type ? undefined : e.type }))} />
			<div class="champ">
				<label for="libelle">Le problème</label>
				<input id="libelle" name="libelle" type="text" maxlength="120" required autocomplete="off" placeholder="Ex. : treuil hors service" value={form?.libelle ?? ''} />
			</div>
			<ChoixRadio id="genre" legende="C’est" name="genre" valeur={form?.genre ?? 'abime'} options={Object.entries(GENRES).map(([valeur, libelle]) => ({ valeur, libelle }))} />
			<div class="champ">
				<label for="note">Note <span class="doux">(facultative)</span></label>
				<textarea id="note" name="note" maxlength="300" rows="3">{form?.note ?? ''}</textarea>
			</div>
			<ChampPhoto id="photo" name="photo" libelle="Photo" precision="(facultative)" capture="environment" />
			{#if erreurPhoto}<p class="echec" role="alert">{erreurPhoto}</p>{/if}
			{#if form?.message}<p class="echec" role="alert">{form.message}</p>{/if}
			<div><Bouton type="submit" desactive={envoi}>Signaler</Bouton></div>
		</form>
	{/if}
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 24px;
		max-width: 640px;
	}
	.panneau {
		display: flex;
		flex-direction: column;
		gap: 18px;
		margin: 0;
		padding: 16px;
		background: var(--surface);
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
		border-radius: var(--rayon-grand);
	}
	.champ {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	label {
		font-weight: 700;
	}
	input[type='text'],
	textarea {
		min-height: var(--cible);
		padding: 8px 12px;
		border: 1px solid var(--trait);
		border-radius: var(--rayon-petit);
		background: var(--surface);
		color: var(--encre);
		font: inherit;
	}
	.doux {
		color: var(--doux);
		font-weight: 400;
	}
	.echec {
		margin: 0;
		color: var(--statut-danger-texte);
		font-weight: 600;
	}
</style>
