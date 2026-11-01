<script lang="ts">
	import type { EquipePlanning, ManoeuvreVue, SemaineCalculee, Vacances } from '@gyro-caserne/socle';
	import { heure } from '../murs/quand.ts';
	import { dansLaSemaine, duAu, finDeSemaine, jourLong, semainesParMois } from './dates.ts';

	// L'année, mois par mois : une liste de semaines par mois, lisible au lecteur d'écran dans l'ordre.
	// Au téléphone, les mois défilent ; à l'ordinateur, ils forment une grille. L'équipe est toujours écrite, jamais la couleur seule.
	let {
		annee,
		vue,
		semaines,
		equipes,
		manoeuvres,
		vacances,
		feries
	}: {
		annee: number;
		vue: 'moi' | 'equipes';
		semaines: (SemaineCalculee & { mienne: boolean })[];
		equipes: EquipePlanning[];
		manoeuvres: (ManoeuvreVue & { convoque: boolean })[];
		vacances: Vacances[];
		feries: { date: string; nom: string }[];
	} = $props();

	const equipe = (id: number) => equipes.find((e) => e.id === id) ?? { id, nom: 'Équipe archivée', couleur: '#8a949e' };
	const mois = $derived(semainesParMois(annee, semaines));
	const premiere = $derived(semaines[0]?.debut ?? `${annee}-12-31`);
	const avantPremiere = $derived(feries.filter((f) => f.date < premiere));
	const contient = (s: SemaineCalculee, moment: string) => s.periodes.some((p) => p.debut <= moment && moment < p.fin);

	type Repere = { genre: 'ferie' | 'vacances' | 'manoeuvre' | 'fete'; texte: string };
	function reperes(s: SemaineCalculee): Repere[] {
		const fin = finDeSemaine(s.debut);
		const liste: Repere[] = [];
		for (const f of feries) if (dansLaSemaine(f.date, s.debut)) liste.push({ genre: 'ferie', texte: `${f.nom}, ${jourLong(f.date)}` });
		for (const v of vacances) if (v.debut < fin && v.fin >= s.debut) liste.push({ genre: 'vacances', texte: v.nom });
		for (const m of manoeuvres) {
			if (!dansLaSemaine(m.debut, s.debut) || (vue === 'moi' && !m.convoque)) continue;
			liste.push({ genre: 'manoeuvre', texte: `« ${m.theme} », ${jourLong(m.debut)}, ${heure(m.debut)}` });
		}
		if (contient(s, `${annee}-12-25T12:00`)) liste.push({ genre: 'fete', texte: 'Garde de Noël' });
		if (contient(s, `${annee}-12-31T23:00`)) liste.push({ genre: 'fete', texte: 'Garde du Nouvel An' });
		return liste;
	}
	const SIGNES: Record<Repere['genre'], string> = { ferie: 'Férié', vacances: 'Vacances', manoeuvre: 'Manœuvre', fete: 'Fête' };
</script>

<div class="annee">
	{#each mois as m (m.numero)}
		<section class="mois" aria-labelledby="mois-{m.numero}">
			<h2 id="mois-{m.numero}">{m.nom}</h2>
			{#if m.numero === 1 && avantPremiere.length}
				<p class="avant">{avantPremiere.map((f) => `${f.nom}, ${jourLong(f.date)}`).join(' · ')}</p>
			{/if}
			<ol role="list">
				{#each m.semaines as s (s.debut)}
					{@const e = equipe(s.equipeId)}
					{@const r = reperes(s)}
					<li class="semaine" class:mienne={vue === 'moi' && s.mienne} class:discrete={vue === 'moi' && !s.mienne} style:--equipe={e.couleur}>
						<p class="ligne">
							<span class="numero">S{s.numero}</span>
							<span class="dates">{duAu(s.debut, finDeSemaine(s.debut))}</span>
							{#if vue === 'moi' && s.mienne}<strong class="marque">Mon astreinte</strong>{/if}
							<span class="equipe">{e.nom}</span>
						</p>
						{#if r.length}
							<ul class="reperes" role="list">
								{#each r as x, i (i)}<li class={x.genre}><span class="signe">{SIGNES[x.genre]}&nbsp;:</span> {x.texte}</li>{/each}
							</ul>
						{/if}
					</li>
				{/each}
			</ol>
		</section>
	{/each}
</div>

<style>
	.annee {
		display: grid;
		gap: 16px;
	}
	@media (min-width: 1024px) {
		.annee {
			grid-template-columns: repeat(3, minmax(0, 1fr));
			align-items: start;
		}
	}
	.mois {
		background: var(--surface);
		border: 1px solid var(--trait-doux);
		border-radius: var(--rayon-grand);
		padding: 14px;
	}
	h2 {
		margin: 0 0 8px;
		font: 700 1.375rem var(--police-titre);
	}
	.avant {
		margin: 0 0 8px;
		color: var(--doux);
		font-size: 0.875rem;
	}
	ol,
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	ol {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.semaine {
		padding: 6px 10px;
		border-left: 6px solid var(--equipe);
		border-radius: var(--rayon-petit);
		background: var(--fond);
	}
	.mienne {
		background: color-mix(in srgb, var(--equipe) 16%, var(--surface));
		outline: 2px solid var(--equipe);
		outline-offset: -2px;
	}
	.discrete {
		border-left-color: color-mix(in srgb, var(--equipe) 45%, transparent);
	}
	.discrete .equipe,
	.discrete .dates {
		color: var(--doux);
	}
	.ligne {
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 10px;
	}
	.numero {
		min-width: 2.6em;
		color: var(--doux);
		font-size: 0.875rem;
		font-variant-numeric: tabular-nums;
	}
	.dates {
		font-weight: 600;
	}
	.marque {
		padding: 0 8px;
		border-radius: 999px;
		background: var(--encre);
		color: var(--surface);
		font-size: 0.8125rem;
	}
	.equipe {
		margin-left: auto;
		font-size: 0.9375rem;
	}
	.reperes {
		margin-top: 4px;
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
	.vacances .signe {
		color: var(--statut-ok-texte);
	}
</style>
