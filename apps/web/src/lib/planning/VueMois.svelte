<script lang="ts">
	import { formatDeDate } from '@gyro-caserne/socle/dates';
	import type { EquipePlanning, SemaineCalculee } from '@gyro-caserne/socle';
	import { jourLong, moisDeLAnnee } from './dates.ts';
	import { grilleDuMois, reperesDeLaGrille, SIGNES, type Donnees, type Mode, type Repere } from './vues.ts';

	// Le mois en bandes : par semaine d'astreinte, une bande à la couleur de son équipe (numéro et équipe écrits) au-dessus de ses sept jours.
	// Toucher un jour ouvre la semaine sur ce jour.
	let {
		mois,
		semaines,
		equipes,
		donnees,
		mode,
		precedent,
		suivant,
		lienJour,
		maintenant
	}: {
		mois: number;
		semaines: (SemaineCalculee & { mienne: boolean })[];
		equipes: EquipePlanning[];
		donnees: Donnees;
		mode: Mode;
		precedent: string;
		suivant: string;
		lienJour: (semaine: string, jour: string) => string;
		maintenant: string;
	} = $props();

	const equipe = (id: number) => equipes.find((e) => e.id === id) ?? { id, nom: 'Équipe archivée', couleur: '#8a949e' };
	const lignes = $derived(grilleDuMois(donnees.annee, mois, semaines));
	const prefixe = $derived(`${donnees.annee}-${String(mois).padStart(2, '0')}`);
	// Les repères du mois, dits en toutes lettres sous la grille ; dans la grille, un signe par jour.
	const parJour = $derived(reperesDeLaGrille(lignes, donnees, mode));
	const reperes = $derived.by(() => {
		const liste: Repere[] = parJour.filter((r) => r.date.startsWith(prefixe));
		// Avant la première relève de janvier, les jours sont à la semaine de l'année d'avant.
		const premiere = semaines[0]?.debut ?? '';
		for (const f of donnees.feries) if (f.date.startsWith(prefixe) && f.date < premiere) liste.push({ genre: 'ferie', texte: f.nom, date: f.date });
		return liste.sort((a, b) => a.date.localeCompare(b.date));
	});
	const vacancesLe = (date: string) => donnees.vacances.some((v) => v.debut <= date && date <= v.fin);
	const court = (date: string) => formatDeDate({ weekday: 'short', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
	const ICONES: Record<string, string> = { manoeuvre: 'M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 15.6 7.1 18.2l.9-5.5-4-3.9 5.5-.8z', ferie: 'M5 21V4h11l-2 4 2 4H5', fete: 'M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 15.6 7.1 18.2l.9-5.5-4-3.9 5.5-.8z', vacances: 'M12 4a8 8 0 0 1 8 8H4a8 8 0 0 1 8-8z M12 12v8' };
</script>

{#snippet icone(genre: string)}
	<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d={ICONES[genre] ?? ICONES.ferie} /></svg>
{/snippet}

<section class="vue" aria-labelledby="titre-mois">
	<div class="navigation">
		<a href={precedent} class="fleche" aria-label="Mois précédent" data-sveltekit-reset="false">‹</a>
		<h2 id="titre-mois">{moisDeLAnnee[mois - 1]} {donnees.annee}</h2>
		<a href={suivant} class="fleche" aria-label="Mois suivant" data-sveltekit-reset="false">›</a>
	</div>

	{#if lignes.length}
		<table>
			<caption class="masque">{moisDeLAnnee[mois - 1]} {donnees.annee}, une bande par semaine d’astreinte au-dessus de ses jours</caption>
			<thead>
				<tr>
					{#each lignes[0]!.jours as j (j.date)}<th scope="col">{court(j.date)}</th>{/each}
				</tr>
			</thead>
			{#each lignes as l (l.semaine.debut)}
				{@const e = equipe(l.semaine.equipeId)}
				{@const mienne = mode === 'moi' && l.semaine.mienne}
				<tbody style:--equipe={e.couleur} class:mienne>
					<tr>
						<th scope="rowgroup" colspan="7">
							<span class="bande">
								<span class="numero">S{l.semaine.numero}</span>
								<span class="equipe">{e.nom}</span>
								{#if mienne}<span class="marque">Mon astreinte</span>{/if}
							</span>
						</th>
					</tr>
					<tr>
						{#each l.jours as j (j.date)}
							{@const du = parJour.filter((x) => x.date === j.date)}
							<td class:hors={!j.dansLeMois} class:aujourdhui={j.date === maintenant.slice(0, 10)}>
								<a href={lienJour(l.semaine.debut, j.date)}>
									<span class="jour" aria-hidden="true">{Number(j.date.slice(8, 10))}</span>
									<span class="masque">{jourLong(j.date)}{du.map((x) => `, ${SIGNES[x.genre]}`).join('')}{vacancesLe(j.date) ? ', vacances' : ''}</span>
									<span class="signes" aria-hidden="true">
										{#each du as x, i (i)}<span class={x.genre}>{@render icone(x.genre)}</span>{/each}
										{#if vacancesLe(j.date)}<span class="vacances">{@render icone('vacances')}</span>{/if}
									</span>
								</a>
							</td>
						{/each}
					</tr>
				</tbody>
			{/each}
		</table>
	{/if}

	{#if reperes.length}
		<ul role="list" class="reperes" aria-label="Ce mois-ci">
			{#each reperes as x, i (i)}
				<li class={x.genre}>{@render icone(x.genre)}<span class="signe">{SIGNES[x.genre]}&nbsp;:</span> {x.texte}, {jourLong(x.date)}</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.vue {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.navigation {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	h2 {
		flex: 1;
		margin: 0;
		font: 700 1.375rem var(--police-titre);
		text-align: center;
	}
	.fleche {
		flex: none;
		width: var(--cible);
		height: var(--cible);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--trait);
		border-radius: 999px;
		background: var(--surface);
		color: var(--encre);
		font-size: 1.5rem;
		line-height: 1;
		text-decoration: none;
	}
	table {
		width: 100%;
		border-collapse: separate;
		border-spacing: 0;
		table-layout: fixed;
	}
	thead th {
		padding: 0 0 2px;
		color: var(--doux);
		font-size: 0.8125rem;
		font-weight: 600;
		text-transform: capitalize;
	}
	/* La bande de la semaine, sur toute la largeur : les sept cases gardent au moins 44 px au téléphone. */
	th[scope='rowgroup'] {
		padding: 8px 0 0;
		text-align: left;
	}
	.bande {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 2px 8px;
		padding: 4px 10px 4px 14px;
		box-shadow: inset 6px 0 0 var(--equipe);
		border-radius: 10px 10px 0 0;
		background: color-mix(in srgb, var(--equipe) 22%, var(--surface));
		line-height: 1.2;
	}
	.numero {
		font-size: 0.75rem;
		font-weight: 400;
		color: var(--doux);
		font-variant-numeric: tabular-nums;
	}
	.equipe {
		font-size: 0.875rem;
		font-weight: 700;
	}
	.marque {
		align-self: center;
		padding: 0 6px;
		border-radius: 999px;
		background: var(--encre);
		color: var(--surface);
		font-size: 0.6875rem;
		font-weight: 700;
	}
	td {
		padding: 0;
		background: color-mix(in srgb, var(--equipe) 10%, var(--surface));
		border-bottom: 1px solid color-mix(in srgb, var(--equipe) 40%, transparent);
	}
	/* La barre de l'équipe en ombre intérieure : elle ne prend pas de largeur aux cases (44 px à 360 px). */
	td:first-child {
		box-shadow: inset 6px 0 0 var(--equipe);
		border-radius: 0 0 0 10px;
	}
	td:last-child {
		border-right: 1px solid color-mix(in srgb, var(--equipe) 40%, transparent);
		border-radius: 0 0 10px 0;
	}
	.mienne td,
	.mienne .bande {
		background: color-mix(in srgb, var(--equipe) 30%, var(--surface));
	}
	td a {
		min-height: var(--cible);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1px;
		color: var(--encre);
		text-decoration: none;
		font-variant-numeric: tabular-nums;
	}
	td a:hover .jour {
		text-decoration: underline;
	}
	.hors a {
		color: var(--doux);
	}
	.aujourdhui .jour {
		min-width: 26px;
		border-radius: 999px;
		background: var(--encre);
		color: var(--surface);
		font-weight: 700;
		text-align: center;
	}
	.signes {
		display: flex;
		gap: 1px;
		min-height: 12px;
	}
	.manoeuvre {
		color: var(--statut-info-texte);
	}
	.ferie,
	.fete {
		color: var(--accent);
	}
	.vacances {
		color: var(--statut-ok-texte);
	}
	.reperes {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 0.9375rem;
	}
	.reperes li {
		display: flex;
		align-items: baseline;
		gap: 6px;
		color: var(--encre);
	}
	.reperes svg {
		flex: none;
		align-self: center;
	}
	.reperes .manoeuvre svg {
		color: var(--statut-info-texte);
	}
	.signe {
		font-weight: 700;
	}
	@media (min-width: 640px) {
		td a {
			min-height: 56px;
		}
	}
</style>
