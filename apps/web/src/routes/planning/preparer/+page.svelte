<script lang="ts">
	import { enhance } from '$app/forms';
	import Celebration from '#lib/animations/Celebration.svelte';
	import { momentPlanningPublie } from '#lib/animations/celebration.ts';
	import FormulaireManoeuvre from '#lib/planning/FormulaireManoeuvre.svelte';
	import Panneau from '#lib/planning/Panneau.svelte';
	import { duAu, finDeSemaine, jourLong, momentLong, semainesParMois } from '#lib/planning/dates.ts';
	import { echangePropose, ETAPES, recapitulatif } from '#lib/planning/preparer.ts';
	import Bouton from '#lib/ui/Bouton.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import ListeRangees from '#lib/ui/ListeRangees.svelte';
	import Pastille from '#lib/ui/Pastille.svelte';
	import PastilleEquipe from '#lib/ui/PastilleEquipe.svelte';
	import Rangee from '#lib/ui/Rangee.svelte';
	import TuileDate from '#lib/ui/TuileDate.svelte';

	let { data, form } = $props();

	const p = $derived(data.preparation);
	const rang = $derived(ETAPES.findIndex((e) => e.id === data.etape));
	const ici = (params: Record<string, string> = {}) => `?${new URLSearchParams({ annee: String(p.annee), etape: data.etape, ...params })}`;
	const vers = (etape: string) => `?annee=${p.annee}&etape=${etape}`;
	const action = (nom: string) => `?/${nom}&annee=${p.annee}&etape=${data.etape}`;
	const equipe = (id: number | null) => p.equipes.find((e) => e.id === id) ?? { id: id ?? 0, nom: id === null ? 'personne' : 'Équipe archivée', couleur: '#8a949e' };
	const ordre = $derived(p.ordre.length ? p.ordre : p.ordrePropose);
	const mois = $derived(semainesParMois(p.annee, p.semaines));
	const concerne = (cible: string) => form?.cible === cible;
	const valeur = (cle: string) => (concerne('vacances') && typeof form?.valeurs?.[cle] === 'string' ? (form.valeurs[cle] as string) : '');
	const FETES = { noel: 'Noël', nouvel_an: 'Nouvel An' } as const;
	const MOMENTS = { noel: '25 décembre, midi', nouvel_an: '31 décembre, 23 h' } as const;
	const attendues = (f: 'noel' | 'nouvel_an') => (f === 'noel' ? p.fetes.attendues.noel : p.fetes.attendues.nouvelAn);
	const tenue = (f: 'noel' | 'nouvel_an') => (f === 'noel' ? p.fetes.noel : p.fetes.nouvelAn);
	// Hors de son tour : l'équipe calculée n'est pas parmi celles qui attendent le plus longtemps.
	const horsTour = (f: 'noel' | 'nouvel_an') => tenue(f) !== null && attendues(f).length > 0 && !attendues(f).includes(tenue(f)!);
	const noms = (ids: number[]) => ids.map((id) => equipe(id).nom).join(', ');
	const proposition = $derived(data.proposer ? echangePropose(p.semaines, data.proposer, attendues(data.proposer), p.annee) : null);
	const manoeuvreOuverte = $derived(data.manoeuvre === 'nouvelle' ? null : (p.manoeuvres.find((m) => m.id === data.manoeuvre) ?? null));
	const panneauManoeuvre = $derived(data.etape === 'manoeuvres' && (data.manoeuvre === 'nouvelle' || manoeuvreOuverte !== null));
	const semaineOuverte = $derived(data.etape === 'publier' ? (p.semaines.find((s) => s.debut === data.semaine) ?? null) : null);
	const garder = () => async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => update({ reset: false });
</script>

<svelte:head>
	<title>Préparer {p.annee} · Planning · Gyro Caserne</title>
</svelte:head>

