<script lang="ts">
	import ChoixRadio from '#lib/ui/ChoixRadio.svelte';
	import { enhance, type SubmitFunction } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Panneau from '#lib/planning/Panneau.svelte';
	import centre from '$centre';
	import { etapesDu, libelleEtape, LIBELLES_MOTIF, type EtapeAnomalie, type EtapeHistorique, type VueAnomalie } from '@gyro-caserne/socle';
	import { dateCourte, heureCourte, texteEcart, texteEtape, tonEtape } from '#lib/engins/textes.ts';
	import Bouton from '#lib/ui/Bouton.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import Pastille from '#lib/ui/Pastille.svelte';

	type Reponse = { quoi?: string | null; succes?: string; message?: string } | null;
	let { data, form }: { data: { anomalie: VueAnomalie; signalee?: boolean }; form: Reponse } = $props();

	const a = $derived(data.anomalie);
	const e = $derived(a.engin);
	const peut = (quoi: VueAnomalie['gestes'][number]) => a.gestes.includes(quoi);
	const r = centre.anomalies;
	// Les étapes du centre : faites, en cours, à venir. Close : toutes faites.
	const etapes = $derived(etapesDu(r));
	// Faite : dans l'historique ; en cours : l'étape actuelle d'une anomalie ouverte ; sautée : passée sans avoir eu lieu.
	const rang = $derived(a.close ? etapes.length : etapes.indexOf(a.etape));
	const faites = $derived(new Set<string>(['signalee', ...a.historique.map((h) => h.quoi)]));
	const etat = (etape: EtapeAnomalie, i: number) => (!a.close && etape === a.etape ? 'en cours' : faites.has(etape) ? 'faite' : i < rang ? 'sautée' : 'à venir');
	const CLASSES: Record<string, string> = { faite: 'faite', 'en cours': 'en-cours', sautée: 'sautee', 'à venir': 'a-venir' };
	const reparee = $derived(a.historique.some((h) => h.quoi === 'reparee'));
	// Un seul envoi à la fois : les boutons attendent la réponse.
	let envoi = $state(false);
	// Le message de réussite est gardé : la navigation qui ferme un panneau efface `form`.
	let reussite = $state('');
	const soumettre: SubmitFunction = () => {
		envoi = true;
		reussite = '';
		// Le panneau d'où part l'envoi : après la réponse, le geste n'est souvent plus permis.
		const ouvert = panneau;
		return async ({ update, result }) => {
			// Rester sur la page (pas de navigation vers l'adresse de l'envoi) : le défilement et le focus ne sautent pas.
			await update({ navigate: false });
			envoi = false;
			if (result.type === 'success' && ouvert) {
				reussite = String(result.data?.succes ?? '');
				await goto(sans, { replaceState: true, reset: false });
				document.getElementById('titre-suivi')?.focus();
			}
		};
	};

	// Mettre en attente, réparée, clore : un panneau chacun, ouvert par l'adresse (`?panneau=`) ou rouvert par un refus.
	const PANNEAUX = ['attente', 'reparee', 'clore'] as const;
	type Cle = (typeof PANNEAUX)[number];
	const TITRES: Record<Cle, string> = { attente: 'Mettre en attente', reparee: libelleEtape('reparee', r), clore: 'Clore sans réparation' };
	const adresse = (cle: Cle | null) => {
		const p = new URLSearchParams(page.url.search);
		if (cle) p.set('panneau', cle);
		else p.delete('panneau');
		return `?${p}`;
	};
	const sans = $derived(adresse(null));
	const panneau = $derived.by((): Cle | null => {
		const demande = form?.message && PANNEAUX.find((c) => c === form?.quoi) ? (form.quoi as Cle) : PANNEAUX.find((c) => c === page.url.searchParams.get('panneau'));
		return demande && peut(demande) ? demande : null;
	});
	const avancer = $derived(a.gestes.filter((g) => g !== 'indisponible' && g !== 'remettre'));
	const moment = (le: string) => `${dateCourte(le)}, ${heureCourte(le)}`;
	const TEXTES: Record<EtapeHistorique['quoi'], string> = {
		signalee: libelleEtape('signalee', r),
		retrouvee: 'Retrouvée à la prise de garde',
		prise_en_charge: libelleEtape('prise_en_charge', r),
		en_attente: libelleEtape('en_attente', r),
		reparee: libelleEtape('reparee', r),
		verifiee: libelleEtape('verifiee', r),
		close: 'Close',
		indisponible: 'Engin rendu indisponible',
		remise_en_service: 'Engin remis en service'
	};
