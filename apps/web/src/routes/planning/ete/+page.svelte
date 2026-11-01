<script lang="ts">
	import { enhance } from '$app/forms';
	import { LIBELLES_POSTE } from '@gyro-caserne/socle';
	import Panneau from '#lib/planning/Panneau.svelte';
	import { duAu, jourLong } from '#lib/planning/dates.ts';
	import { libellePlage, texteArme } from '#lib/planning/ete.ts';
	import { pluriel } from '#lib/pluriel.ts';
	import Bouton from '#lib/ui/Bouton.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import Pastille from '#lib/ui/Pastille.svelte';
	import PastilleEquipe from '#lib/ui/PastilleEquipe.svelte';

	let { data, form } = $props();
	const e = $derived(data.ete);
	const ici = (params: Record<string, string> = {}) => `?${new URLSearchParams({ annee: String(e.annee), ...params })}`;
	const action = (nom: string, params: Record<string, string> = {}) => `?/${nom}&${ici(params).slice(1)}`;
	const equipe = (id: number | null) => e.equipes.find((x) => x.id === id) ?? { id: 0, nom: 'Sans équipe', couleur: '#8a949e' };
	const veille = (iso: string) => new Date(Date.parse(`${iso}T00:00:00Z`) - 864e5).toISOString().slice(0, 10);
	const reglage = $derived(e.ete ?? { debut: e.defaut.debut, fin: e.defaut.fin, dateLimite: e.defaut.dateLimite, publiee: false });
	// La période se saisit par jours de relève : « fin » est la relève de la dernière semaine.
	const derniereReleve = $derived(e.ete ? new Date(Date.parse(`${e.ete.fin}T00:00:00Z`) - 7 * 864e5).toISOString().slice(0, 10) : e.defaut.fin);
	const sansReponse = $derived(e.reponses.filter((r) => r.reponse === null));
	const toutLete = $derived(e.reponses.filter((r) => r.reponse === 'tout'));
	const avecVacances = $derived(e.reponses.filter((r) => r.reponse === 'vacances'));
	const concerne = (cible: string) => form?.cible === cible;
	const garder = () => async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => update({ reset: false });
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