{#snippet retour(cible: string)}
	<div class="retours">
		<div role="alert">{#if concerne(cible) && form?.message}<p class="echec">{form.message}</p>{/if}</div>
		<div role="status">{#if concerne(cible) && form?.succes}<p class="succes">{form.succes}</p>{/if}</div>
	</div>
{/snippet}

{#snippet sansRoulement()}
	<p class="encadre">Réglez d’abord le roulement : cette étape en dépend. <a href={vers('roulement')}>Aller au roulement</a></p>
{/snippet}

{#snippet statut()}
	{#if p.publiee}<Pastille ton="ok">Publiée</Pastille>{:else}<Pastille ton="alerte">Brouillon</Pastille>{/if}
{/snippet}

<div class="page">
	<EnTetePage titre="Préparer {p.annee}" phrase={p.publiee ? `Publiée le ${jourLong(p.publiee)} : chaque modification est visible tout de suite.` : 'Cinq étapes, chacune enregistrée seule. Les agents ne voient rien avant la publication.'} retour={{ href: `/planning?annee=${p.annee}`, libelle: 'Planning' }} secondaire={statut} />

	<nav class="annees" aria-label="Année à préparer">
		{#each data.annees as a (a)}<a href="?annee={a}&etape={data.etape}" aria-current={a === p.annee ? 'page' : undefined}>{a}</a>{/each}
	</nav>

	<nav class="etapes" aria-label="Étapes">
		<p class="ou">Étape {rang + 1} sur {ETAPES.length}<span class="barre" aria-hidden="true"><span style:width="{((rang + 1) / ETAPES.length) * 100}%"></span></span></p>
		<ol role="list">
			{#each ETAPES as e, i (e.id)}
				<li>
					<a href={vers(e.id)} aria-current={i === rang ? 'step' : undefined} class:faite={i < rang}><span class="numero" aria-hidden="true">{i + 1}</span><span class="libelle">{e.libelle}</span></a>
				</li>
			{/each}
		</ol>
	</nav>

	<section class="etape" aria-labelledby="titre-etape">
		<h2 id="titre-etape" tabindex="-1">{ETAPES[rang]!.libelle}</h2>

		{#if data.etape === 'roulement'}
			<p class="doux">L’ordre des équipes, semaine après semaine. La première semaine commence le {jourLong(data.apercu[0]?.debut ?? `${p.annee}-01-01`)}.{p.ordre.length ? '' : ' Ordre proposé d’après la référence du centre : validez-le ou changez-le.'}</p>
			{@render retour('roulement')}
			<form method="POST" action={action('deplacer')} use:enhance={garder}>
				{#each ordre as id (id)}<input type="hidden" name="ordre" value={id} />{/each}
				<ol role="list" class="ordre">
					{#each ordre as id, i (id)}
						{@const e = equipe(id)}
						<li style:--equipe={e.couleur}>
							<span class="rang">{i === 0 ? '1re semaine' : `${i + 1}e`}</span>
							<PastilleEquipe nom={e.nom} couleur={e.couleur} />
							<span class="gestes">
								<button type="submit" name="deplacer" value="{i}:monter" disabled={i === 0} aria-label="Monter {e.nom}"
									><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6" /></svg></button
								>
								<button type="submit" name="deplacer" value="{i}:descendre" disabled={i === ordre.length - 1} aria-label="Descendre {e.nom}"
									><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6" /></svg></button
								>
							</span>
						</li>
					{/each}
				</ol>
			</form>
			{#if !p.ordre.length}
				<form method="POST" action={action('roulement')} use:enhance={garder}>
					{#each ordre as id (id)}<input type="hidden" name="ordre" value={id} />{/each}
					<Bouton type="submit">Valider ce roulement</Bouton>
				</form>
			{/if}
			<h3>Aperçu</h3>
			<ul role="list" class="apercu">
				{#each data.apercu as s (s.debut)}
					{@const e = equipe(s.equipeId)}
					<li style:--equipe={e.couleur}><span class="numero-s">S{s.numero}</span><span class="dates">{duAu(s.debut, finDeSemaine(s.debut))}</span><strong>{e.nom}</strong></li>
				{/each}
			</ul>
		{:else if data.etape === 'fetes'}
			{#if !p.semaines.length}
				{@render sansRoulement()}
			{:else}
				{@render retour('semaines')}
				<ul role="list" class="fetes">
					{#each ['noel', 'nouvel_an'] as const as f (f)}
						{@const e = equipe(tenue(f))}
						<li class="fete" style:--equipe={e.couleur}>
							<p class="fete-titre"><strong>{FETES[f]} {p.annee}</strong> <span class="doux">({MOMENTS[f]})</span></p>
							<p><PastilleEquipe nom={e.nom} couleur={e.couleur} /></p>
							{#if horsTour(f)}
								<p class="avertissement">Hors de son tour : c’est à {noms(attendues(f))} de tenir {f === 'noel' ? 'Noël' : 'le Nouvel An'}.</p>
								{#if data.proposer !== f}<a class="lien-secondaire" href={ici({ proposer: f })} data-sveltekit-noscroll>Proposer un échange de semaines</a>{/if}
							{:else if attendues(f).length}
								<p class="doux">Dans son tour.</p>
							{/if}
							{#if data.proposer === f}
								<div class="proposition" role="region" aria-label="Échange proposé">
									{#if proposition}
										{@const a = equipe(proposition.autre.equipeId)}
										<p>Échanger la semaine {proposition.fete.numero} ({duAu(proposition.fete.debut, finDeSemaine(proposition.fete.debut))}, {e.nom}) avec la semaine {proposition.autre.numero} ({duAu(proposition.autre.debut, finDeSemaine(proposition.autre.debut))}, {a.nom}) : {a.nom} tiendrait {FETES[f]}.</p>
										<form method="POST" action={action('semaines')} class="en-ligne">
											<input type="hidden" name="semaine-{proposition.fete.debut}" value={proposition.autre.equipeId} />
											<input type="hidden" name="semaine-{proposition.autre.debut}" value={proposition.fete.equipeId} />
											<Bouton type="submit">Accepter l’échange</Bouton>
											<a class="lien-secondaire" href={ici()} data-sveltekit-noscroll>Non merci</a>
										</form>
									{:else}
										<p>Aucune semaine à échanger : changez l’équipe d’une semaine à l’étape « Vérifier et publier ».</p>
									{/if}
								</div>
							{/if}
						</li>
					{/each}
				</ul>
				<h3>Historique du tour</h3>
				{@render retour('fetes')}
				{#if p.fetes.historique.length}
					<ul role="list" class="historique">
						{#each p.fetes.historique as h (`${h.annee}-${h.fete}`)}
							{@const e = equipe(h.equipeId)}
							<li><span>{FETES[h.fete]} {h.annee}</span><PastilleEquipe nom={e.nom} couleur={e.couleur} /></li>
						{/each}
					</ul>
				{:else}
					<p class="doux">Aucune année passée. Saisissez les dernières pour que l’appli suive le tour.</p>
				{/if}
				<details class="repli">
					<summary>Noter une année passée</summary>
					<form method="POST" action={action('fete')} class="en-ligne">
						<div class="champ">
							<label for="fete-annee">Année</label>
							<input id="fete-annee" name="annee" type="number" min="2020" max={p.annee} value={p.annee - 1} required />
						</div>
						<div class="champ">
							<label for="fete-fete">Fête</label>
							<select id="fete-fete" name="fete"><option value="noel">Noël</option><option value="nouvel_an">Nouvel An</option></select>
						</div>
						<div class="champ">
							<label for="fete-equipe">Équipe</label>
							<select id="fete-equipe" name="equipe">
								{#each p.equipes as e (e.id)}<option value={e.id}>{e.nom}</option>{/each}
								<option value="">Effacer cette ligne</option>
							</select>
						</div>
						<Bouton type="submit" variante="secondaire">Noter</Bouton>
					</form>
				</details>
			{/if}
		{:else if data.etape === 'manoeuvres'}
			<p class="doux">Chaque manœuvre est annoncée sur « Le centre » deux semaines avant, aux équipes convoquées.</p>
			{#if p.manoeuvres.length}
				<ListeRangees>
					{#each p.manoeuvres as m (m.id)}
						<li>
							<Rangee href={ici({ manoeuvre: String(m.id) })} titre={m.theme} sous="{momentLong(m.debut)} · {m.convoques === 'tous' ? 'Tout le centre' : noms(m.convoques)}">
								{#snippet tete()}<TuileDate iso={m.debut} />{/snippet}
								{#snippet droite()}
									{#if m.annulee}<Pastille ton="danger">Annulée</Pastille>{:else if m.publiee}<Pastille ton="ok">Annoncée</Pastille>{/if}
								{/snippet}
							</Rangee>
						</li>
					{/each}
				</ListeRangees>
			{:else}
				<p>Aucune manœuvre pour {p.annee}.</p>
			{/if}
			<p><a class="bouton-lien" href={ici({ manoeuvre: 'nouvelle' })} data-sveltekit-noscroll>Ajouter une manœuvre</a></p>
		{:else if data.etape === 'reperes'}
			<details class="repli">
				<summary>Jours fériés <span class="doux">({p.feries.length}, calculés)</span></summary>
				<ul role="list" class="feries">
					{#each p.feries as f (f.date)}<li><span>{f.nom}</span><span class="doux">{jourLong(f.date)}</span></li>{/each}
				</ul>
			</details>
			<h3>Vacances scolaires</h3>
			{@render retour('vacances')}
			{#if p.vacances.length}
				<ListeRangees>
					{#each p.vacances as v (v.id)}
						<li>
							<Rangee titre={v.nom} sous="Du {jourLong(v.debut)} au {jourLong(v.fin)}">
								{#snippet droite()}
									<form method="POST" action={action('retirerVacances')}>
										<input type="hidden" name="id" value={v.id} />
										<button type="submit" class="retirer">Retirer<span class="masque"> {v.nom}</span></button>
									</form>
								{/snippet}
							</Rangee>
						</li>
					{/each}
				</ListeRangees>
			{:else}
				<p class="doux">Aucune période de vacances pour {p.annee}.</p>
			{/if}
			<form method="POST" action={action('vacances')} class="en-ligne">
				<div class="champ">
					<label for="vacances-nom">Nom</label>
					<input id="vacances-nom" name="nom" maxlength="60" required value={valeur('nom')} placeholder="Vacances d’hiver" />
				</div>
				<div class="champ">
					<label for="vacances-debut">Du</label>
					<input id="vacances-debut" name="debut" type="date" required value={valeur('debut')} />
				</div>
				<div class="champ">
					<label for="vacances-fin">Au</label>
					<input id="vacances-fin" name="fin" type="date" required value={valeur('fin')} />
				</div>
				<Bouton type="submit" variante="secondaire">Ajouter</Bouton>
			</form>
		{:else if !p.semaines.length}
			{@render sansRoulement()}
		{:else}
			<p class="doux">Touchez une semaine pour changer son équipe (un échange, le tour des fêtes). La suite du roulement ne bouge pas.</p>
			{@render retour('semaines')}
			<div class="grille">
				{#each mois as m (m.numero)}
					{#if m.semaines.length}
						<section class="mois" aria-labelledby="mois-{m.numero}">
							<h3 id="mois-{m.numero}">{m.nom}</h3>
							<ul role="list">
								{#each m.semaines as s (s.debut)}
									{@const e = equipe(s.equipeId)}
									<li>
										<a href={ici({ semaine: s.debut })} class="case" class:changee={s.changee} class:ouverte={s.debut === data.semaine} style:--equipe={e.couleur} data-sveltekit-noscroll>
											<span class="numero-s">S{s.numero}</span>
											<span class="nom">{e.nom}</span>
											{#if s.changee}<span class="mot">changée</span>{/if}
											<span class="masque">, {duAu(s.debut, finDeSemaine(s.debut))}. Changer l’équipe</span>
										</a>
									</li>
								{/each}
							</ul>
						</section>
					{/if}
				{/each}
			</div>
			<h3>Récapitulatif</h3>
			<ul role="list" class="recap">
				{#each recapitulatif(p) as ligne (ligne)}<li>{ligne}</li>{/each}
			</ul>
			{@render retour('publier')}
			{#if p.publiee}
				<p><Pastille ton="ok">Publiée</Pastille> le {jourLong(p.publiee)}.</p>
			{:else}
				<form method="POST" action={action('publier')}><Bouton type="submit">Publier l’année {p.annee}</Bouton></form>
			{/if}
		{/if}
	</section>

	<nav class="suite" aria-label="Étape précédente ou suivante">
		{#if rang > 0}<a href={vers(ETAPES[rang - 1]!.id)}>‹ {ETAPES[rang - 1]!.libelle}</a>{:else}<span></span>{/if}
		{#if rang < ETAPES.length - 1}<a class="suivante" href={vers(ETAPES[rang + 1]!.id)}>{ETAPES[rang + 1]!.libelle} ›</a>{/if}
	</nav>
</div>

{#if panneauManoeuvre}
	<Panneau titre={manoeuvreOuverte ? 'Modifier la manœuvre' : 'Nouvelle manœuvre'} fermer={ici()}>
		<FormulaireManoeuvre manoeuvre={manoeuvreOuverte} equipes={p.equipes} />
	</Panneau>
{/if}

{#if semaineOuverte}
	{@const actuelle = equipe(semaineOuverte.equipeId)}
	<Panneau titre="Semaine {semaineOuverte.numero}" fermer={ici()}>
		<p class="doux">Du {jourLong(semaineOuverte.debut)} au {jourLong(finDeSemaine(semaineOuverte.debut))}. Aujourd’hui : {actuelle.nom}.</p>
		<form method="POST" action={`?/semaines&annee=${p.annee}&etape=publier`} class="choix">
			<fieldset>
				<legend>Quelle équipe d’astreinte ?</legend>
				{#each p.equipes as e (e.id)}
					<button type="submit" name="semaine-{semaineOuverte.debut}" value={e.id} aria-pressed={e.id === semaineOuverte.equipeId} style:--equipe={e.couleur}
						><span class="pastille" aria-hidden="true"></span>{e.nom}{#if e.id === semaineOuverte.equipeId}<span class="doux"> · actuelle</span>{/if}</button
					>
				{/each}
			</fieldset>
		</form>
	</Panneau>
{/if}

<Celebration moment={momentPlanningPublie(concerne('publier') && form?.succes ? p.annee : null)} qui={data.qui} annoncer={false} />

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 16px;
		max-width: 60rem;
	}
	h2,
	h3,
	p {
		margin: 0;
	}
	h2 {
		font: 700 1.5rem var(--police-titre);
	}
	h2:focus {
		outline: none;
	}
	h3 {
		font: 700 1.125rem var(--police-titre);
	}
	ul,
	ol {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.doux {
		color: var(--doux);
	}
	.annees {
		display: flex;
		gap: 8px;
	}
	.annees a {
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		padding: 0 18px;
		border: 1px solid var(--trait-doux);
		border-radius: 999px;
		background: var(--surface);
		color: var(--encre);
		font-weight: 600;
		text-decoration: none;
	}
	.annees a[aria-current='page'] {
		border-color: var(--encre);
		background: var(--encre);
		color: var(--surface);
	}

	/* Les étapes : une barre, les cinq pastilles numérotées, l'étape en cours marquée (texte, pas la couleur seule). */
	.etapes {
		display: flex;
		flex-direction: column;
		gap: 8px;
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
	.etapes ol {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 6px;
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
		font-size: 0.75rem;
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
	@media (min-width: 640px) {
		.etapes a {
			font-size: 0.875rem;
		}
	}

	.etape {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 16px;
		border: 1px solid var(--trait-doux);
		border-radius: var(--rayon-grand);
		background: var(--surface);
	}
	.encadre,
	.avertissement {
		padding: 10px 14px;
		border: 1px solid var(--statut-alerte-trait);
		border-radius: var(--rayon-petit);
		background: var(--statut-alerte-fond);
		color: var(--statut-alerte-texte);
		font-weight: 600;
	}
	.encadre a {
		color: inherit;
	}

	/* Roulement */
	.ordre {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.ordre li {
		min-height: 56px;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 6px 8px 6px 14px;
		border: 1px solid var(--trait-doux);
		border-left: 6px solid var(--equipe);
		border-radius: 14px;
		background: var(--fond);
	}
	.rang {
		min-width: 6.5em;
		color: var(--doux);
		font-size: 0.875rem;
		font-weight: 600;
	}
	.gestes {
		margin-left: auto;
		display: flex;
		gap: 6px;
	}
	.gestes button {
		width: var(--cible);
		height: var(--cible);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--trait);
		border-radius: 999px;
		background: var(--surface);
		color: var(--encre);
		cursor: pointer;
	}
	.gestes button:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.apercu {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
		gap: 6px;
	}
	.apercu li {
		display: flex;
		flex-direction: column;
		padding: 6px 10px;
		border-left: 6px solid var(--equipe);
		border-radius: var(--rayon-petit);
		background: color-mix(in srgb, var(--equipe) 12%, var(--surface));
		font-size: 0.875rem;
	}
	.numero-s {
		color: var(--doux);
		font-size: 0.75rem;
		font-variant-numeric: tabular-nums;
	}

	/* Fêtes */
	.fetes {
		display: grid;
		gap: 10px;
	}
	@media (min-width: 720px) {
		.fetes {
			grid-template-columns: 1fr 1fr;
			align-items: start;
		}
	}
	.fete {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px 14px;
		border-left: 6px solid var(--equipe);
		border-radius: 14px;
		background: color-mix(in srgb, var(--equipe) 10%, var(--surface));
	}
	.proposition {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 12px;
		border: 1px solid var(--trait);
		border-radius: var(--rayon-petit);
		background: var(--surface);
	}
	.historique,
	.feries {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.historique li,
	.feries li {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 4px 12px;
	}
	.repli {
		border: 1px solid var(--trait-doux);
		border-radius: 14px;
		padding: 0 12px;
	}
	.repli[open] {
		padding-bottom: 12px;
	}
	.repli summary {
		min-height: var(--cible);
		display: flex;
		align-items: center;
		gap: 6px;
		font-weight: 600;
		cursor: pointer;
	}

	/* Formulaires en ligne */
	.en-ligne {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 12px;
	}
	.champ {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	label {
		font-weight: 600;
	}
	select,
	input {
		min-height: var(--cible);
		padding: 0 10px;
		border: 2px solid var(--doux);
		border-radius: var(--rayon-petit);
		background: var(--surface);
		color: var(--encre);
		font: 400 1rem var(--police);
	}
	.retirer {
		min-height: var(--cible);
		padding: 0 14px;
		border: 1px solid var(--trait);
		border-radius: 999px;
		background: none;
		color: var(--accent);
		font: 600 0.9375rem var(--police);
		cursor: pointer;
	}
	.bouton-lien {
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		padding: 0 18px;
		border-radius: 999px;
		background: var(--rouge);
		color: var(--sur-rouge);
		font-weight: 600;
		text-decoration: none;
	}
	.bouton-lien:hover {
		background: var(--rouge-survol);
		color: var(--sur-rouge);
	}

	/* La grille de l'année : une case par semaine, l'équipe écrite dedans. */
	.grille {
		display: grid;
		gap: 12px;
	}
	@media (min-width: 720px) {
		.grille {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (min-width: 1024px) {
		.grille {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
	.mois ul {
		margin-top: 4px;
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 4px;
	}
	.case {
		min-height: 56px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4px 2px;
		border: 1px solid color-mix(in srgb, var(--equipe) 55%, var(--trait-doux));
		border-bottom: 5px solid var(--equipe);
		border-radius: 10px;
		background: color-mix(in srgb, var(--equipe) 14%, var(--surface));
		color: var(--encre);
		text-decoration: none;
		line-height: 1.1;
	}
	.case:hover {
		border-color: var(--encre);
	}
	.case .nom {
		font-size: 0.6875rem;
		font-weight: 700;
		text-align: center;
	}
	.case .mot {
		font-size: 0.625rem;
		font-weight: 700;
		color: var(--statut-alerte-texte);
	}
	.case.changee {
		border-style: dashed;
		border-bottom-style: solid;
	}
	.case.ouverte {
		box-shadow: 0 0 0 3px var(--focus);
	}
	.recap {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding-left: 1.2em;
		list-style: disc;
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

	/* Le choix d'équipe d'une semaine */
	.choix fieldset {
		margin: 12px 0 0;
		padding: 0;
		border: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.choix legend {
		margin-bottom: 8px;
		font-weight: 700;
	}
	.choix button {
		min-height: 52px;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 0 16px;
		border: 1px solid var(--trait);
		border-left: 6px solid var(--equipe);
		border-radius: 14px;
		background: var(--surface);
		color: var(--encre);
		font: 600 1rem var(--police);
		text-align: left;
		cursor: pointer;
	}
	.choix button[aria-pressed='true'] {
		box-shadow: inset 0 0 0 2px var(--encre);
	}
	.pastille {
		width: 12px;
		height: 12px;
		border-radius: 6px;
		background: var(--equipe);
	}
	/* Sans message, les zones annoncées ne creusent pas d'écart. */
	.retours:not(:has(p)) {
		margin-top: -14px;
	}
	.echec,
	.succes {
		padding: 10px 14px;
		border-radius: var(--rayon-petit);
		border: 2px solid var(--accent);
		font-weight: 600;
	}
	.succes {
		border-color: var(--ok);
	}
</style>
