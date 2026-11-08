<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { extraitDemande, LIMITE_HABILLEMENT, type QuoiGesteHabillement, type VueDemandeHabillement } from '@gyro-caserne/socle';
	import { dateCourte, heureCourte } from '#lib/engins/textes.ts';
	import { ETAPES_SUIVI, etatDemande, rangSuivi, RECUPERATIONS, TEXTES_FIL } from '#lib/habillement.ts';
	import Panneau from '#lib/planning/Panneau.svelte';
	import Bouton from '#lib/ui/Bouton.svelte';
	import Carte from '#lib/ui/Carte.svelte';
	import Champ from '#lib/ui/Champ.svelte';
	import ChoixRadio from '#lib/ui/ChoixRadio.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import Pastille from '#lib/ui/Pastille.svelte';

	type Reponse = { quoi?: string | null; succes?: string; message?: string } | null;
	let { data, form }: { data: { demande: VueDemandeHabillement; envoyee?: boolean }; form: Reponse } = $props();

	const d = $derived(data.demande);
	const peut = (quoi: QuoiGesteHabillement) => d.gestes.includes(quoi);
	const etat = $derived(etatDemande(d));
	const arretee = $derived(d.etape === 'refusee' || d.etape === 'annulee');
	const rang = $derived(rangSuivi(d.etape));
	const etapeDe = (i: number) => (d.etape === 'livree' || i < rang ? 'faite' : arretee ? 'a-venir' : i === rang ? 'en-cours' : 'a-venir');
	const LUS: Record<string, string> = { faite: 'faite', 'en-cours': 'en cours', 'a-venir': 'à venir' };
	const moment = (le: string) => `${dateCourte(le)}, ${heureCourte(le)}`;
	// La question en attente de l'agent : rappelée dans le suivi, avec un lien vers la réponse.
	const question = $derived(d.etape === 'question' ? d.fil.findLast((f) => f.quoi === 'question') : undefined);
	const gestionnaire = $derived(d.gestes.some((g) => g !== 'repondre' && g !== 'annuler') || !d.sienne);

	// Un seul envoi à la fois ; le message de réussite est gardé (la navigation qui ferme un panneau efface `form`).
	let envoi = $state(false);
	let reussite = $state('');
	let message = $state('');
	const soumettre: SubmitFunction = ({ formElement }) => {
		envoi = true;
		reussite = '';
		const ouvert = panneau;
		return async ({ update, result }) => {
			await update({ navigate: false, reset: result.type === 'success' });
			envoi = false;
			if (result.type === 'success') {
				reussite = String(result.data?.succes ?? '');
				message = '';
				if (ouvert) await goto(sans, { replaceState: true, reset: false });
				document.getElementById('titre-suivi')?.focus();
			}
			formElement.querySelector('textarea')?.blur();
		};
	};

	// Poser une question, traiter, livrer : un panneau chacun, ouvert par l'adresse (`?panneau=`) ou rouvert par un refus.
	const PANNEAUX = ['question', 'traiter', 'livrer'] as const;
	type Cle = (typeof PANNEAUX)[number];
	const TITRES: Record<Cle, string> = { question: 'Poser une question', traiter: 'Traiter la demande', livrer: 'Livrer' };
	const adresse = (cle: Cle | null) => {
		const p = new URLSearchParams(page.url.search);
		p.delete('envoyee');
		if (cle) p.set('panneau', cle);
		else p.delete('panneau');
		return `?${p}`;
	};
	const sans = $derived(adresse(null));
	const panneau = $derived.by((): Cle | null => {
		const demande = form?.message && PANNEAUX.find((c) => c === form?.quoi) ? (form.quoi as Cle) : PANNEAUX.find((c) => c === page.url.searchParams.get('panneau'));
		return demande && peut(demande) ? demande : null;
	});
	let issue = $state('stock');
	let recuperation = $state(RECUPERATIONS[0]!.valeur);
	const ISSUES = [
		{ valeur: 'stock', libelle: 'En stock', sous: 'Sortie du stock du centre' },
		{ valeur: 'commande', libelle: 'Commandée au SDIS', sous: 'Livrée plus tard' },
		{ valeur: 'refus', libelle: 'Refusée', sous: 'Avec un mot pour l’agent' }
	];
</script>

<svelte:head>
	<title>{extraitDemande(d.texte, 40)} · Habillement · Gyro Caserne</title>
</svelte:head>

