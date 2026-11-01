<script lang="ts">
	import { FEUILLES_PLANNING, type ApercuPlanning, type DonneesFichierPlanning, type FichierPlanningLu } from '@gyro-caserne/socle';
	import { tick } from 'svelte';
	import { duAu, jourLong, momentLong } from '#lib/planning/dates.ts';
	import Bouton from '#lib/ui/Bouton.svelte';
	import Carte from '#lib/ui/Carte.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import { pluriel } from '#lib/pluriel.ts';
	import { alertesFetes, resumer } from './textes.ts';

	let { data } = $props();

	let occupe = $state(false);
	let erreur = $state('');
	let annonce = $state('');
	let lu = $state<FichierPlanningLu | null>(null);
	let apercu = $state<ApercuPlanning | null>(null);
	let fini = $state(false);
	let champ = $state<HTMLInputElement>();

	// Le classeur s'écrit et se lit dans le navigateur seulement.
	const classeur = () => import('#lib/planning/classeur.ts');
	const NOMS = [...Object.values(FEUILLES_PLANNING), 'Été'];
	const texteErreur = (e: unknown) => (e instanceof Error ? e.message : String(e));
	const rien = $derived(apercu !== null && resumer(apercu) === 'Aucun changement');

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
			const { ecrireClasseurPlanning, nomDuFichierPlanning } = await classeur();
			const donnees = await demander<DonneesFichierPlanning>(`/planning/preparer/fichier/donnees?annee=${data.annee}`);
			const lien = document.createElement('a');
			lien.href = URL.createObjectURL(await ecrireClasseurPlanning(donnees));
			lien.download = nomDuFichierPlanning(data.annee);
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
			const { lireClasseurPlanning } = await classeur();
			lu = await lireClasseurPlanning(fichier, NOMS).catch((e: unknown) => {
				throw new Error(texteErreur(e).startsWith('Aucune feuille') ? texteErreur(e) : "Ce fichier n'est pas un classeur .xlsx lisible");
			});
			apercu = await poster<ApercuPlanning>('/planning/preparer/fichier/apercu', { annee: data.annee, lu });
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
			await poster('/planning/preparer/fichier/appliquer', { annee: data.annee, lu });
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
	<title>Fichier du planning {data.annee} · Gyro Caserne</title>
</svelte:head>

<div class="fichier">
	<EnTetePage titre="Fichier du planning {data.annee}" phrase="Préparer l’année en une fois, dans Excel ou LibreOffice : semaines, manœuvres, vacances scolaires et été. Les fériés sont calculés." retour={{ href: `/planning/preparer?annee=${data.annee}`, libelle: 'Préparer l’année' }} />

	<Carte titre="Exporter l’année">
		<p class="note">Une année vide donne un modèle avec le roulement calculé. Une manœuvre sans « Réf. » est nouvelle ; une ligne retirée retire la manœuvre (annulée si elle est déjà annoncée).</p>
		<div class="actions"><Bouton variante="secondaire" desactive={occupe} onclick={exporter}>Exporter l’année {data.annee}</Bouton></div>
	</Carte>

	<Carte titre="Importer un fichier">
		<div class="champ">
			<label for="fichier-planning">Fichier du planning</label>
			<p id="fichier-planning-aide" class="note">Un fichier .xlsx tiré de l’export. Rien n’est écrit avant votre validation.</p>
			<input id="fichier-planning" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" aria-describedby="fichier-planning-aide" disabled={occupe} bind:this={champ} onchange={importer} />
		</div>
	</Carte>

	<div role="alert">{#if erreur}<p class="echec">{erreur}</p>{/if}</div>
	<p class="annonce" aria-live="polite">{annonce}</p>

	{#if fini}
		<Carte titre="Fichier appliqué" ancre="titre-fini">
			<p>{resumer(apercu!)}.</p>
			<p class="note">Année publiée : les agents voient déjà les changements ; les convoqués des manœuvres annoncées sont prévenus.</p>
			<div class="actions"><a class="lien" href="/planning/preparer?annee={data.annee}">Revenir à Préparer {data.annee}</a></div>
		</Carte>
	{:else if apercu}
		<Carte titre="Aperçu de l’import" ancre="titre-apercu">
			<div class="apercu">
				<p class="resume">{resumer(apercu)}</p>
				{#each alertesFetes(apercu) as a (a)}<p class="alerte"><strong>Tour des fêtes :</strong> {a}</p>{/each}

				{#if apercu.semaines.length}
					<section>
						<h3>{pluriel(apercu.semaines.length, 'semaine changée', 'semaines changées')}</h3>
						<ul>
							{#each apercu.semaines as s (s.debut)}<li>S{s.numero}, semaine du {jourLong(s.debut)} : {s.avant} <span aria-hidden="true">→</span><span class="cache">devient</span> {s.apres}</li>{/each}
						</ul>
					</section>
				{/if}
				{#each [['ajoutees', 'manœuvre ajoutée', 'manœuvres ajoutées'], ['modifiees', 'manœuvre modifiée', 'manœuvres modifiées'], ['retirees', 'manœuvre retirée', 'manœuvres retirées']] as const as [cle, s, p] (cle)}
					{#if apercu.manoeuvres[cle].length}
						<section>
							<h3>{pluriel(apercu.manoeuvres[cle].length, s, p)}</h3>
							<ul>
								{#each apercu.manoeuvres[cle] as m, i (i)}<li>{momentLong(m.debut)} · {m.theme}{'annoncee' in m && m.annoncee ? ' (déjà annoncée : marquée « Annulée », convoqués prévenus)' : ''}</li>{/each}
							</ul>
						</section>
					{/if}
				{/each}
				{#if apercu.vacances.ajoutees.length + apercu.vacances.retirees.length}
					<section>
						<h3>Vacances scolaires</h3>
						<ul>
							{#each apercu.vacances.ajoutees as v (v.nom + v.debut)}<li>Ajoutées : {v.nom}, {duAu(v.debut, v.fin)}</li>{/each}
							{#each apercu.vacances.retirees as v (v.nom + v.debut)}<li>Retirées : {v.nom}, {duAu(v.debut, v.fin)}</li>{/each}
						</ul>
					</section>
				{/if}
				{#if apercu.erreurs.length}
					<section>
						<h3>{pluriel(apercu.erreurs.length, 'erreur', 'erreurs')}</h3>
						<p class="note">Corrigez le fichier, puis importez-le de nouveau : rien n’est appliqué tant qu’il reste une erreur.</p>
						<ul class="erreurs">
							{#each apercu.erreurs as e, i (i)}<li>{e.feuille}, ligne {e.ligne} : {e.message}</li>{/each}
						</ul>
					</section>
				{/if}
				<div class="actions">
					{#if !apercu.erreurs.length && !rien}<Bouton desactive={occupe} onclick={valider}>Valider<span class="cache">{' '}l’import</span></Bouton>{/if}
					<Bouton variante="secondaire" desactive={occupe} onclick={abandonner}>Abandonner<span class="cache">{' '}l’import</span></Bouton>
				</div>
			</div>
		</Carte>
	{/if}
</div>

<style>
	.fichier {
		display: flex;
		flex-direction: column;
		gap: 16px;
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
	.echec,
	.alerte {
		padding: 12px 16px;
		border-radius: var(--rayon-petit);
		border: 2px solid var(--accent);
		font-weight: 600;
	}
	.alerte {
		font-weight: 400;
	}
	.apercu {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	h3 {
		margin: 0 0 8px;
		font: 700 1.125rem var(--police-titre);
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
</style>
