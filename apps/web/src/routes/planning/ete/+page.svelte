<script lang="ts">
	import { formatDeDate } from '@gyro-caserne/socle/dates';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { LIBELLES_POSTE, POSTES, type Poste } from '@gyro-caserne/socle';
	import Panneau from '#lib/planning/Panneau.svelte';
	import { duAu } from '#lib/planning/dates.ts';
	import { ETAPES_ETE, libellePlage, phrasePeriode, resumeEte, texteIlManque } from '#lib/planning/ete.ts';
	import { pluriel } from '#lib/pluriel.ts';
	import BarreActions from '#lib/ui/BarreActions.svelte';
	import Bouton from '#lib/ui/Bouton.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import Pastille from '#lib/ui/Pastille.svelte';
	import PastilleEquipe from '#lib/ui/PastilleEquipe.svelte';

	let { data, form } = $props();
	const e = $derived(data.ete);
	const rang = $derived(ETAPES_ETE.findIndex((x) => x.id === data.etape));
	const ici = (params: Record<string, string> = {}) => `?${new URLSearchParams({ annee: String(e.annee), etape: data.etape, ...params })}`;
	const vers = (etape: string) => `?annee=${e.annee}&etape=${etape}`;
	const action = (nom: string, params: Record<string, string> = {}) => `?/${nom}&${ici(params).slice(1)}`;
	const equipe = (id: number | null) => e.equipes.find((x) => x.id === id) ?? { id: 0, nom: e.proposee || e.ete?.publiee ? 'Sans groupe' : 'Sans équipe', couleur: '#8a949e' };
	const reglage = $derived(e.ete ?? { debut: e.defaut.debut, fin: new Date(Date.parse(`${e.defaut.fin}T00:00:00Z`) + 7 * 864e5).toISOString().slice(0, 10), dateLimite: e.defaut.dateLimite, publiee: false });
	// La période se saisit par jours de relève : « fin » est la relève de la dernière semaine.
	const derniereReleve = $derived(new Date(Date.parse(`${reglage.fin}T00:00:00Z`) - 7 * 864e5).toISOString().slice(0, 10));
	const sansReponse = $derived(e.reponses.filter((r) => r.reponse === null));
	const toutLete = $derived(e.reponses.filter((r) => r.reponse === 'tout'));
	const avecVacances = $derived(e.reponses.filter((r) => r.reponse === 'vacances'));
	const jourCourt = (iso: string) => formatDeDate({ day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
	// Les semaines à revoir d'abord, puis dans l'ordre.
	const semaines = $derived(
		e.semaines
			.map((s) => ({ ...s, aRevoir: s.plages.filter((p) => !p.arme).length }))
			.sort((a, b) => Number(b.aRevoir > 0) - Number(a.aRevoir > 0) || a.debut.localeCompare(b.debut))
	);
	const aRevoir = $derived(semaines.reduce((n, s) => n + s.aRevoir, 0));
	const poste = (p: Poste | null) => (p === null ? 'En plus' : `${LIBELLES_POSTE[p].charAt(0).toUpperCase()}${LIBELLES_POSTE[p].slice(1)}`);
	const rangPoste = (p: Poste | null) => (p === null ? POSTES.length : POSTES.indexOf(p));
	const concerne = (cible: string) => form?.cible === cible;
	const garder = () => async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => update({ reset: false });
	// Un panneau (période, recalcul) se ferme une fois l'action réussie.
	// Le message de réussite est gardé : la navigation qui ferme le panneau efface `form`.
	let reussite = $state('');
	const fermer = () => async ({ update, result }: { update: (o?: { reset?: boolean }) => Promise<void>; result: { type: string; data?: Record<string, unknown> } }) => {
		reussite = '';
		await update({ reset: false });
		if (result.type === 'success') {
			await goto(ici(), { replaceState: true });
			reussite = String(result.data?.succes ?? '');
		}
	};
</script>

<svelte:head>
	<title>Été {e.annee} · Planning · Gyro Caserne</title>
</svelte:head>

{#snippet retour(cibles: string[])}
	{@const vise = cibles.some(concerne)}
	<div class="retours">
		<div role="alert">{#if vise && form?.message}<p class="echec">{form.message}</p>{/if}</div>
		<div role="status">{#if vise && form?.succes}<p class="succes">{form.succes}</p>{/if}</div>
	</div>
{/snippet}

{#snippet formulairePeriode(libelle: string, variante: 'principal' | 'secondaire')}
	<form method="POST" action={action('regler')} use:enhance={garder}>
		<input type="hidden" name="debut" value={reglage.debut} /><input type="hidden" name="fin" value={derniereReleve} /><input type="hidden" name="dateLimite" value={reglage.dateLimite} />
		<Bouton type="submit" {variante}>{libelle}</Bouton>
	</form>
{/snippet}

<div class="page">
	<EnTetePage titre="Été {e.annee}" phrase={resumeEte(e)} retour={{ href: `/planning/preparer?annee=${e.annee}`, libelle: `Préparer ${e.annee}` }} />

	<nav class="etapes" aria-label="Étapes">
		<p class="ou">Étape {rang + 1} sur {ETAPES_ETE.length}<span class="barre" aria-hidden="true"><span style:width="{((rang + 1) / ETAPES_ETE.length) * 100}%"></span></span></p>
		<ol role="list">
			{#each ETAPES_ETE as x, i (x.id)}
				<li>
					<a href={vers(x.id)} aria-current={i === rang ? 'step' : undefined} class:faite={i < rang}><span class="numero" aria-hidden="true">{i + 1}</span><span class="libelle">{x.libelle}</span></a>
				</li>
			{/each}
		</ol>
	</nav>

	<section class="etape" aria-labelledby="titre-etape">
		<h2 id="titre-etape" tabindex="-1">{ETAPES_ETE[rang]!.libelle}</h2>
		<div role="status">{#if reussite && !form}<p class="succes">{reussite}</p>{/if}</div>

		{#if data.etape === 'periode'}
			{@render retour(data.panneau === 'periode' ? [] : ['regler'])}
			<div class="carte ligne">
				<p class="phrase">{phrasePeriode(reglage.debut, reglage.fin, reglage.dateLimite)}</p>
				{#if !reglage.publiee}<a class="lien-bouton" href={ici({ panneau: 'periode' })} data-sveltekit-reset="false">Modifier<span class="masque">{' '}la période</span></a>{/if}
			</div>
			{#if !e.ete}
				<p class="doux">Proposé d’après le roulement : de la dernière relève de juin à la dernière d’août. Ouvrez la saisie : les agents donnent leurs vacances dans « Moi → Mes vacances ».</p>
				{@render formulairePeriode('Ouvrir la saisie des vacances', 'principal')}
			{:else if reglage.publiee}
				<p class="doux">L’été est publié : sa période ne change plus.</p>
			{:else}
				<p class="doux">Rappel aux agents sans réponse un mois puis une semaine avant la date limite. Changer la période efface la répartition proposée.</p>
			{/if}
		{:else if data.etape === 'vacances'}
			{#if !e.ete}
				<p class="encadre">Ouvrez d’abord la saisie des vacances. <a href={vers('periode')}>Aller à la période</a></p>
			{:else}
				{@render retour(['relancer'])}
				<ul class="rangees" role="list">
					<li>
						<details>
							<summary><span class="titre-rangee">Ont répondu<span class="doux">{' '}· avec des vacances</span></span><span class="compte">{avecVacances.length}</span></summary>
							{#if avecVacances.length}
								<ul class="noms" role="list">
									{#each avecVacances as r (r.id)}<li><strong>{r.prenom} {r.nom}</strong> · {r.periodes.length ? r.periodes.map((p) => duAu(p.debut, p.fin)).join(', ') : 'aucune période'}</li>{/each}
								</ul>
							{:else}<p class="doux contenu">Personne pour l’instant.</p>{/if}
						</details>
					</li>
					<li>
						<details>
							<summary><span class="titre-rangee">Sans réponse</span><span class="compte">{sansReponse.length}</span></summary>
							{#if sansReponse.length}
								<ul class="noms" role="list">{#each sansReponse as r (r.id)}<li>{r.prenom} {r.nom}</li>{/each}</ul>
								<p class="doux contenu">Sans réponse, un agent compte comme disponible.</p>
							{:else}<p class="doux contenu">Tout le monde a répondu.</p>{/if}
						</details>
						{#if sansReponse.length && !e.ete.publiee}
							<div class="relance">
								{#if e.relanceeAujourdhui}
									<p class="doux">Relancés aujourd’hui : prochaine relance possible demain.</p>
								{:else}
									<form method="POST" action={action('relancer')} use:enhance={garder}>
										<Bouton type="submit" variante="secondaire">Relancer {sansReponse.length === 1 ? 'le sans-réponse' : `les ${sansReponse.length} sans-réponse`}</Bouton>
									</form>
									<p class="doux">Un rappel tout de suite, à eux seuls ; une fois par jour au plus.</p>
								{/if}
							</div>
						{/if}
					</li>
					<li>
						<details>
							<summary><span class="titre-rangee">Disponibles tout l’été</span><span class="compte">{toutLete.length}</span></summary>
							{#if toutLete.length}<ul class="noms" role="list">{#each toutLete as r (r.id)}<li>{r.prenom} {r.nom}</li>{/each}</ul>{:else}<p class="doux contenu">Personne pour l’instant.</p>{/if}
						</details>
					</li>
				</ul>
			{/if}
		{:else if data.etape === 'repartition'}
			{@render retour(e.detail ? ['repartition'] : ['repartition', 'plage'])}
			{#if !e.ete}
				<p class="encadre">Ouvrez d’abord la saisie des vacances. <a href={vers('periode')}>Aller à la période</a></p>
			{:else if e.sansRoulement}
				<p class="encadre">Réglez d’abord le roulement de {e.annee}. <a href="/planning/preparer?annee={e.annee}">Préparer {e.annee}</a></p>
			{:else if !e.proposee}
				<p class="doux">Plage par plage : l’équipe de la semaine moins les agents en vacances ; si le FPT n’est pas armé, des renforts pris parmi les autres agents, ceux qui ont le moins été en renfort d’abord.</p>
				<form method="POST" action={action('proposer')} use:enhance={garder}><Bouton type="submit">Proposer la répartition</Bouton></form>
			{:else}
				<div class="entete-liste">
					<p class="doux">{e.ete.publiee ? 'Publiée : vos changements valent tout de suite, et seuls les agents touchés sont prévenus.' : 'Touchez une semaine pour voir ses plages, puis une plage pour la modifier.'}</p>
					{#if !e.ete.publiee}
						<details class="menu">
							<summary>Plus d’actions</summary>
							<a href={ici({ panneau: 'recalculer' })} data-sveltekit-reset="false">Recalculer la proposition…</a>
						</details>
					{/if}
				</div>
				{#if e.conflits.length}
					<!-- Replié, le nombre reste visible : l'alerte ne se fait pas oublier. -->
					<details class="alerte">
						<summary><h3><span aria-hidden="true">⚠</span>{' '}{pluriel(e.conflits.length, 'remplacement à revoir', 'remplacements à revoir')}</h3></summary>
						<ul>{#each e.conflits as t (t)}<li>{t}</li>{/each}</ul>
					</details>
				{/if}
				<ul class="rangees" role="list">
					{#each semaines as s (s.debut)}
						{@const eq = equipe(s.equipeId)}
						<li>
							<details class="semaine" style:--equipe={eq.couleur}>
								<summary>
									<span class="titre-rangee">Semaine du {jourCourt(s.debut)}</span>
									<PastilleEquipe nom={eq.nom} couleur={eq.couleur} />
									{#if s.aRevoir}<Pastille ton="alerte">⚠ {pluriel(s.aRevoir, 'plage à revoir', 'plages à revoir')}</Pastille>{:else}<Pastille ton="ok">✓ FPT armé {s.plages.length}/{s.plages.length}</Pastille>{/if}
								</summary>
								<ul class="plages" role="list">
									{#each s.plages as p (p.debut)}
										<li>
											<a href={ici({ plage: p.debut })} class:non-arme={!p.arme} data-sveltekit-reset="false">
												<span class="jour">{libellePlage(p)}</span>
												<span class="etat">{p.arme ? `FPT armé · ${pluriel(p.presents.length, 'présent')}` : texteIlManque(p.manque)}</span>
											</a>
										</li>
									{/each}
								</ul>
							</details>
						</li>
					{/each}
				</ul>
			{/if}
		{:else}
			{@render retour(['publier'])}
			{#if e.ete?.publiee}
				<p><Pastille ton="ok">Publiée</Pastille></p>
				<p>Le planning de chacun, l’agenda et les remplacements suivent la répartition. Vos changements valent tout de suite ; seuls les agents touchés sont prévenus.</p>
			{:else if e.proposee}
				<ul class="recap" role="list">
					<li>{pluriel(e.semaines.length, 'semaine')}, {pluriel(e.semaines.reduce((n, s) => n + s.plages.length, 0), 'plage')}</li>
					<li>{aRevoir === 0 ? 'FPT armé sur chaque plage' : `${pluriel(aRevoir, 'plage', 'plages')} où le FPT n’est pas armé`}{#if aRevoir}{' · '}<a href={vers('repartition')}>Revoir</a>{/if}</li>
					{#if e.conflits.length}<li>{pluriel(e.conflits.length, 'remplacement à revoir', 'remplacements à revoir')} · <a href={vers('repartition')}>Revoir</a></li>{/if}
					<li>{pluriel(sansReponse.length, 'agent sans réponse', 'agents sans réponse')} (comptés disponibles)</li>
				</ul>
				<p class="doux">À la publication, le planning, l’agenda et les remplacements suivent la répartition ; les renforts et les agents retirés sont prévenus.</p>
			{:else}
				<p class="encadre">Proposez d’abord la répartition. <a href={vers('repartition')}>Aller à la répartition</a></p>
			{/if}
		{/if}
	</section>

	<nav class="suite" aria-label="Étape précédente ou suivante">
		{#if rang > 0}<a href={vers(ETAPES_ETE[rang - 1]!.id)}>‹ {ETAPES_ETE[rang - 1]!.libelle}</a>{:else}<span></span>{/if}
		{#if rang < ETAPES_ETE.length - 1}<a class="suivante" href={vers(ETAPES_ETE[rang + 1]!.id)}>{ETAPES_ETE[rang + 1]!.libelle} ›</a>{/if}
	</nav>

	<!-- Le bouton de publication vit à la dernière étape ; avant, « Publier › » y conduit. -->
	{#if data.etape === 'publier' && e.proposee && !e.ete?.publiee}
		<BarreActions message={aRevoir ? `${pluriel(aRevoir, 'plage', 'plages')} sans FPT armé : vous pouvez publier quand même.` : ''}>
			<form method="POST" action={action('publier')}><Bouton type="submit">Publier l’été {e.annee}</Bouton></form>
		</BarreActions>
	{/if}
</div>

{#if data.panneau === 'periode' && !reglage.publiee}
	<Panneau titre="Période de l’été" fermer={ici()}>
		<form method="POST" action={action('regler')} use:enhance={fermer} class="formulaire">
			<p class="doux">En semaines d’astreinte entières : de la première relève à la dernière.</p>
			<label>Première relève <input type="date" name="debut" required value={reglage.debut} /></label>
			<label>Dernière relève <input type="date" name="fin" required value={derniereReleve} /></label>
			<label>Vacances à donner avant le <input type="date" name="dateLimite" required value={reglage.dateLimite} /></label>
			{@render retour(['regler'])}
			<Bouton type="submit">{e.ete ? 'Enregistrer' : 'Ouvrir la saisie des vacances'}</Bouton>
		</form>
	</Panneau>
{/if}

{#if data.panneau === 'recalculer' && e.proposee && !e.ete?.publiee}
	<Panneau titre="Recalculer la proposition ?" fermer={ici()}>
		<div class="formulaire">
			<p>L’appli refait la répartition d’après les vacances d’aujourd’hui. Cela <strong>efface vos ajustements</strong> (agents ajoutés ou retirés à la main).</p>
			<form method="POST" action={action('proposer')} use:enhance={fermer}><Bouton type="submit">Recalculer</Bouton></form>
			<a class="lien-bouton" href={ici()} data-sveltekit-reset="false">Annuler</a>
		</div>
	</Panneau>
{/if}

{#snippet candidats(liste: NonNullable<typeof e.detail>['candidats'], debut: string)}
	<ul class="liste" role="list">
		{#each liste as x (x.id)}
			<li>
				<span>
					{x.prenom} {x.nom}
					<span class="doux">· {equipe(x.equipeId).nom}{x.postes.length ? ` · ${x.postes.map((y) => LIBELLES_POSTE[y]).join(', ')}` : ''}{x.vacances ? ' · en vacances' : ''}</span>
				</span>
				<form method="POST" action={action('ajuster', { plage: debut })} use:enhance={garder}>
					<input type="hidden" name="debut" value={debut} /><input type="hidden" name="personne" value={x.id} /><input type="hidden" name="present" value="oui" />
					<button type="submit" class="geste">Ajouter<span class="masque">{' '}{x.prenom} {x.nom}</span></button>
				</form>
			</li>
		{/each}
	</ul>
{/snippet}

{#if e.detail}
	{@const d = e.detail}
	{@const utiles = d.candidats.filter((x) => x.utile)}
	{@const autres = d.candidats.filter((x) => !x.utile)}
	<Panneau titre={libellePlage(d)} fermer={ici()}>
		{#if d.arme}<p class="arme">✓ FPT armé</p>{:else}<p class="manque"><span aria-hidden="true">⚠ </span>{texteIlManque(d.manque)}</p>{/if}
		{@render retour(['plage'])}
		<h3 class="sous-titre">Présents ({d.presents.length})</h3>
		<ul class="liste" role="list">
			{#each [...d.presents].sort((a, b) => rangPoste(a.poste) - rangPoste(b.poste)) as x (x.id)}
				<li>
					<span><span class="poste">{poste(x.poste)}</span> {x.prenom} {x.nom}{#if x.renfort}<span class="etiquette">renfort</span>{/if}</span>
					<form method="POST" action={action('ajuster', { plage: d.debut })} use:enhance={garder}>
						<input type="hidden" name="debut" value={d.debut} /><input type="hidden" name="personne" value={x.id} /><input type="hidden" name="present" value="non" />
						<button type="submit" class="geste">Retirer<span class="masque">{' '}{x.prenom} {x.nom}</span></button>
					</form>
				</li>
			{/each}
		</ul>
		<h3 class="sous-titre">Ajouter un agent</h3>
		{#if utiles.length && !d.arme}
			<h4>Peuvent combler le manque</h4>
			{@render candidats(utiles, d.debut)}
			<h4>Autres agents</h4>
			{@render candidats(autres, d.debut)}
		{:else}
			{@render candidats(d.candidats, d.debut)}
		{/if}
	</Panneau>
{/if}

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 16px;
		max-width: 60rem;
	}
	p,
	h2,
	h3,
	h4 {
		margin: 0;
	}
	h2 {
		font: 700 1.5rem var(--police-titre);
	}
	h2:focus {
		outline: none;
	}
	h3 {
		font: 700 1.0625rem var(--police-titre);
	}
	h4 {
		margin: 8px 0 0;
		font-size: 0.9375rem;
		color: var(--doux);
	}
	.doux {
		color: var(--doux);
	}

	/* Les étapes : une barre, les pastilles numérotées, l'étape en cours marquée (texte, pas la couleur seule). */
	.etapes {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.etapes ol {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 6px;
	}
	.ou {
		display: flex;
		align-items: center;
		gap: 12px;
		color: var(--doux);
		font-weight: 600;
		font-size: 0.9375rem;
	}
	.barre {
		flex: 1;
		height: 6px;
		border-radius: 3px;
		background: var(--trait-doux);
		overflow: hidden;
	}
	.barre span {
		display: block;
		height: 100%;
		background: var(--encre);
	}
	.etapes a {
		min-height: 56px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		padding: 6px 2px;
		border-radius: 14px;
		color: var(--doux);
		font-size: 0.8125rem;
		font-weight: 600;
		text-align: center;
		text-decoration: none;
		line-height: 1.15;
	}
	.etapes .numero {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 2px solid var(--trait);
		background: var(--surface);
		color: var(--encre);
		font-size: 0.875rem;
	}
	.etapes a.faite .numero {
		border-color: var(--encre);
	}
	.etapes a[aria-current='step'] {
		background: var(--surface);
		color: var(--encre);
		box-shadow: inset 0 0 0 2px var(--encre);
	}
	.etapes a[aria-current='step'] .numero {
		border-color: var(--encre);
		background: var(--encre);
		color: var(--surface);
	}

	.etape {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.carte {
		padding: 14px 16px;
		background: var(--surface);
		border: 1px solid var(--trait-doux);
		border-radius: var(--rayon-grand);
	}
	.ligne {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px 16px;
	}
	.phrase {
		font-weight: 700;
	}
	.lien-bouton {
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0 16px;
		border: 1px solid var(--trait);
		border-radius: 999px;
		background: var(--surface);
		color: var(--encre);
		font-weight: 600;
		text-decoration: none;
	}

	/* Rangées repliables : un titre, un compte ou un état écrit ; le détail en dessous. */
	.rangees {
		margin: 0;
		padding: 0;
		list-style: none;
		background: var(--surface);
		border: 1px solid var(--trait-doux);
		border-radius: var(--rayon-grand);
	}
	.rangees > li + li {
		border-top: 1px solid var(--trait-doux);
	}
	.rangees summary {
		min-height: var(--cible);
		padding: 10px 16px;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		list-style: none;
	}
	.rangees summary::-webkit-details-marker {
		display: none;
	}
	.rangees summary::after {
		content: '›';
		margin-left: auto;
		font-size: 1.25rem;
		color: var(--doux);
		transition: transform 0.15s;
	}
	.rangees details[open] > summary::after {
		transform: rotate(90deg);
	}
	.titre-rangee {
		font-weight: 700;
	}
	.compte {
		min-width: 2rem;
		padding: 0 8px;
		border-radius: 999px;
		background: var(--fond);
		border: 1px solid var(--trait-doux);
		font-weight: 700;
		text-align: center;
	}
	.noms {
		margin: 0;
		padding: 0 16px 12px;
		list-style: none;
		overflow-wrap: anywhere;
	}
	.noms li + li {
		margin-top: 4px;
	}
	.contenu {
		padding: 0 16px 12px;
	}
	.relance {
		padding: 0 16px 14px;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 12px;
	}
	.entete-liste {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.menu {
		position: relative;
	}
	.menu summary {
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		padding: 0 14px;
		border: 1px solid var(--trait);
		border-radius: 999px;
		font-weight: 600;
		cursor: pointer;
	}
	.menu a {
		display: flex;
		align-items: center;
		min-height: var(--cible);
		margin-top: 6px;
		padding: 0 14px;
		border: 1px solid var(--trait);
		border-radius: var(--rayon-petit);
		background: var(--surface);
		color: var(--encre);
		font-weight: 600;
	}
	.semaine summary {
		border-left: 4px solid var(--equipe);
	}
	.plages {
		margin: 0;
		padding: 0 16px 12px;
		list-style: none;
		display: grid;
		grid-template-columns: 1fr;
		gap: 6px;
	}
	.plages a {
		min-height: var(--cible);
		padding: 6px 12px;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 4px 12px;
		border: 1px solid var(--trait);
		border-radius: var(--rayon-petit);
		color: var(--encre);
		text-decoration: none;
	}
	.plages a.non-arme {
		border: 2px solid var(--accent);
	}
	.jour {
		font-weight: 700;
	}
	.etat {
		font-size: 0.9375rem;
		color: var(--doux);
	}
	.non-arme .etat {
		color: var(--encre);
		font-weight: 700;
	}
	.encadre,
	.alerte {
		padding: 12px 16px;
		border-radius: var(--rayon-petit);
		border: 2px solid var(--accent);
	}
	.encadre {
		border: 1px solid var(--trait);
	}
	.alerte {
		padding: 0;
	}
	.alerte summary {
		min-height: var(--cible);
		padding: 6px 16px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		cursor: pointer;
		list-style: none;
	}
	.alerte summary::-webkit-details-marker {
		display: none;
	}
	.alerte summary::after {
		content: '›';
		font-size: 1.25rem;
		color: var(--doux);
		transition: transform 0.15s;
	}
	.alerte[open] summary::after {
		transform: rotate(90deg);
	}
	.alerte ul {
		margin: 0;
		padding: 0 16px 12px 36px;
	}
	.recap {
		margin: 6px 0 0;
		padding-left: 20px;
	}
	.suite {
		display: flex;
		justify-content: space-between;
		gap: 8px;
	}
	.suite a {
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		padding: 0 16px;
		border: 1px solid var(--trait);
		border-radius: 999px;
		background: var(--surface);
		color: var(--encre);
		font-weight: 600;
		text-decoration: none;
	}
	.suite .suivante {
		background: var(--encre);
		border-color: var(--encre);
		color: var(--surface);
	}

	/* Panneaux */
	.formulaire {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 12px;
	}
	.formulaire label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-weight: 600;
	}
	input[type='date'] {
		min-height: var(--cible);
		font: inherit;
		color: var(--texte);
		background: var(--fond);
		border: 1px solid var(--trait);
		border-radius: var(--rayon-petit);
		padding: 0 10px;
	}
	.arme,
	.manque {
		font-weight: 700;
	}
	.manque {
		padding: 10px 14px;
		border: 2px solid var(--accent);
		border-radius: var(--rayon-petit);
	}
	.sous-titre {
		margin-top: 16px;
	}
	.poste {
		display: block;
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--doux);
	}
	.liste {
		margin: 0 0 12px;
		padding: 0;
		list-style: none;
	}
	.liste li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		min-height: var(--cible);
		padding: 4px 0;
	}
	.liste li + li {
		border-top: 1px solid var(--trait-doux);
	}
	.etiquette {
		margin-left: 6px;
		padding: 0 6px;
		border: 1px solid var(--trait);
		border-radius: 999px;
		font-size: 0.8125rem;
		font-weight: 600;
	}
	.geste {
		min-height: var(--cible);
		padding: 0 12px;
		font: inherit;
		font-weight: 600;
		color: var(--texte);
		background: none;
		border: 1px solid var(--trait);
		border-radius: var(--rayon-petit);
		cursor: pointer;
		flex: none;
	}
	/* Vides, les zones de message ne creusent pas d'espace (elles restent là pour être lues). */
	.retours:not(:has(p)) {
		position: absolute;
	}
	.succes {
		padding: 12px 16px;
		border-radius: var(--rayon-petit);
		background: var(--statut-ok-fond);
		color: var(--statut-ok-texte);
		border: 1px solid var(--statut-ok-trait);
		font-weight: 600;
	}
	.echec {
		padding: 12px 16px;
		border-radius: var(--rayon-petit);
		border: 2px solid var(--accent);
		font-weight: 600;
	}
	.masque {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
	@media (min-width: 640px) {
		.etapes a {
			font-size: 0.875rem;
		}
	}
	@media (min-width: 720px) {
		.plages {
			grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.rangees summary::after,
		.alerte summary::after {
			transition: none;
		}
	}
</style>
