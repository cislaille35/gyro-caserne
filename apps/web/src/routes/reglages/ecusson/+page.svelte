<script lang="ts">
	import centre from '$centre';
	import { enhance, type SubmitFunction } from '$app/forms';
	import { tick } from 'svelte';
	import { reduireEcusson } from '#lib/murs/reduire-photo.ts';
	import Bouton from '#lib/ui/Bouton.svelte';
	import ChampPhoto from '#lib/ui/ChampPhoto.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';

	let { data, form } = $props();

	// Une image déjà en JPEG ou WebP de 200 Ko au plus part telle quelle ; une autre (un PNG transparent) est refaite en WebP.
	const TAILLE_MAX = 200 * 1024;
	let champ = $state<HTMLInputElement>();
	let erreurLocale = $state('');
	let envoi = $state(false);
	const surEnvoi: SubmitFunction = async ({ formData, cancel }) => {
		erreurLocale = '';
		const f = formData.get('image');
		if (f instanceof File && f.size > 0 && !(['image/jpeg', 'image/webp'].includes(f.type) && f.size <= TAILLE_MAX)) {
			try {
				{
					const b = await reduireEcusson(f);
					formData.set('image', b, b.type === 'image/webp' ? 'ecusson.webp' : 'ecusson.jpg');
				}
			} catch (e) {
				erreurLocale = e instanceof Error ? `${e.message}.` : 'Image illisible.';
				cancel();
				await tick();
				champ?.focus();
				return;
			}
		}
		envoi = true;
		return async ({ update }) => {
			await update();
			envoi = false;
		};
	};
	const erreur = $derived(erreurLocale || (form?.cible === 'ecusson' ? form?.erreurs?.image : undefined));
</script>

<svelte:head>
	<title>Écusson du centre · Réglages · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<EnTetePage titre="Écusson du centre" phrase="Montré à la connexion et, en petit, dans l’en-tête à côté du nom du centre. Sans écusson, l’appli reste telle quelle." />

	<div role="status" class="masque">{form?.succes ?? ''}</div>
	{#if form?.succes}<p class="succes">{form.succes}</p>{/if}
	{#if form?.message}<p class="echec" role="alert">{form.message}</p>{/if}

	{#if data.ecusson !== null}
		<section class="apercu" aria-labelledby="t-apercu">
			<h2 id="t-apercu" class="titre-groupe">Aperçu</h2>
			<img class="grand" src="/ecusson?v={data.ecusson}" alt="Écusson de {centre.nom}" width="96" height="96" />
			<!-- L'en-tête tel que les agents le verront. -->
			<p class="entete" aria-hidden="true"><img src="/ecusson?v={data.ecusson}" alt="" width="20" height="20" />{centre.nom}</p>
		</section>
	{/if}

	<form method="POST" action="?/deposer" enctype="multipart/form-data" class="carte" use:enhance={surEnvoi}>
		<ChampPhoto bind:champ id="ecusson-image" name="image" libelle={data.ecusson === null ? 'Image de l’écusson' : 'Nouvelle image'} aide="JPEG, WebP ou PNG. Une image trop lourde ou en PNG est réduite avant l’envoi, en gardant son fond transparent." appel="Choisir une image" accept="image/jpeg,image/webp,image/*" {erreur} />
		<Bouton type="submit" desactive={envoi}>{data.ecusson === null ? 'Enregistrer l’écusson' : 'Remplacer l’écusson'}</Bouton>
	</form>

	{#if data.ecusson !== null}
		<details class="plus" open={form?.cible === 'retirer' && !form?.succes ? true : undefined}>
			<summary>Plus</summary>
			<form method="POST" action="?/retirer" class="carte">
				<p class="avertissement">L’écusson disparaîtra de la connexion et de l’en-tête. Son image est effacée.</p>
				<label class="case"><input type="checkbox" name="confirmation" value="oui" /> Je confirme</label>
				<Bouton type="submit" variante="grave">Retirer l’écusson</Bouton>
			</form>
		</details>
	{/if}
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--espace-20);
		max-width: var(--largeur-lecture);
	}
	p {
		margin: 0;
	}
	.carte,
	.apercu {
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
		padding: var(--espace-20);
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
		border-radius: var(--rayon-grand);
		background: var(--surface);
	}
	.apercu {
		align-items: flex-start;
	}
	.titre-groupe {
		margin: 0;
	}
	.grand {
		width: var(--ecusson-connexion);
		height: var(--ecusson-connexion);
		object-fit: contain;
	}
	.entete {
		display: inline-flex;
		align-items: center;
		gap: var(--espace-6);
		padding: var(--espace-8) var(--espace-12);
		border-radius: var(--rayon-petit);
		background: var(--entete-fond);
		color: var(--entete-doux);
		font-size: var(--texte-14);
	}
	.entete img {
		width: var(--ecusson-entete);
		height: var(--ecusson-entete);
		object-fit: contain;
	}
	.carte :global(button) {
		align-self: flex-start;
	}
	.avertissement {
		font-weight: 600;
	}
	.echec,
	.succes {
		padding: var(--espace-12) var(--espace-16);
		border-radius: var(--rayon-petit);
		border: 2px solid var(--accent);
		font-weight: 600;
	}
	.succes {
		border-color: var(--ok);
	}
</style>
