<script lang="ts">
	import type { VueMessage } from '@gyro-caserne/socle';
	import { enhance, type ActionResult, type SubmitFunction } from '$app/forms';
	import { onMount, tick, untrack } from 'svelte';
	import { reduirePhoto } from '#lib/murs/reduire-photo.ts';
	import { entreeEnvoie } from './fil.ts';
	import { avecBrouillon } from './infos.ts';

	let {
		cle,
		texteInitial = '',
		prerempli = '',
		erreurInitiale = '',
		apres
	}: {
		// La clé du brouillon sur l'appareil (cleBrouillon : par personne et par conversation).
		cle: string;
		texteInitial?: string;
		// « Répondre en privé » : le début de la publication citée.
		prerempli?: string;
		erreurInitiale?: string;
		// Après un envoi (ou une modification) réussi : le parent rafraîchit ou change de page.
		apres: (resultat: ActionResult) => Promise<void> | void;
	} = $props();

	const PHOTOS_MAX = 4;
	const BROUILLON = untrack(() => cle);

	let texte = $state(untrack(() => texteInitial || prerempli));
	let erreur = $state(untrack(() => erreurInitiale));
	let reponse = $state<VueMessage | null>(null);
	let edition = $state<VueMessage | null>(null);
	let photos = $state<{ fichier: File; apercu: string }[]>([]);
	let envoi = $state(false);
	let champ: HTMLTextAreaElement;
	let champPhotos = $state<HTMLInputElement>();

	const lire = () => {
		try {
			return localStorage.getItem(BROUILLON) ?? '';
		} catch {
			return '';
		}
	};
	const garder = (valeur: string) => {
		try {
			if (valeur.trim()) localStorage.setItem(BROUILLON, valeur);
			else localStorage.removeItem(BROUILLON);
		} catch {
			// Stockage indisponible (navigation privée) : le brouillon n'est pas gardé.
		}
	};

	// Le champ grandit avec le texte, jusqu'à 5 lignes ; au-delà, il défile.
	function ajuster() {
		if (!champ) return;
		champ.style.height = 'auto';
		champ.style.height = `${champ.scrollHeight + 2}px`;
	}

	onMount(() => {
		if (!texteInitial) texte = avecBrouillon(prerempli, lire());
		void tick().then(() => {
			ajuster();
			// « Répondre en privé » : on écrit tout de suite, après la citation.
			if (prerempli && champ) {
				champ.focus();
				champ.setSelectionRange(champ.value.length, champ.value.length);
			}
		});
		return () => photos.forEach((p) => URL.revokeObjectURL(p.apercu));
	});

	export function repondre(m: VueMessage) {
		if (edition) annulerEdition();
		reponse = m;
		champ.focus();
	}
	export function modifier(m: VueMessage) {
		reponse = null;
		edition = m;
		texte = m.texte;
		void tick().then(ajuster);
		champ.focus();
	}
	function annulerEdition() {
		edition = null;
		texte = lire();
		void tick().then(ajuster);
	}

	const qui = (m: VueMessage) => (m.moi ? 'vous' : (m.auteur?.prenom ?? 'un ancien membre'));
	const extrait = (m: VueMessage) => m.texte || (m.photos.length > 0 ? 'Photo' : '');

	// À l'ordinateur, Entrée envoie et Maj + Entrée va à la ligne ; au téléphone, Entrée va à la ligne.
	function touche(e: KeyboardEvent) {
		if (!entreeEnvoie(e, matchMedia('(hover: hover) and (pointer: fine)').matches)) return;
		e.preventDefault();
		champ.form?.requestSubmit();
	}

	function choisirPhotos() {
		const choisies = [...(champPhotos?.files ?? [])];
		if (champPhotos) champPhotos.value = '';
		const place = PHOTOS_MAX - photos.length;
		erreur = choisies.length > place ? `${PHOTOS_MAX} photos au plus.` : '';
		photos = [...photos, ...choisies.slice(0, Math.max(0, place)).map((fichier) => ({ fichier, apercu: URL.createObjectURL(fichier) }))];
	}
	function retirerPhoto(i: number) {
		URL.revokeObjectURL(photos[i]!.apercu);
		photos = photos.filter((_, j) => j !== i);
		champPhotos?.focus();
	}

	// Avec JavaScript : les photos sont réduites avant l'envoi, et la page ne se recharge pas.
	const surEnvoi: SubmitFunction = async ({ formData, cancel }) => {
		if (envoi) return cancel();
		erreur = '';
		if (!texte.trim() && photos.length === 0) {
			erreur = 'Écrivez votre message.';
			champ.focus();
			return cancel();
		}
		envoi = true;
		formData.delete('photos');
		try {
			for (const [i, p] of photos.entries()) formData.append('photos', await reduirePhoto(p.fichier), `photo-${i + 1}.jpg`);
		} catch (e) {
			erreur = e instanceof Error ? `${e.message}.` : 'Photo illisible.';
			envoi = false;
			return cancel();
		}
		return async ({ result }) => {
			envoi = false;
			if (result.type === 'failure') {
				erreur = (result.data as { message?: string } | undefined)?.message ?? 'Le message n’est pas parti.';
				return;
			}
			if (result.type === 'error') {
				erreur = 'Le message n’est pas parti. Réessayez.';
				return;
			}
			const etaitEdition = edition !== null;
			edition = null;
			reponse = null;
			photos.forEach((p) => URL.revokeObjectURL(p.apercu));
			photos = [];
			texte = etaitEdition ? lire() : '';
			if (!etaitEdition) garder('');
			await tick();
			ajuster();
			champ.focus();
			await apres(result);
		};
	};
