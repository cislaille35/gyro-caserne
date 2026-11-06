<script lang="ts">
	import type { EquipePlanning, SemaineCalculee } from '@gyro-caserne/socle';
	import { duAuCourt } from './astreinte.ts';
	import { duAu, finDeSemaine, jourLong } from './dates.ts';
	import { joursDeLaSemaine, reperesDe, SIGNES, type Donnees, type Mode } from './vues.ts';

	// Une semaine d'astreinte, jour par jour : les plages réelles, l'équipe, les remplacements, manœuvres et fériés.
	let {
		semaine,
		equipe,
		donnees,
		mode,
		precedente,
		suivante,
		maintenant
	}: {
		semaine: SemaineCalculee & { mienne: boolean };
		equipe: EquipePlanning;
		donnees: Donnees;
		mode: Mode;
		precedente: string;
		suivante: string;
		maintenant: string;
	} = $props();

	const jours = $derived(joursDeLaSemaine(semaine, donnees, 'equipes'));
	const vacances = $derived(reperesDe(semaine, donnees, mode).filter((r) => r.genre === 'vacances'));
	const majuscule = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
	const mienne = $derived(mode === 'moi' && semaine.mienne);
	// Une période commence-t-elle encore ce jour-là ? Au début d'une plage, ou à l'heure de coupure (fin de la première nuit) si une garde court.
	const coupure = $derived(semaine.periodes[0]!.fin.slice(11, 16));
	const encoreCeJour = (date: string) =>
		semaine.periodes.some((p) => (p.debut.startsWith(date) && p.debut > maintenant) || (p.debut < `${date}T${coupure}` && `${date}T${coupure}` < p.fin && `${date}T${coupure}` > maintenant));
</script>

<section class="vue" aria-labelledby="titre-semaine">
	<div class="navigation">
		<a href={precedente} class="fleche" aria-label="Semaine précédente" data-sveltekit-reset="false">‹</a>
		<h2 id="titre-semaine">Semaine {semaine.numero}<span class="dates">{duAu(semaine.debut, finDeSemaine(semaine.debut))}</span></h2>
		<a href={suivante} class="fleche" aria-label="Semaine suivante" data-sveltekit-reset="false">›</a>
	</div>

	<div class="bande" class:mienne style:--equipe={equipe.couleur}>
		<p class="qui">
			<span class="pastille" aria-hidden="true"></span><strong>{equipe.nom}</strong> d’astreinte
			{#if mienne}<span class="marque">Mon astreinte</span>{/if}
		</p>
		<p class="doux">{majuscule(duAuCourt(semaine.periodes[0]!.debut, semaine.periodes.at(-1)!.fin))}</p>
		{#each vacances as v (v.texte)}<p class="doux">Vacances : {v.texte}</p>{/each}
		{#if mienne && semaine.periodes.at(-1)!.fin > maintenant}
			<a class="remplacer" href="/remplacements/demander?semaine={semaine.debut}">Me faire remplacer<span class="masque">{` : semaine ${semaine.numero}`}</span></a>
		{/if}
	</div>

	<ol role="list" class="jours">
		{#each jours as j (j.date)}
			<li id="jour-{j.date}" class:aujourdhui={j.date === maintenant.slice(0, 10)}>
				<h3>{majuscule(jourLong(j.date))}{#if j.date === maintenant.slice(0, 10)}<span class="auj">&nbsp;· aujourd’hui</span>{/if}</h3>
				<p class="plages">
					{#if j.plages.length}
						<span class="masque">Astreinte : </span>{#each j.plages as p, i (i)}<span class="plage">{p}</span>{/each}
					{:else}
						<span class="doux">Pas d’astreinte</span>
					{/if}
				</p>
				{#if j.reperes.length}
					<ul role="list" class="reperes">
						{#each j.reperes as r, i (i)}<li class={r.genre}><span class="signe">{SIGNES[r.genre]}&nbsp;:</span> {r.texte}</li>{/each}
					</ul>
				{/if}
				{#if mienne && j.plages.length && encoreCeJour(j.date)}
					<a class="remplacer-jour" href="/remplacements/demander?semaine={semaine.debut}&jour={j.date}">Me faire remplacer<span class="masque">{` : ${jourLong(j.date)}`}</span></a>
				{/if}
			</li>
		{/each}
	</ol>
</section>

<style>
	.vue {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	p,
	h2,
	h3 {
		margin: 0;
	}
	.navigation {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	h2 {
		flex: 1;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: center;
		gap: 0 10px;
		font: 700 1.375rem var(--police-titre);
		text-align: center;
	}
	h2 .dates {
		color: var(--doux);
		font: 600 1rem var(--police);
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
		font-size: 1.5rem;
		line-height: 1;
		text-decoration: none;
	}
	.fleche:hover {
		border-color: var(--encre);
	}
	.bande {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 12px 14px;
		border-left: 8px solid var(--equipe);
		border-radius: var(--rayon-grand);
		background: color-mix(in srgb, var(--equipe) 10%, var(--surface));
	}
	.bande.mienne {
		outline: 2px solid var(--equipe);
		outline-offset: -2px;
	}
	.qui {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 8px;
	}
	.pastille {
		width: 12px;
		height: 12px;
		border-radius: 6px;
		background: var(--equipe);
	}
	.marque {
		padding: 0 8px;
		border-radius: 999px;
		background: var(--encre);
		color: var(--surface);
		font-size: 0.8125rem;
		font-weight: 700;
	}
	.doux {
		color: var(--doux);
	}
	.remplacer {
		align-self: flex-start;
		min-height: 32px;
		display: inline-flex;
		align-items: center;
		color: var(--encre);
		font-weight: 600;
	}
	.remplacer-jour {
		align-self: flex-start;
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		color: var(--encre);
		font-size: 0.9375rem;
		font-weight: 600;
	}
	ol,
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.jours {
		display: flex;
		flex-direction: column;
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
		border-radius: var(--rayon-grand);
		background: var(--surface);
		overflow: hidden;
	}
	.jours > li {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 10px 14px;
		scroll-margin-top: calc(var(--hauteur-entete) + 12px);
	}
	.jours > li + li {
		border-top: 1px solid var(--trait-doux);
	}
	.jours > li:target {
		box-shadow: inset 4px 0 0 var(--focus);
	}
	.aujourdhui {
		background: var(--statut-neutre-fond);
	}
	h3 {
		font: 600 1rem var(--police);
	}
	.auj {
		color: var(--doux);
		font-weight: 400;
	}
	.plages {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.plage {
		padding: 1px 10px;
		border-radius: 999px;
		border: 1px solid var(--trait);
		font-size: 0.875rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.reperes {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: 0.875rem;
	}
	.signe {
		font-weight: 700;
	}
	.ferie .signe,
	.fete .signe {
		color: var(--accent);
	}
	.manoeuvre .signe {
		color: var(--statut-info-texte);
	}
	.remplacement .signe {
		color: var(--statut-alerte-texte);
	}
</style>