{#snippet statut()}
	{#if e.ete?.publiee}<Pastille ton="ok">Publié</Pastille>{:else if e.proposee}<Pastille ton="alerte">Proposé</Pastille>{:else}<Pastille ton="neutre">{e.ete ? 'Vacances en cours' : 'Pas ouvert'}</Pastille>{/if}
{/snippet}

<div class="page">
	<EnTetePage titre="Été {e.annee}" phrase="Les vacances des agents, puis une répartition plage par plage qui arme le FPT : proposée par l’appli, ajustée et publiée par vous." retour={{ href: `/planning/preparer?annee=${e.annee}`, libelle: `Préparer ${e.annee}` }} secondaire={statut} />

	<section class="carte" aria-labelledby="titre-periode">
		<h2 id="titre-periode">1. Période et date limite</h2>
		{#if e.ete}
			<p>Du {jourLong(e.ete.debut)} au {jourLong(veille(e.ete.fin))}. Vacances à donner avant le <strong>{jourLong(e.ete.dateLimite)}</strong> ; rappel un mois puis une semaine avant, à ceux qui n’ont rien saisi.</p>
		{:else}
			<p>Fixez la période (en semaines d’astreinte entières) et la date limite : les agents pourront donner leurs vacances dans « Moi → Mes vacances ».</p>
		{/if}
		{@render retour(['regler'])}
		<form method="POST" action={action('regler')} use:enhance={garder} class="periode">
			<label>Première relève <input type="date" name="debut" required value={reglage.debut} disabled={e.ete?.publiee} /></label>
			<label>Dernière relève <input type="date" name="fin" required value={derniereReleve} disabled={e.ete?.publiee} /></label>
			<label>Date limite <input type="date" name="dateLimite" required value={reglage.dateLimite} /></label>
			{#if e.ete?.publiee}<input type="hidden" name="debut" value={e.ete.debut} /><input type="hidden" name="fin" value={derniereReleve} />{/if}
			<Bouton type="submit" variante={e.ete ? 'secondaire' : 'principal'}>{e.ete ? 'Enregistrer' : 'Ouvrir la saisie des vacances'}</Bouton>
		</form>
	</section>

	{#if e.ete}
		<section class="carte" aria-labelledby="titre-reponses">
			<h2 id="titre-reponses">2. Vacances des agents</h2>
			<p><strong>{e.reponses.length - sansReponse.length} sur {e.reponses.length}</strong> ont répondu.</p>
			<details class="repli" open={sansReponse.length > 0 && sansReponse.length <= 8}>
				<summary>{sansReponse.length === 0 ? 'Tout le monde a répondu' : `Sans réponse (${sansReponse.length})`}</summary>
				{#if sansReponse.length}<p class="noms">{sansReponse.map((r) => `${r.prenom} ${r.nom}`).join(', ')}</p><p class="doux">Sans réponse, un agent compte comme disponible.</p>{/if}
			</details>
			<details class="repli">
				<summary>Disponibles tout l’été ({toutLete.length})</summary>
				{#if toutLete.length}<p class="noms">{toutLete.map((r) => `${r.prenom} ${r.nom}`).join(', ')}</p>{/if}
			</details>
			<details class="repli">
				<summary>Avec des vacances ({avecVacances.length})</summary>
				<ul class="vacances" role="list">
					{#each avecVacances as r (r.id)}<li><strong>{r.prenom} {r.nom}</strong> · {r.periodes.length ? r.periodes.map((p) => duAu(p.debut, p.fin)).join(', ') : 'aucune période'}</li>{/each}
				</ul>
			</details>
		</section>

		<section class="carte" aria-labelledby="titre-repartition">
			<h2 id="titre-repartition">3. Répartition</h2>
			{@render retour(['repartition', 'plage'])}
			{#if e.sansRoulement}
				<p class="encadre">Réglez d’abord le roulement de {e.annee}. <a href="/planning/preparer?annee={e.annee}">Préparer {e.annee}</a></p>
			{:else if !e.ete.publiee}
				<p class="doux">Plage par plage : l’équipe de la semaine moins les agents en vacances ; si le FPT n’est pas armé, des renforts pris parmi les autres agents, ceux qui ont le moins été en renfort d’abord.{e.proposee ? ' Recalculer efface vos ajustements.' : ''}</p>
				<form method="POST" action={action('proposer')} use:enhance={garder}>
					<Bouton type="submit" variante={e.proposee ? 'secondaire' : 'principal'}>{e.proposee ? 'Recalculer la proposition' : 'Proposer la répartition'}</Bouton>
				</form>
			{:else}
				<p class="doux">Publiée : vos changements valent tout de suite, et seuls les agents touchés sont prévenus.</p>
			{/if}

			{#if e.impossibles.length}
				<div class="alerte">
					<h3>{pluriel(e.impossibles.length, 'plage impossible', 'plages impossibles')}</h3>
					<ul>{#each e.impossibles as t (t)}<li>{t}</li>{/each}</ul>
				</div>
			{/if}
			{#if e.conflits.length}
				<div class="alerte">
					<h3>{pluriel(e.conflits.length, 'remplacement à revoir', 'remplacements à revoir')}</h3>
					<p class="doux">Conclus avant la répartition : ils sont gardés.</p>
					<ul>{#each e.conflits as t (t)}<li>{t}</li>{/each}</ul>
				</div>
			{/if}

			{#if e.proposee}
				<p class="doux">Touchez une semaine pour voir ses plages ; celles où le FPT n’est pas armé sont ouvertes d’office.</p>
				{#each e.semaines as s (s.debut)}
					{@const eq = equipe(s.equipeId)}
					{@const armees = s.plages.filter((p) => p.arme).length}
					<details class="semaine" open={armees < s.plages.length} style:--equipe={eq.couleur}>
						<summary>
							<h3 id="s-{s.debut}">Semaine du {jourLong(s.debut)}</h3>
							<span class="resume"><PastilleEquipe nom={eq.nom} couleur={eq.couleur} /> <span class:manque={armees < s.plages.length}>{armees === s.plages.length ? `FPT armé sur ${s.plages.length === 1 ? 'la plage' : `les ${s.plages.length} plages`}` : `FPT non armé sur ${pluriel(s.plages.length - armees, 'plage', 'plages')}`}</span></span>
						</summary>
						<ol class="plages" role="list" aria-labelledby="s-{s.debut}">
							{#each s.plages as p (p.debut)}
								<li class="plage" class:non-arme={!p.arme}>
									<a href={ici({ plage: p.debut })} class="tete"><span class="jour">{libellePlage(p)}</span><span class="masque">{' '}: modifier</span></a>
									<p class="arme">{#if !p.arme}<span class="signe" aria-hidden="true">!</span>{/if}{texteArme(p.arme, p.manque)}</p>
									<ul class="presents" role="list" aria-label="Présents">
										{#each p.presents as x (x.id)}<li class:renfort={x.renfort}>{x.prenom} {x.nom}{#if x.renfort}<span class="etiquette">renfort</span>{/if}</li>{/each}
									</ul>
								</li>
							{/each}
						</ol>
					</details>
				{/each}

				{#if !e.ete.publiee}
					{@render retour(['publier'])}
					<form method="POST" action={action('publier')} class="publier">
						<p class="doux">Publier : le planning, l’agenda et les remplacements suivent la répartition ; les renforts sont prévenus.</p>
						<Bouton type="submit">Publier l’été {e.annee}</Bouton>
					</form>
				{/if}
			{/if}
		</section>
	{/if}
</div>

{#if e.detail}
	{@const d = e.detail}
	<Panneau titre={libellePlage(d)} fermer={ici()}>
		<p class="arme">{texteArme(d.arme, d.manque)}</p>
		{@render retour(['plage'])}
		<h3 class="sous-titre">Présents ({d.presents.length})</h3>
		<ul class="liste" role="list">
			{#each d.presents as x (x.id)}
				<li>
					<span>{x.prenom} {x.nom}{#if x.renfort}<span class="etiquette">renfort</span>{/if}</span>
					<form method="POST" action={action('ajuster', { plage: d.debut })} use:enhance={garder}>
						<input type="hidden" name="debut" value={d.debut} /><input type="hidden" name="personne" value={x.id} /><input type="hidden" name="present" value="non" />
						<button type="submit" class="geste">Retirer<span class="masque">{' '}{x.prenom} {x.nom}</span></button>
					</form>
				</li>
			{/each}
		</ul>
		<h3 class="sous-titre">Ajouter un agent</h3>
		<ul class="liste" role="list">
			{#each d.candidats as x (x.id)}
				<li>
					<span>
						{x.prenom} {x.nom}
						<span class="doux">· {equipe(x.equipeId).nom}{x.postes.length ? ` · ${x.postes.map((y) => LIBELLES_POSTE[y]).join(', ')}` : ''}{x.vacances ? ' · en vacances' : ''}</span>
					</span>
					<form method="POST" action={action('ajuster', { plage: d.debut })} use:enhance={garder}>
						<input type="hidden" name="debut" value={d.debut} /><input type="hidden" name="personne" value={x.id} /><input type="hidden" name="present" value="oui" />
						<button type="submit" class="geste">Ajouter<span class="masque">{' '}{x.prenom} {x.nom}</span></button>
					</form>
				</li>
			{/each}
		</ul>
	</Panneau>
{/if}

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	p,
	h2,
	h3 {
		margin: 0;
	}
	h2 {
		font: 700 1.25rem var(--police-titre);
	}
	h3 {
		font: 700 1.0625rem var(--police-titre);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	.carte {
		padding: 16px;
		background: var(--surface);
		border: 1px solid var(--trait-doux);
		border-radius: var(--rayon-grand);
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	/* Vides, les zones de message ne creusent pas d'espace. */
	.retours:not(:has(p)) {
		margin-bottom: -12px;
	}
	.retours:has(p) {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.sous-titre {
		margin-top: 16px;
	}
	.doux {
		color: var(--doux);
	}
	.periode {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		gap: 12px;
	}
	.periode label {
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
	.repli summary {
		min-height: var(--cible);
		display: flex;
		align-items: center;
		font-weight: 700;
		cursor: pointer;
	}
	.noms,
	.vacances {
		margin: 0;
		padding: 0 0 8px;
		list-style: none;
		overflow-wrap: anywhere;
	}
	.vacances li + li {
		margin-top: 4px;
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
	.alerte ul {
		margin: 6px 0 0;
		padding-left: 20px;
	}
	.semaine {
		border-top: 1px solid var(--trait-doux);
	}
	.semaine summary {
		min-height: var(--cible);
		padding: 10px 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
		cursor: pointer;
	}
	.resume {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		font-size: 0.9375rem;
		color: var(--doux);
	}
	.resume .manque {
		color: var(--texte);
		font-weight: 700;
	}
	.semaine[open] .plages {
		margin-bottom: 12px;
	}
	.plages {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		grid-template-columns: 1fr;
		gap: 8px;
	}
	.plage {
		border: 1px solid var(--trait);
		border-left: 4px solid var(--equipe);
		border-radius: var(--rayon-petit);
		padding: 8px 10px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}
	.plage.non-arme {
		border-color: var(--accent);
		border-left-width: 4px;
	}
	.tete {
		min-height: var(--cible);
		display: flex;
		align-items: center;
		font-weight: 700;
		color: var(--texte);
	}
	.arme {
		font-weight: 600;
		font-size: 0.9375rem;
	}
	.signe {
		display: inline-grid;
		place-items: center;
		width: 1.25em;
		height: 1.25em;
		margin-right: 6px;
		border-radius: 50%;
		background: var(--accent);
		color: var(--sur-accent, #fff);
		font-weight: 800;
	}
	/* Les présents à la suite, séparés par des virgules : la carte reste courte au téléphone. */
	.presents {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		font-size: 0.9375rem;
		overflow-wrap: anywhere;
	}
	.presents li:not(:last-child)::after {
		content: ',';
		margin-right: 0.35em;
	}
	.etiquette {
		margin-left: 6px;
		padding: 0 6px;
		border: 1px solid var(--trait);
		border-radius: 999px;
		font-size: 0.8125rem;
		font-weight: 600;
	}
	.publier {
		display: flex;
		flex-direction: column;
		gap: 8px;
		align-items: flex-start;
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
	@media (min-width: 720px) {
		.plages {
			grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
		}
	}
</style>