</script>

<div class="saisie">
	<!-- Toujours présent, pour que l'annonce d'un refus soit lue. -->
	<p class="erreur" class:masque={!erreur} role="alert">{erreur}</p>
	{#if reponse}
		<div class="apercu">
			<span class="cite"><strong>Réponse à {qui(reponse)}</strong> <span class="extrait">{extrait(reponse)}</span></span>
			<button type="button" class="annuler" aria-label="Annuler la réponse" onclick={() => ((reponse = null), champ.focus())}>✕</button>
		</div>
	{:else if edition}
		<div class="apercu edition">
			<span class="cite"><strong>Modifier le message</strong> <span class="extrait">{edition.texte}</span></span>
			<button type="button" class="annuler" aria-label="Annuler la modification" onclick={() => (annulerEdition(), champ.focus())}>✕</button>
		</div>
	{/if}
	{#if photos.length > 0}
		<ul class="photos" aria-label="Photos à envoyer">
			{#each photos as p, i (p.apercu)}
				<li>
					<img src={p.apercu} alt="Photo {i + 1}" />
					<button type="button" class="retirer" aria-label="Retirer la photo {i + 1}" onclick={() => retirerPhoto(i)}>✕</button>
				</li>
			{/each}
		</ul>
	{/if}
	<form method="POST" action={edition ? '?/modifier' : '?/envoyer'} enctype="multipart/form-data" use:enhance={surEnvoi}>
		{#if edition}<input type="hidden" name="id" value={edition.id} />{/if}
		<input type="hidden" name="reponseA" value={reponse?.id ?? ''} />
		{#if !edition}
			<input class="fichiers" id="saisie-photos" type="file" name="photos" accept="image/jpeg,image/webp" multiple bind:this={champPhotos} onchange={choisirPhotos} />
			<label class="rond plus" for="saisie-photos"
				><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg><span class="masque"
					>Ajouter des photos (4 au plus)</span
				></label
			>
		{/if}
		<label class="masque" for="saisie-texte">Votre message</label>
		<textarea
			id="saisie-texte"
			name="texte"
			rows="1"
			maxlength="4000"
			placeholder="Message"
			bind:value={texte}
			bind:this={champ}
			oninput={(e) => {
				ajuster();
				if (!edition) garder(e.currentTarget.value);
			}}
			onkeydown={touche}
		></textarea>
		<button type="submit" class="rond envoyer" aria-label={edition ? 'Enregistrer la modification' : 'Envoyer'}
			><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"
				>{#if edition}<path d="M5 12l5 5L20 7" />{:else}<path d="M4 12l16-8-6 16-3-7z" />{/if}</svg
			></button
		>
	</form>
</div>

<style>
	.saisie {
		display: flex;
		flex-direction: column;
	}
	.erreur {
		margin: 8px 12px 0;
		padding: 8px 12px;
		border: 1px solid var(--statut-danger-trait);
		border-radius: var(--rayon-petit);
		background: var(--statut-danger-fond);
		color: var(--statut-danger-texte);
		font-weight: 600;
	}
	.apercu {
		margin: 8px 12px 0;
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.cite {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		padding: 5px 8px;
		border-left: 3px solid var(--statut-info-texte);
		border-radius: 6px;
		background: var(--fond);
		font-size: 0.875rem;
	}
	.cite strong {
		color: var(--statut-info-texte);
		font-size: 0.8125rem;
	}
	.edition .cite {
		border-left-color: var(--accent);
	}
	.edition .cite strong {
		color: var(--encre);
	}
	.extrait {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.annuler,
	.retirer {
		flex: none;
		width: var(--cible);
		height: var(--cible);
		border: 0;
		border-radius: 50%;
		background: none;
		color: var(--doux);
		font-size: 1.125rem;
		cursor: pointer;
	}
	.photos {
		list-style: none;
		margin: 8px 12px 0;
		padding: 0;
		display: flex;
		gap: 8px;
	}
	.photos li {
		position: relative;
	}
	.photos img {
		display: block;
		width: 64px;
		height: 64px;
		border-radius: 10px;
		object-fit: cover;
	}
	.retirer {
		position: absolute;
		top: -14px;
		right: -14px;
		background: var(--surface);
		box-shadow: 0 1px 4px color-mix(in srgb, var(--encre) 25%, transparent);
	}
	form {
		padding: 8px 10px;
		display: flex;
		align-items: flex-end;
		gap: 8px;
	}
	.rond {
		flex: none;
		width: var(--cible);
		height: var(--cible);
		border: 0;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}
	.plus {
		background: var(--fond);
		color: var(--encre);
	}
	.fichiers {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
		overflow: hidden;
	}
	.fichiers:focus-visible + .plus {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}
	textarea {
		flex: 1;
		min-width: 0;
		min-height: var(--cible);
		max-height: calc(5 * 1.5em + 22px);
		box-sizing: border-box;
		padding: 10px 16px;
		border: 1px solid var(--statut-neutre-trait);
		border-radius: 22px;
		background: var(--surface);
		color: var(--encre);
		font: inherit;
		line-height: 1.5;
		resize: none;
	}
	textarea::placeholder {
		color: var(--doux);
	}
	.envoyer {
		background: var(--rouge);
		color: var(--sur-rouge);
	}
	.envoyer:hover {
		background: var(--rouge-survol);
	}
	.masque {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