{#snippet erreur(quoi: string)}
	{#if form?.message && form.quoi === quoi}<p class="echec" role="alert">{form.message}</p>{/if}
{/snippet}

<div class="page">
	<EnTetePage titre={extraitDemande(d.texte, 60)} phrase={d.sienne ? undefined : `Demandée par ${d.demandeur}`} retour={d.sienne ? { href: '/habillement', libelle: 'Habillement' } : { href: '/habillement/toutes', libelle: 'Toutes les demandes' }} />

	<div role="status" class="masque">{form?.succes ?? reussite}</div>
	{#if data.envoyee}<p class="bandeau ok">Demande envoyée. Vous serez prévenu à chaque étape.</p>{/if}
	{#if form?.message && form.quoi === null}<p class="echec" role="alert">{form.message}</p>{/if}
	<!-- Refus d'un geste devenu impossible entre-temps : son panneau ne s'ouvre plus, le message reste lu. -->
	{#if form?.message && !panneau && PANNEAUX.some((c) => c === form?.quoi)}<p class="echec" role="alert">{form.message}</p>{/if}

	<div class="colonnes">
		<Carte titre="Suivi" ancre="titre-suivi">
			<div class="contenu">
				<div><Pastille ton={etat.ton}>{etat.texte}</Pastille></div>
				<ol class="etapes">
					{#each ETAPES_SUIVI as libelle, i (libelle)}
						<li class={etapeDe(i)} aria-current={etapeDe(i) === 'en-cours' ? 'step' : undefined}>
							<span class="puce" aria-hidden="true">{#if etapeDe(i) === 'faite'}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg>{/if}</span>
							<span>{i === 2 && d.issue ? etatDemande({ etape: 'traitee', issue: d.issue }).texte : libelle}<span class="masque">{' '}: {LUS[etapeDe(i)]}</span></span>
						</li>
					{/each}
				</ol>
				{#if arretee}<p><strong>{etat.texte}</strong> le {dateCourte(d.finLe ?? d.majLe)}.</p>{/if}
				{#if d.livraison}<p><strong>{d.livraison}</strong></p>{/if}
				<p class="doux">{d.prisePar ? `Suivie par ${d.prisePar}.` : arretee ? '' : 'En attente d’un référent habillement.'}</p>
				{#if question && peut('repondre')}
					<p class="question"><strong>{question.par} vous demande :</strong> {question.texte} <a href="#texte-repondre">Répondre</a></p>
				{/if}

				{#if peut('prendre') || peut('reprendre') || PANNEAUX.some(peut)}
					<div class="gestes">
						{#if peut('prendre') || peut('reprendre')}
							<form method="POST" use:enhance={soumettre}>
								<input type="hidden" name="quoi" value={peut('prendre') ? 'prendre' : 'reprendre'} />
								<Bouton type="submit" desactive={envoi}>{peut('prendre') ? 'Je la prends en compte' : 'Je la reprends'}</Bouton>
							</form>
						{/if}
						{#each PANNEAUX.filter(peut) as cle (cle)}<a class="lien-secondaire" href={adresse(cle)} data-sveltekit-noscroll data-sveltekit-reset="false">{TITRES[cle]}…</a>{/each}
					</div>
					{@render erreur('prendre')}
					{@render erreur('reprendre')}
				{/if}
				{#if peut('annuler')}
					<form method="POST" use:enhance={soumettre}>
						<input type="hidden" name="quoi" value="annuler" />
						<Bouton type="submit" variante="secondaire" desactive={envoi}>Annuler ma demande</Bouton>
					</form>
					{@render erreur('annuler')}
				{/if}
			</div>
		</Carte>

		<Carte titre="Le fil">
			<div class="contenu">
				<ol class="fil">
					<li>
						<strong>Demande</strong>
						<span class="doux">{moment(d.creeLe)} · {d.demandeur}</span>
						<span class="texte">{d.texte}</span>
					</li>
					{#each d.fil as f, i (i)}
						<li>
							<strong>{TEXTES_FIL[f.quoi]}</strong>
							<span class="doux">{moment(f.le)} · {f.par}</span>
							{#if f.texte}<span class="texte">{f.texte}</span>{/if}
						</li>
					{/each}
				</ol>
				{#if peut('repondre')}
					<form method="POST" use:enhance={soumettre} class="formulaire">
						<input type="hidden" name="quoi" value="repondre" />
						<Champ id="texte-repondre" name="texte" lignes={3} requis maxlength={LIMITE_HABILLEMENT} bind:valeur={message} libelle={d.etape === 'question' ? 'Votre réponse' : 'Ajouter une précision'} erreur={form?.quoi === 'repondre' ? form.message : undefined} />
						<div><Bouton type="submit" desactive={envoi}>Envoyer</Bouton></div>
					</form>
				{:else if !gestionnaire && !d.gestes.length && !['livree', 'refusee', 'annulee'].includes(d.etape)}
					<p class="doux">Le référent habillement vous répondra ici.</p>
				{/if}
			</div>
		</Carte>
	</div>
</div>

{#if panneau}
	<Panneau titre={TITRES[panneau]} fermer={sans}>
		<form method="POST" action={sans} use:enhance={soumettre} class="formulaire">
			<input type="hidden" name="quoi" value={panneau} />
			{#if panneau === 'question'}
				<Champ id="texte-question" name="texte" lignes={3} requis maxlength={LIMITE_HABILLEMENT} libelle="Votre question" aide="Par exemple : quelle taille ?" erreur={form?.quoi === 'question' ? form.message : undefined} />
				<div><Bouton type="submit" desactive={envoi}>Envoyer la question</Bouton></div>
			{:else if panneau === 'traiter'}
				<ChoixRadio id="issue" name="issue" legende="Issue" options={ISSUES} bind:valeur={issue} disposition="rangees" requis />
				<Champ id="texte-traiter" name="texte" lignes={2} maxlength={LIMITE_HABILLEMENT} requis={issue === 'refus'} libelle={issue === 'refus' ? 'Pourquoi ce refus ?' : 'Un mot pour l’agent (facultatif)'} erreur={form?.quoi === 'traiter' ? form.message : undefined} />
				<div><Bouton type="submit" desactive={envoi}>Enregistrer</Bouton></div>
			{:else}
				<ChoixRadio id="recuperation" name="recuperation" legende="Où la récupérer ?" options={RECUPERATIONS} bind:valeur={recuperation} disposition="rangees" requis />
				{#if recuperation === 'autre'}
					<Champ id="texte-livrer" name="texte" requis maxlength={LIMITE_HABILLEMENT} libelle="Précisez" erreur={form?.quoi === 'livrer' ? form.message : undefined} />
				{:else}
					{@render erreur('livrer')}
				{/if}
				<div><Bouton type="submit" desactive={envoi}>Enregistrer la livraison</Bouton></div>
			{/if}
		</form>
	</Panneau>
{/if}

<style>
	.page,
	.colonnes,
	.contenu,
	.formulaire {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	p {
		margin: 0;
	}
	.doux {
		color: var(--doux);
	}
	.doux:empty {
		display: none;
	}
	.bandeau {
		padding: 12px 14px;
		border: 1px solid;
		border-radius: var(--rayon-petit);
	}
	.bandeau.ok {
		background: var(--statut-ok-fond);
		color: var(--statut-ok-texte);
		border-color: var(--statut-ok-trait);
	}
	.etapes,
	.fil {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.etapes li {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.puce {
		display: inline-grid;
		place-items: center;
		flex: none;
		width: 22px;
		height: 22px;
		border: 2px solid var(--trait);
		border-radius: 50%;
	}
	.faite .puce {
		border-color: var(--statut-ok-texte);
		background: var(--statut-ok-fond);
		color: var(--statut-ok-texte);
	}
	.en-cours {
		font-weight: 700;
	}
	.en-cours .puce {
		border-color: var(--rouge);
		border-width: 6px;
	}
	.a-venir {
		color: var(--doux);
	}
	.fil {
		gap: 0;
	}
	.fil li {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 10px 0;
	}
	.fil li:first-child {
		padding-top: 0;
	}
	.fil li + li {
		border-top: 1px solid var(--trait-doux);
	}
	.texte {
		white-space: pre-line;
		overflow-wrap: anywhere;
	}
	.question {
		padding: 12px 14px;
		border: 1px solid var(--statut-alerte-trait);
		border-radius: var(--rayon-petit);
		background: var(--statut-alerte-fond);
		color: var(--statut-alerte-texte);
	}
	.question a {
		color: inherit;
		font-weight: 700;
	}
	.gestes {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
	}
	.echec {
		color: var(--statut-danger-texte);
		font-weight: 600;
	}
	@media (min-width: 1024px) {
		.colonnes {
			display: grid;
			grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
			align-items: start;
			gap: 28px;
		}
	}
</style>