</script>

<svelte:head>
	<title>{a.libelle} · {e.nom} · Anomalies · Gyro Caserne</title>
</svelte:head>

{#snippet message(quoi: string)}
	{#if form?.message && form.quoi === quoi}<p class="echec" role="alert">{form.message}</p>{/if}
{/snippet}

<div class="page">
	<EnTetePage titre={a.libelle} phrase={[e.nom, a.zone].filter(Boolean).join(' · ')} retour={{ href: `/engins/anomalies?engin=${e.id}`, libelle: 'Anomalies' }} />

	<div role="status" class="masque">{form?.succes ?? reussite}</div>
	{#if data.signalee}<p class="bandeau ok">Signalement envoyé. Le référent engins et les chefs sont prévenus.</p>{/if}
	{#if form?.message && form.quoi === null}<p class="echec" role="alert">{form.message}</p>{/if}
	<!-- Refus d'un geste devenu interdit entre-temps (un collègue l'a close) : son panneau ne s'ouvre plus, le message reste lu. -->
	{#if form?.message && !panneau && PANNEAUX.some((c) => c === form?.quoi)}<p class="echec" role="alert">{form.message}</p>{/if}

	{#if e.etat === 'indisponible'}
		<p class="bandeau danger"><strong>{e.nom} est indisponible.</strong> {a.bloquante ? 'Décidé depuis cette anomalie.' : 'Décidé depuis une autre anomalie.'}</p>
	{:else if !a.close}
		<p class="bandeau alerte"><strong>{e.nom} reste disponible.</strong> Un avertissement prévient ceux qui l’ouvrent ; seuls le référent engins et les chefs décident d’une indisponibilité.</p>
	{/if}

	<div class="colonnes">
		<div class="principal">
			<section class="panneau" aria-labelledby="titre-suivi">
				<div class="tete">
					<h2 id="titre-suivi" tabindex="-1">Suivi</h2>
					<Pastille ton={tonEtape({ etape: a.etape, closeLe: a.close?.le })}>{texteEtape({ etape: a.etape, motif: a.motif, closeLe: a.close?.le })}</Pastille>
				</div>
				<ol class="etapes">
					{#each etapes as etape, i (etape)}
						<li class={CLASSES[etat(etape, i)]} aria-current={etat(etape, i) === 'en cours' ? 'step' : undefined}>
							<span class="puce" aria-hidden="true">{#if etat(etape, i) === 'faite'}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg>{/if}</span>
							<span>{libelleEtape(etape, r)}{#if etape === 'en_attente' && a.motif && faites.has('en_attente')}{' '}<span class="doux">· {LIBELLES_MOTIF[a.motif].toLocaleLowerCase('fr')}</span>{/if}<span class="masque">{' '}: {etat(etape, i)}</span></span>
						</li>
					{/each}
					<li class={a.close ? 'faite' : 'a-venir'} aria-current={a.close ? 'step' : undefined}>
						<span class="puce" aria-hidden="true">{#if a.close}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg>{/if}</span>
						<span>Close{#if a.close}{' '}<span class="doux">· le {dateCourte(a.close.le)} par {a.close.par}</span>{/if}<span class="masque">{' '}: {a.close ? 'faite' : 'à venir'}</span></span>
					</li>
				</ol>

				{#if avancer.length}
					{#if peut('prendre') || peut('verifiee')}<div class="gestes">
						{#if peut('prendre')}
							<form method="POST" use:enhance={soumettre}>
								<input type="hidden" name="quoi" value="prendre" />
								<Bouton type="submit" desactive={envoi}>Je la prends en charge</Bouton>
							</form>
						{/if}
						{#if peut('verifiee')}
							<form method="POST" use:enhance={soumettre}>
								<input type="hidden" name="quoi" value="verifiee" />
								<Bouton type="submit" desactive={envoi}>{libelleEtape('verifiee', r)} : c’est bon</Bouton>
							</form>
						{/if}
					</div>{/if}
					{@render message('prendre')}
					{@render message('verifiee')}
					{#if PANNEAUX.some(peut)}<div class="gestes">
						{#each PANNEAUX.filter(peut) as cle (cle)}<a class="lien-secondaire" href={adresse(cle)} data-sveltekit-noscroll data-sveltekit-reset="false">{TITRES[cle]}…</a>{/each}
					</div>{/if}
				{:else if !a.close}
					<p class="doux">{a.prisePar ? `Prise en charge par ${a.prisePar}.` : 'En attente d’une prise en charge.'}</p>
				{/if}
			</section>

			{#if peut('indisponible') || peut('remettre')}
				<section class="panneau decision" aria-labelledby="titre-decision">
					<h2 id="titre-decision">Disponibilité de {e.nom}</h2>
					{#if peut('indisponible')}
						<p>{e.etat === 'indisponible' ? `${e.nom} est déjà indisponible. Cette anomalie le bloquera aussi jusqu’à sa remise en service.` : `${e.nom} reste disponible tant que vous ne décidez pas du contraire.`}</p>
						<form method="POST" use:enhance={soumettre}>
							<input type="hidden" name="quoi" value="indisponible" />
							<Bouton type="submit" variante="grave" desactive={envoi}>{e.etat === 'indisponible' ? 'Bloquer aussi l’engin' : 'Rendre l’engin indisponible'}</Bouton>
						</form>
						{@render message('indisponible')}
					{/if}
					{#if peut('remettre')}
						<p>L’anomalie est close. Remettre {e.nom} en service est une décision à part.</p>
						{#if a.autresBloquantes}<p class="bandeau alerte">{a.autresBloquantes > 1 ? `${a.autresBloquantes} autres anomalies ouvertes le bloquent encore.` : 'Une autre anomalie ouverte le bloque encore.'} Le remettre en service les lève aussi.</p>{/if}
						<form method="POST" use:enhance={soumettre}>
							<input type="hidden" name="quoi" value="remettre" />
							<Bouton type="submit" desactive={envoi}>Remettre en service</Bouton>
						</form>
						{@render message('remettre')}
					{/if}
				</section>
			{/if}
		</div>

		<div class="principal">
			<section class="panneau" aria-labelledby="titre-details">
				<h2 id="titre-details">Le problème</h2>
				<dl>
					<div><dt>Constat</dt><dd>{texteEcart({ genre: a.genre, manque: a.manque, note: null })}</dd></div>
					{#if a.note}<div><dt>Note</dt><dd>{a.note}</dd></div>{/if}
					<div>
						<dt>Signalée</dt>
						<dd>Le {moment(a.signaleeLe)} par {a.signaleePar}{#if a.priseId}, <a href="/engins/{e.id}/prises/{a.priseId}">à la prise de garde</a>{/if}</dd>
					</div>
					{#if a.prisePar}<div><dt>Prise en charge</dt><dd>{a.prisePar}</dd></div>{/if}
				</dl>
				{#if a.photo}<a class="photo" href="/engins/photo/{a.photo}"><img src="/engins/photo/{a.photo}" alt="Photo du problème : {a.libelle}" width="160" height="160" loading="lazy" /></a>{/if}
				<a class="lien-secondaire" href="/engins/{e.id}">Voir {e.nom}</a>
			</section>

			<section class="panneau" aria-labelledby="titre-historique">
				<h2 id="titre-historique">Historique</h2>
				<ol class="historique">
					{#each a.historique as h, i (i)}
						<li>
							<strong>{h.quoi === 'close' && !reparee ? 'Close sans réparation' : TEXTES[h.quoi]}</strong>
							<span class="doux">{moment(h.le)} · {h.par}</span>
							{#if h.texte && h.quoi !== 'signalee'}<span>{h.texte}</span>{/if}
						</li>
					{/each}
				</ol>
			</section>
		</div>
	</div>
</div>

{#if panneau}
	<Panneau titre={TITRES[panneau]} fermer={sans}>
		<form method="POST" action={sans} use:enhance={soumettre} class="formulaire">
			<input type="hidden" name="quoi" value={panneau} />
			{#if panneau === 'attente'}
				<ChoixRadio id="motif" legende="Motif" name="motif" disposition="rangees" valeur={Object.keys(LIBELLES_MOTIF)[0]} options={Object.entries(LIBELLES_MOTIF).map(([valeur, libelle]) => ({ valeur, libelle }))} />
				<div class="champ">
					<label for="texte-attente">Précision <span class="doux">(facultative : garage, date de retour prévue…)</span></label>
					<input id="texte-attente" name="texte" type="text" maxlength="300" />
				</div>
				<div><Bouton type="submit" desactive={envoi}>Mettre en attente</Bouton></div>
			{:else if panneau === 'reparee'}
				<div class="champ">
					<label for="texte-reparee">Ce qui a été fait <span class="doux">(facultatif)</span></label>
					<textarea id="texte-reparee" name="texte" maxlength="300" rows="3"></textarea>
				</div>
				<p class="doux">{r.verifiee ? 'Une autre personne vérifiera ensuite.' : 'L’anomalie sera close.'}{e.etat === 'indisponible' ? ' L’engin reste indisponible jusqu’à sa remise en service.' : ''}</p>
				<div><Bouton type="submit" desactive={envoi}>Enregistrer la réparation</Bouton></div>
			{:else}
				<div class="champ">
					<label for="texte-clore">Pourquoi <span class="doux">(facultatif : signalé deux fois, sans objet…)</span></label>
					<input id="texte-clore" name="texte" type="text" maxlength="300" />
				</div>
				<div><Bouton type="submit" variante="grave" desactive={envoi}>Clore l’anomalie</Bouton></div>
			{/if}
			{@render message(panneau)}
		</form>
	</Panneau>
{/if}

<style>
	.page,
	.colonnes,
	.principal {
		display: flex;
		flex-direction: column;
		gap: var(--espace-20);
	}
	h2,
	p,
	dl,
	dd {
		margin: 0;
	}
	h2 {
		font: 700 var(--texte-20) var(--police-titre);
	}
	.doux {
		color: var(--doux);
	}
	.panneau {
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
		padding: var(--espace-16);
		background: var(--surface);
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
		border-radius: var(--rayon-grand);
	}
	.tete {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--espace-8);
	}
	.bandeau {
		margin: 0;
		padding: var(--espace-12) var(--espace-16);
		border: 1px solid;
		border-radius: var(--rayon-petit);
	}
	.bandeau.ok {
		background: var(--statut-ok-fond);
		color: var(--statut-ok-texte);
		border-color: var(--statut-ok-trait);
	}
	.bandeau.alerte {
		background: var(--statut-alerte-fond);
		color: var(--statut-alerte-texte);
		border-color: var(--statut-alerte-trait);
	}
	.bandeau.danger {
		background: var(--statut-danger-fond);
		color: var(--statut-danger-texte);
		border-color: var(--statut-danger-trait);
	}
	.etapes,
	.historique {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--espace-12);
	}
	.etapes li {
		display: flex;
		align-items: center;
		gap: var(--espace-12);
	}
	.puce {
		display: inline-grid;
		place-items: center;
		flex: none;
		width: 12px;
		height: 12px;
		margin-inline: var(--espace-4);
		border: 1px solid var(--trait);
		border-radius: 50%;
	}
	.faite .puce,
	.en-cours .puce {
		width: 20px;
		height: 20px;
		margin-inline: 0;
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
	.a-venir,
	.sautee {
		color: var(--doux);
	}
	.sautee .puce {
		border-style: dashed;
	}
	.historique li {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.gestes {
		display: flex;
		flex-wrap: wrap;
		gap: var(--espace-12);
	}
	.formulaire {
		display: flex;
		flex-direction: column;
		gap: var(--espace-12);
	}
	.champ {
		display: flex;
		flex-direction: column;
		gap: var(--espace-6);
	}
	.champ label {
		font-weight: 700;
	}
	.champ .doux {
		font-weight: 400;
	}
	input[type='text'],
	textarea {
		min-height: var(--cible);
		padding: var(--espace-8) var(--espace-12);
		background: var(--surface);
		color: var(--encre);
		font: inherit;
	}
	dl {
		display: flex;
		flex-direction: column;
		gap: var(--espace-12);
	}
	dl div {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	dt {
		font-weight: 700;
	}
	.photo img {
		display: block;
		width: 160px;
		height: 160px;
		object-fit: cover;
		border-radius: var(--rayon-petit);
	}
	.echec {
		color: var(--statut-danger-texte);
		font-weight: 600;
	}
	@media (min-width: 1024px) {
		.colonnes {
			display: grid;
			grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
			align-items: start;
			gap: var(--espace-32);
		}
	}
</style>
