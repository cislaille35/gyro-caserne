<script lang="ts">
	import type { ApercuFiches, DonneesFichierFiches, FichierFichesLu } from '@gyro-caserne/socle';
	import { tick } from 'svelte';
	import { resumerFiche } from '#lib/engins/textes.ts';
	import { pluriel } from '#lib/pluriel.ts';
	import Bouton from '#lib/ui/Bouton.svelte';
	import Carte from '#lib/ui/Carte.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import Groupe from '#lib/ui/Groupe.svelte';

	let { data }: { data: { aujourdhui: string } } = $props();

	let occupe = $state(false);
	let erreur = $state('');
	let annonce = $state('');
	let lu = $state<FichierFichesLu | null>(null);
	let apercu = $state<ApercuFiches | null>(null);
	let fini = $state(false);
	let champ = $state<HTMLInputElement>();

	// Le classeur s'écrit et se lit dans le navigateur seulement.
	const classeur = () => import('#lib/engins/classeur.ts');
	const texteErreur = (e: unknown) => (e instanceof Error ? e.message : String(e));
	const changees = $derived(apercu?.fiches.filter((f) => resumerFiche(f) !== 'Aucun changement') ?? []);

	async function demander<T>(url: string, init?: RequestInit): Promise<T> {
		const reponse = await fetch(url, init).catch(() => {
			throw new Error('Connexion perdue : réessayez.');
		});
		if (reponse.redirected) throw new Error("Vous n'êtes plus connecté : rechargez la page.");
		const corps = (await reponse.json().catch(() => null)) as { message?: string } | null;
		if (!reponse.ok || corps === null) throw new Error(corps?.message ?? 'Réponse inattendue du serveur');
		return corps as T;
	}
	const poster = <T,>(url: string, corps: unknown) => demander<T>(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corps) });

	async function exporter() {
		erreur = '';
		occupe = true;
		try {
			const { ecrireClasseurFiches, nomDuFichierFiches } = await classeur();
			const donnees = await demander<DonneesFichierFiches>('/engins/fiches/fichier/donnees');
			const lien = document.createElement('a');
			lien.href = URL.createObjectURL(await ecrireClasseurFiches(donnees));
			lien.download = nomDuFichierFiches(data.aujourdhui);
			lien.click();
			setTimeout(() => URL.revokeObjectURL(lien.href), 1000);
		} catch (e) {
			erreur = texteErreur(e);
		} finally {
			occupe = false;
		}
	}

	async function importer() {
		const fichier = champ?.files?.[0];
		if (!fichier) return;
		erreur = '';
		annonce = '';
		apercu = null;
		fini = false;
		occupe = true;
		try {
			const { lireClasseurFiches } = await classeur();
			lu = await lireClasseurFiches(fichier).catch(() => {
				throw new Error("Ce fichier n'est pas un classeur .xlsx lisible");
			});
			apercu = await poster<ApercuFiches>('/engins/fiches/fichier/apercu', lu);
			annonce = 'Aperçu prêt, ci-dessous.';
			await tick();
			document.getElementById('titre-apercu')?.focus();
		} catch (e) {
			erreur = texteErreur(e);
		} finally {
			occupe = false;
			if (champ) champ.value = '';
		}
	}

	async function valider() {
		if (!lu || !apercu) return;
		occupe = true;
		erreur = '';
		try {
			await poster('/engins/fiches/fichier/appliquer', lu);
			fini = true;
			annonce = 'Fichier appliqué.';
			await tick();
			document.getElementById('titre-fini')?.focus();
		} catch (e) {
			erreur = texteErreur(e);
		} finally {
			occupe = false;
		}
	}

	function abandonner() {
		apercu = null;
		lu = null;
		annonce = 'Import abandonné.';
		champ?.focus();
	}
</script>

<svelte:head>
	<title>Fichier des fiches · Engins · Gyro Caserne</title>
</svelte:head>

