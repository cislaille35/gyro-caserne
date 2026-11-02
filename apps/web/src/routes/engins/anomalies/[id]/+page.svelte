<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
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
	const soumettre: SubmitFunction = () => {
		envoi = true;
		return async ({ update }) => {
			await update();
			envoi = false;
		};
	};
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

	<div role="status" class="masque">{form?.succes ?? ''}</div>
	{#if data.signalee}<p class="bandeau ok">Signalement envoyé. Le référent engins et les chefs sont prévenus.</p>{/if}
	{#if form?.message && form.quoi === null}<p class="echec" role="alert">{form.message}</p>{/if}

	{#if e.etat === 'indisponible'}
		<p class="bandeau danger"><strong>{e.nom} est indisponible.</strong> {a.bloquante ? 'Décidé depuis cette anomalie.' : 'Décidé depuis une autre anomalie.'}</p>
	{:else if !a.close}
		<p class="bandeau alerte"><strong>{e.nom} reste disponible.</strong> Un avertissement prévient ceux qui l’ouvrent ; seuls le référent engins et les chefs décident d’une indisponibilité.</p>
	{/if}

	<div class="colonnes">
		<div class="principal">
			<section class="panneau" aria-labelledby="titre-suivi">
				<div class="tete">
					<h2 id="titre-suivi">Suivi</h2>
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
					{#if peut('attente')}
						<details open={form?.quoi === 'attente' && !!form.message}>
							<summary>Mettre en attente…</summary>
							<form method="POST" use:enhance={soumettre} class="formulaire">
								<input type="hidden" name="quoi" value="attente" />
								<fieldset>
									<legend>Motif</legend>
									{#each Object.entries(LIBELLES_MOTIF) as [valeur, libelle], i (valeur)}
										<label class="choix"><input type="radio" name="motif" value={valeur} checked={i === 0} /> {libelle}</label>
									{/each}
								</fieldset>
								<div class="champ">
									<label for="texte-attente">Précision <span class="doux">(facultative : garage, date de retour prévue…)</span></label>
									<input id="texte-attente" name="texte" type="text" maxlength="300" />
								</div>
								<div><Bouton type="submit" variante="secondaire" desactive={envoi}>Mettre en attente</Bouton></div>
							</form>
							{@render message('attente')}
						</details>
					{/if}
					{#if peut('reparee')}
						<details open={form?.quoi === 'reparee' && !!form.message}>
							<summary>{libelleEtape('reparee', r)}…</summary>
							<form method="POST" use:enhance={soumettre} class="formulaire">
								<input type="hidden" name="quoi" value="reparee" />
								<div class="champ">
									<label for="texte-reparee">Ce qui a été fait <span class="doux">(facultatif)</span></label>
									<textarea id="texte-reparee" name="texte" maxlength="300" rows="2"></textarea>
								</div>
								<p class="doux">{r.verifiee ? 'Une autre personne vérifiera ensuite.' : 'L’anomalie sera close.'}{e.etat === 'indisponible' ? ' L’engin reste indisponible jusqu’à sa remise en service.' : ''}</p>
								<div><Bouton type="submit" variante="secondaire" desactive={envoi}>Enregistrer la réparation</Bouton></div>
							</form>
							{@render message('reparee')}
						</details>
					{/if}
					{#if peut('clore')}
						<details open={form?.quoi === 'clore' && !!form.message}>
							<summary>Clore sans réparation…</summary>
							<form method="POST" use:enhance={soumettre} class="formulaire">
								<input type="hidden" name="quoi" value="clore" />
								<div class="champ">
									<label for="texte-clore">Pourquoi <span class="doux">(facultatif : signalé deux fois, sans objet…)</span></label>
									<input id="texte-clore" name="texte" type="text" maxlength="300" />
								</div>
								<div><Bouton type="submit" variante="secondaire" desactive={envoi}>Clore</Bouton></div>
							</form>
							{@render message('clore')}
						</details>
					{/if}
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
							<Bouton type="submit" desactive={envoi}>{e.etat === 'indisponible' ? 'Bloquer aussi l’engin' : 'Rendre l’engin indisponible'}</Bouton>
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

<style>
	.page,
	.colonnes,
	.principal {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}
	h2,
	p,
	dl,
	dd {
		margin: 0;
	}
	h2 {
		font: 700 1.25rem var(--police-titre);
	}
	.doux {
		color: var(--doux);
	}
	.panneau {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 16px;
		background: var(--surface);
		border: 1px solid var(--trait-doux);
		border-radius: var(--rayon-grand);
	}
	.tete {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.bandeau {
		margin: 0;
		padding: 12px 14px;
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
		padding-left: 12px;
		border-left: 3px solid var(--trait-doux);
	}
	.gestes {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}
	details {
		border-top: 1px solid var(--trait-doux);
		padding-top: 10px;
	}
	summary {
		min-height: var(--cible);
		display: flex;
		align-items: center;
		font-weight: 700;
		cursor: pointer;
	}
	.formulaire {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding-top: 8px;
	}
	fieldset {
		margin: 0;
		padding: 0;
		border: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 4px 18px;
	}
	legend {
		font-weight: 700;
		margin-bottom: 4px;
	}
	.choix {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: var(--cible);
	}
	.champ {
		display: flex;
		flex-direction: column;
		gap: 6px;
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
		padding: 8px 12px;
		border: 1px solid var(--trait);
		border-radius: var(--rayon-petit);
		background: var(--surface);
		color: var(--encre);
		font: inherit;
	}
	dl {
		display: flex;
		flex-direction: column;
		gap: 10px;
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
			gap: 28px;
		}
	}
</style>
