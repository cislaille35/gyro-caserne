<script lang="ts">
	import type { EquipePlanning, SemaineCalculee } from '@gyro-caserne/socle';
	import { avecGroupe } from './astreinte.ts';
	import { duAu, finDeSemaine, jourLong, semainesParMois } from './dates.ts';
	import { reperesDe, resumeDuMois, SIGNES, type Donnees, type Mode } from './vues.ts';

	// L'année en douze mois repliés (le mois ouvert déplié), chacun résumé d'une ligne. Sert aussi la vue Équipes.
	// L'équipe est toujours écrite, jamais la couleur seule.
	let {
		mode,
		semaines,
		equipes,
		donnees,
		moisOuvert,
		maintenant = ''
	}: {
		mode: Mode;
		semaines: (SemaineCalculee & { mienne: boolean; groupe?: string | null })[];
		equipes: EquipePlanning[];
		donnees: Donnees;
		moisOuvert: number;
		maintenant?: string;
	} = $props();

	let seules = $state(false);
	const equipe = (id: number) => equipes.find((e) => e.id === id) ?? { id, nom: 'Équipe archivée', couleur: '#8a949e' };
	const mois = $derived(semainesParMois(donnees.annee, semaines));
	const premiere = $derived(semaines[0]?.debut ?? `${donnees.annee}-12-31`);
	const avantPremiere = $derived(donnees.feries.filter((f) => f.date < premiere));
	// Ma semaine pas encore finie : je peux demander à être remplacé.
	const aVenir = (s: SemaineCalculee) => maintenant !== '' && s.periodes.at(-1)!.fin > maintenant;
</script>

<div class="annee">
	{#if mode === 'moi'}
		<label class="interrupteur"><input type="checkbox" role="switch" bind:checked={seules} /> Seulement mes semaines</label>
	{/if}
	{#each mois as m (m.numero)}
		{@const liste = seules ? m.semaines.filter((s) => s.mienne) : m.semaines}
		<details class="repli" open={m.numero === moisOuvert}>
			<summary><h3>{m.nom}</h3><span class="resume">{resumeDuMois(donnees.annee, m.numero, m.semaines, donnees, mode)}</span></summary>
			<div class="contenu">
				{#if m.numero === 1 && avantPremiere.length}
					<p class="avant">{avantPremiere.map((f) => `${f.nom}, ${jourLong(f.date)}`).join(' · ')}</p>
				{/if}
				{#if liste.length === 0}
					<p class="avant">Aucune astreinte ce mois-ci.</p>
				{/if}
				<ol role="list">
					{#each liste as s (s.debut)}
						{@const e = avecGroupe(equipe(s.equipeId), s)}
						{@const r = reperesDe(s, donnees, mode)}
						<li class="semaine" class:mienne={mode === 'moi' && s.mienne} class:discrete={mode === 'moi' && !s.mienne} style:--equipe={e.couleur}>
							<p class="ligne">
								<span class="numero">S{s.numero}</span>
								<span class="dates">{duAu(s.debut, finDeSemaine(s.debut))}</span>
								{#if mode === 'moi' && s.mienne}<strong class="marque">Mon astreinte</strong>{/if}
								<span class="equipe">{e.nom}</span>
							</p>
							{#if r.length}
								<ul role="list" class="reperes">
									{#each r as x, i (i)}<li class={x.genre}><span class="signe">{SIGNES[x.genre]}&nbsp;:</span> {x.texte}</li>{/each}
								</ul>
							{/if}
							{#if mode === 'moi' && s.mienne && aVenir(s)}
								<a class="remplacer" href="/remplacements/demander#periode-{s.debut}">Me faire remplacer<span class="masque">{` : semaine ${s.numero}`}</span></a>
							{/if}
						</li>
					{/each}
				</ol>
			</div>
		</details>
	{/each}
</div>

<style>
	.annee {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.interrupteur {
		align-self: flex-start;
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		gap: 10px;
		font-weight: 600;
		cursor: pointer;
	}
	.interrupteur input {
		appearance: none;
		width: 44px;
		height: 26px;
		margin: 0;
		border-radius: 13px;
		border: 2px solid var(--doux);
		background: var(--surface);
		position: relative;
		cursor: pointer;
	}
	.interrupteur input::after {
		content: '';
		position: absolute;
		top: 3px;
		left: 3px;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--doux);
		transition: transform 0.15s;
	}
	.interrupteur input:checked {
		background: var(--encre);
		border-color: var(--encre);
	}
	.interrupteur input:checked::after {
		background: var(--surface);
		transform: translateX(18px);
	}
	.repli {
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
		border-radius: var(--rayon-grand);
		background: var(--surface);
	}
	.repli summary {
		min-height: 52px;
		padding: 6px 14px;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 2px 12px;
		cursor: pointer;
		list-style: none;
	}
	.repli summary::-webkit-details-marker {
		display: none;
	}
	.repli summary::before {
		content: '';
		width: 8px;
		height: 8px;
		border-right: 2px solid currentColor;
		border-bottom: 2px solid currentColor;
		transform: rotate(-45deg);
		transition: transform 0.15s;
	}
	.repli[open] summary::before {
		transform: rotate(45deg);
	}
	h3 {
		margin: 0;
		font: 700 1.25rem var(--police-titre);
	}
	.resume {
		color: var(--doux);
		font-size: 0.9375rem;
	}
	.contenu {
		padding: 0 12px 12px;
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
	.remplacement .signe {
		color: var(--statut-alerte-texte);
	}
	.vacances .signe {
		color: var(--statut-ok-texte);
	}
	.remplacer {
		display: inline-flex;
		align-items: center;
		min-height: 32px;
		margin-top: 4px;
		color: var(--encre);
		font-size: 0.875rem;
		font-weight: 600;
	}
	@media (prefers-reduced-motion: reduce) {
		.repli summary::before,
		.interrupteur input::after {
			transition: none;
		}
	}
</style>