<div class="fichier">
	<EnTetePage titre="Fichier des fiches" phrase="Toutes les fiches de prise de garde dans Excel ou LibreOffice : une feuille par type d’engin, une ligne par élément." retour={{ href: '/engins/fiches', libelle: 'Fiches' }} />

	<ol class="etapes" role="list">
		<li>
			<Carte titre="1. Exporter les fiches">
				<p class="note">Partez toujours de l’export : la colonne « Réf. » garde le lien de chaque élément avec son historique. Une ligne sans « Réf. » est un nouvel élément ; une ligne effacée retire l’élément. Une feuille absente laisse sa fiche telle quelle.</p>
				<div class="actions"><Bouton variante="secondaire" desactive={occupe} onclick={exporter}>Exporter les fiches</Bouton></div>
			</Carte>
		</li>
		<li>
			<Carte titre="2. Importer le fichier modifié">
				<div class="champ">
					<label for="fichier-fiches">Fichier des fiches</label>
					<p id="fichier-fiches-aide" class="note">Un fichier .xlsx tiré de l’export. Rien n’est écrit avant votre validation.</p>
					<input id="fichier-fiches" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" aria-describedby="fichier-fiches-aide" disabled={occupe} bind:this={champ} onchange={importer} />
				</div>
			</Carte>
		</li>
	</ol>

	<div role="alert">{#if erreur}<p class="echec">{erreur}</p>{/if}</div>
	<p class="annonce" aria-live="polite">{annonce}</p>

	{#if fini}
		<Carte titre="Fichier appliqué" ancre="titre-fini">
			<p>{pluriel(changees.length, 'fiche mise à jour', 'fiches mises à jour')}. Les changements valent pour la prochaine prise de garde.</p>
			<div class="actions"><a class="lien" href="/engins/fiches">Revenir aux fiches</a></div>
		</Carte>
	{:else if apercu}
		<Carte titre="3. Vérifier, puis valider" ancre="titre-apercu">
			<div class="apercu">
				<p class="resume">{changees.length ? pluriel(changees.length, 'fiche changée', 'fiches changées') : 'Aucun changement'}{apercu.erreurs.length ? `, ${pluriel(apercu.erreurs.length, 'erreur')}` : ''}</p>
				{#each apercu.fiches as f (f.type)}
					<Groupe titre="Fiche {f.type}" resume={resumerFiche(f) + (f.nouvelleVersion ? ` · deviendra la version ${f.version + 1}` : '')} niveauTitre={3}>
						<div class="details">
							{#each [['Ajoutés', f.ajoutes], ['Retirés', f.retires], ['Modifiés', f.modifies]] as const as [titre, liste] (titre)}
								{#if liste.length}
									<section>
										<h4>{titre}</h4>
										<ul>{#each liste as l, i (i)}<li>{l}</li>{/each}</ul>
									</section>
								{/if}
							{/each}
							{#if f.ordre}<p>Le rangement des zones ou des éléments change.</p>{/if}
							{#if resumerFiche(f) === 'Aucun changement'}<p class="note">Rien ne change sur cette fiche.</p>{/if}
						</div>
					</Groupe>
				{/each}
				{#if apercu.erreurs.length}
					<section>
						<h4>{pluriel(apercu.erreurs.length, 'erreur', 'erreurs')}</h4>
						<p class="note">Corrigez le fichier, puis importez-le de nouveau : rien n’est appliqué tant qu’il reste une erreur.</p>
						<ul class="erreurs">
							{#each apercu.erreurs as e, i (i)}<li>{e.feuille}, ligne {e.ligne} : {e.message}</li>{/each}
						</ul>
					</section>
				{/if}
				<div class="actions">
					{#if !apercu.erreurs.length && changees.length}<Bouton desactive={occupe} onclick={valider}>Valider<span class="cache">{' '}l’import</span></Bouton>{/if}
					<Bouton variante="secondaire" desactive={occupe} onclick={abandonner}>Abandonner<span class="cache">{' '}l’import</span></Bouton>
				</div>
			</div>
		</Carte>
	{/if}
</div>

<style>
	.fichier,
	.etapes {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.etapes {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	p,
	h4 {
		margin: 0;
	}
	.note {
		color: var(--doux);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		margin-top: 12px;
	}
	.champ {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	label {
		font-weight: 700;
	}
	input[type='file'] {
		min-height: var(--cible);
		max-width: 100%;
		font: inherit;
	}
	.echec {
		padding: 12px 16px;
		border-radius: var(--rayon-petit);
		border: 2px solid var(--accent);
		font-weight: 600;
	}
	.apercu,
	.details {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.details {
		padding: 12px 14px 14px;
	}
	h4 {
		margin-bottom: 6px;
		font: 700 1.0625rem var(--police-titre);
	}
	ul {
		margin: 0;
		padding-left: 20px;
		overflow-wrap: anywhere;
	}
	li + li {
		margin-top: 4px;
	}
	.resume {
		font-weight: 700;
	}
	.lien {
		display: inline-flex;
		align-items: center;
		min-height: var(--cible);
		font-weight: 700;
		color: var(--texte);
	}
	.annonce,
	.cache {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
	@media (min-width: 1024px) {
		.etapes {
			display: grid;
			grid-template-columns: 1fr 1fr;
			align-items: stretch;
		}
	}
</style>
