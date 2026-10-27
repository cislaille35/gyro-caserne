<script lang="ts">
	import type { Apercu as TypeApercu, DonneesFichier } from '@gyro-caserne/socle';
	import { appliquerTout, type CompteRendu as TypeCompteRendu } from '#lib/fichier-effectif/appliquer.ts';
	import Bouton from '#lib/ui/Bouton.svelte';
	import Carte from '#lib/ui/Carte.svelte';
	import Apercu from './Apercu.svelte';
	import CompteRendu from './CompteRendu.svelte';
	import { compter } from './textes.ts';

	let { data } = $props();

	let etape = $state<'choix' | 'apercu' | 'application' | 'fini'>('choix');
	let occupe = $state(false);
	let erreur = $state('');
	let annonce = $state('');
	let apercu = $state<TypeApercu | null>(null);
	let compte = $state<TypeCompteRendu | null>(null);
	let avancement = $state({ fait: 0, total: 0 });
	let champ = $state<HTMLInputElement>();

	// Le classeur s'écrit et se lit dans le navigateur seulement.
	const classeur = () => import('#lib/fichier-effectif/classeur.ts');
	const texteErreur = (e: unknown) => (e instanceof Error ? e.message : String(e));

	async function demander<T>(url: string, init?: RequestInit): Promise<T> {
		const reponse = await fetch(url, init);
		if (reponse.redirected) throw new Error("Vous n'êtes plus connecté : rechargez la page.");
		const corps = (await reponse.json().catch(() => null)) as { message?: string } | null;
		if (!reponse.ok || corps === null) throw new Error(corps?.message ?? 'Réponse inattendue du serveur');
		return corps as T;
	}
	const poster = <T,>(url: string, corps: unknown) =>
		demander<T>(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corps) });

	async function telecharger(modele: boolean) {
		erreur = '';
		occupe = true;
		try {
			const { ecrireClasseur, nomDuFichier } = await classeur();
			const donnees = await demander<DonneesFichier>(`/agents/fichier/donnees${modele ? '?modele=1' : ''}`);
			const lien = document.createElement('a');
			lien.href = URL.createObjectURL(await ecrireClasseur(donnees));
			lien.download = nomDuFichier(modele, data.aujourdhui);
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
		compte = null;
		etape = 'choix';
		occupe = true;
		try {
			const { lireClasseur } = await classeur();
			const lu = await lireClasseur(fichier).catch((e: unknown) => {
				throw new Error(texteErreur(e).startsWith('Feuille « Effectif »') ? texteErreur(e) : "Ce fichier n'est pas un classeur .xlsx lisible");
			});
			apercu = await poster<TypeApercu>('/agents/fichier/apercu', lu);
			etape = 'apercu';
			annonce = 'Aperçu prêt, ci-dessous.';
		} catch (e) {
			erreur = texteErreur(e);
		} finally {
			occupe = false;
			// Le même fichier, corrigé, peut être redéposé.
			if (champ) champ.value = '';
		}
	}

	async function valider() {
		if (!apercu) return;
		const operations = apercu.operations;
		etape = 'application';
		occupe = true;
		avancement = { fait: 0, total: operations.length };
		annonce = `0 / ${operations.length}`;
		compte = await appliquerTout(
			operations,
			(operation, nouvelles) => poster('/agents/fichier/operation', { operation, nouvelles }),
			(fait) => {
				avancement = { fait, total: operations.length };
				annonce = `${fait} / ${operations.length}`;
			}
		);
		occupe = false;
		etape = 'fini';
		annonce = `Import terminé : ${compter(compte.appliquees, 'opération appliquée', 'opérations appliquées')}, ${compter(compte.erreurs.length, 'erreur', 'erreurs')}.`;
	}

	function abandonner() {
		apercu = null;
		etape = 'choix';
		annonce = 'Import abandonné.';
		champ?.focus();
	}
</script>

<svelte:head>
	<title>Fichier de l'effectif · Agents · Gyro Caserne</title>
</svelte:head>

<div class="fichier">
	<h1>Fichier de l'effectif</h1>
	<p class="note">Pour charger ou changer l'effectif en masse, dans Excel ou LibreOffice. Pour un seul agent, passez par sa fiche.</p>

	<Carte titre="Télécharger">
		<p class="note">Le modèle vierge sert au premier chargement ; l'export, aux mises à jour.</p>
		<div class="actions">
			<Bouton variante="secondaire" desactive={occupe} onclick={() => telecharger(true)}>Télécharger le modèle vierge</Bouton>
			<Bouton variante="secondaire" desactive={occupe} onclick={() => telecharger(false)}>Exporter l'effectif</Bouton>
		</div>
	</Carte>

	<Carte titre="Importer">
		<div class="champ">
			<label for="fichier-import">Importer un fichier</label>
			<p id="fichier-import-aide" class="note">Un fichier .xlsx tiré du modèle ou d'un export. Rien n'est écrit avant votre validation.</p>
			<input id="fichier-import" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" aria-describedby="fichier-import-aide" disabled={occupe} bind:this={champ} onchange={importer} />
		</div>
	</Carte>

	<div role="alert">{#if erreur}<p class="echec">{erreur}</p>{/if}</div>
	<p class="annonce" aria-live="polite">{annonce}</p>

	{#if etape === 'apercu' && apercu}
		<Apercu {apercu} onvalider={valider} onabandonner={abandonner} />
	{:else if etape === 'application'}
		<Carte titre="Application en cours">
			<p class="progression">{avancement.fait} / {avancement.total}</p>
			<progress max={avancement.total} value={avancement.fait} aria-hidden="true"></progress>
			<p class="note">Gardez cette page ouverte jusqu'à la fin.</p>
		</Carte>
	{:else if etape === 'fini' && apercu && compte}
		<CompteRendu {compte} departs={apercu.departs} />
		<Apercu {apercu} apres />
	{/if}
</div>

<style>
	.fichier {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	h1 {
		margin: 0;
	}
	p {
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
	/* L'avancement est lu par les lecteurs d'écran ; à l'écran, la carte l'affiche. */
	.annonce {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
	.progression {
		font: 700 1.5rem var(--police-titre);
	}
	progress {
		width: 100%;
		margin: 8px 0;
	}
</style>
