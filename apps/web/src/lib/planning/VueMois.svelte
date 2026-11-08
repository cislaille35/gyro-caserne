<script lang="ts">
	import { avecGroupe } from './astreinte.ts';
	import { encreSur } from '../couleurs.ts';
	import { formatDeDate } from '@gyro-caserne/socle/dates';
	import type { EquipePlanning, SemaineCalculee } from '@gyro-caserne/socle';
	import { jourLong, moisDeLAnnee } from './dates.ts';
	import { grilleDuMois, reperesDeLaGrille, SIGNES, type Donnees, type Mode, type Repere } from './vues.ts';

	// Le mois dans une carte : par semaine d'astreinte, le repère de son équipe (carré de couleur, nom écrit à l'encre, numéro) au-dessus de ses sept jours.
	// « Ma semaine » en à-plat de la couleur de l'équipe, le texte en noir ou en blanc selon elle, et « Mon astreinte » écrit.
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
		semaines: (SemaineCalculee & { mienne: boolean; groupe?: string | null })[];
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
		<div class="carte">
		<table>
			<caption class="masque">{moisDeLAnnee[mois - 1]} {donnees.annee}, une bande par semaine d’astreinte au-dessus de ses jours</caption>
			<thead>
				<tr>
					{#each lignes[0]!.jours as j (j.date)}<th scope="col">{court(j.date)}</th>{/each}
				</tr>
			</thead>
			{#each lignes as l (l.semaine.debut)}
				{@const e = avecGroupe(equipe(l.semaine.equipeId), l.semaine)}
				{@const mienne = mode === 'moi' && l.semaine.mienne}
				<tbody style:--equipe={e.couleur} style:--sur-equipe={mienne ? encreSur(e.couleur) : undefined} class:mienne>
					<tr>
						<th scope="rowgroup" colspan="7">
							<span class="bande">
								<span class="carre" aria-hidden="true"></span>
								<span class="equipe">{e.nom}</span>
								<span class="numero">S{l.semaine.numero}</span>
								{#if mienne}<span class="marque">Mon astreinte</span>{/if}
							</span>
						</th>
					</tr>
					<tr>
						{#each l.jours as j (j.date)}
							{@const du = parJour.filter((x) => x.date === j.date)}
							{@const ajd = j.date === maintenant.slice(0, 10)}
							<td class:hors={!j.dansLeMois} class:aujourdhui={ajd}>
								<a href={lienJour(l.semaine.debut, j.date)} aria-current={ajd ? 'date' : undefined}>
									<span class="jour" aria-hidden="true">{Number(j.date.slice(8, 10))}</span>
									<span class="masque">{jourLong(j.date)}{ajd ? ', aujourd’hui' : ''}{du.map((x) => `, ${SIGNES[x.genre]}`).join('')}{vacancesLe(j.date) ? ', vacances' : ''}</span>
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
		</div>
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
		gap: var(--espace-12);
	}
	.navigation {
		display: flex;
		align-items: center;
		gap: var(--espace-8);
	}
	h2 {
		flex: 1;
		margin: 0;
		font: 700 var(--texte-20) var(--police-titre);
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
		border-radius: var(--rayon-bouton);
		background: var(--surface);
		color: var(--encre);
		font-size: var(--texte-24);
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
		font-size: var(--texte-14);
		font-weight: 600;
		text-transform: capitalize;
	}
	.carte {
		padding: var(--espace-4) var(--espace-6) var(--espace-6);
		border: 1px solid transparent;
		border-radius: var(--rayon-grand);
		background: var(--surface);
		box-shadow: var(--ombre-carte);
	}
	/* Le repère de la semaine, sur toute la largeur : les sept cases gardent au moins 44 px au téléphone. */
	th[scope='rowgroup'] {
		padding: 0;
		text-align: left;
	}
	tbody + tbody th[scope='rowgroup'] {
		border-top: 1px solid var(--trait-doux);
	}
	.bande {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 2px var(--espace-8);
		padding: var(--espace-8) var(--espace-8) 2px;
		line-height: 1.2;
	}
	/* Le carré de couleur, décoratif : le nom de l'équipe est écrit à côté, à l'encre. */
	.carre {
		flex: none;
		width: 14px;
		height: 14px;
		border-radius: 4px;
		background: var(--equipe);
	}
	.equipe {
		font: 700 var(--texte-15) var(--police-titre);
		color: var(--encre);
	}
	.numero {
		font-size: var(--texte-14);
		font-weight: 400;
		color: var(--doux);
		font-variant-numeric: tabular-nums;
	}
	.marque {
		margin-left: auto;
		font: 700 var(--texte-14) var(--police-titre);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	td {
		padding: 0;
	}
	/* « Ma semaine » : un à-plat de la couleur de l'équipe ; tout y est écrit (et le repère du clavier) dans l'encre choisie pour elle. */
	.mienne {
		--focus: var(--sur-equipe);
	}
	.mienne th,
	.mienne td {
		background: var(--equipe);
	}
	.mienne th[scope='rowgroup'] {
		border-top: 0;
		border-radius: var(--rayon-bouton) var(--rayon-bouton) 0 0;
	}
	.mienne td:first-child {
		border-radius: 0 0 0 var(--rayon-bouton);
	}
	.mienne td:last-child {
		border-radius: 0 0 var(--rayon-bouton) 0;
	}
	.mienne .carre {
		display: none;
	}
	.mienne .equipe,
	.mienne .numero,
	.mienne .marque,
	.mienne td a,
	.mienne .signes span {
		color: var(--sur-equipe);
	}
	/* Le repère du clavier reste sur l'à-plat, où son encre se voit. */
	.mienne td a {
		font-weight: 600;
		outline-offset: -3px;
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
	@media (hover: hover) and (pointer: fine) {
		td a:hover .jour {
			text-decoration: underline;
		}
	}
	.hors a {
		color: var(--doux);
	}
	.hors .jour {
		font-size: var(--texte-14);
	}
	.mienne .aujourdhui .jour {
		background: var(--sur-equipe);
		color: var(--equipe);
	}
	/* Aujourd'hui : un carré d'encre pleine, et « aujourd'hui » dit aux lecteurs d'écran. */
	.aujourdhui .jour {
		width: 32px;
		height: 32px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--rayon-bouton);
		background: var(--encre);
		color: var(--surface);
		font-weight: 700;
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
		gap: var(--espace-4);
		font-size: var(--texte-15);
	}
	.reperes li {
		display: flex;
		align-items: baseline;
		gap: var(--espace-6);
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
