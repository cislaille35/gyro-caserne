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
	<div class="mois pile">
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
</div>

<style>
	.annee {
		display: flex;
		flex-direction: column;
		gap: var(--espace-12);
	}
	.interrupteur {
		align-self: flex-start;
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		gap: var(--espace-12);
		font-weight: 600;
		cursor: pointer;
	}
	.interrupteur input {
		appearance: none;
		width: 44px;
		height: 26px;
		margin: 0;
		border: 2px solid var(--doux);
		border-radius: var(--rayon-grand);
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
		transition: transform var(--duree-etat) var(--courbe-sortie);
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
		padding: var(--espace-6) var(--espace-16);
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 2px var(--espace-12);
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
		transition: transform var(--duree-etat) var(--courbe-sortie);
	}
	.repli[open] summary::before {
		transform: rotate(45deg);
	}
	h3 {
		margin: 0;
		font: 700 var(--texte-20) var(--police-titre);
	}
	.resume {
		color: var(--doux);
		font-size: var(--texte-15);
	}
	.contenu {
		padding: 0 var(--espace-12) var(--espace-12);
	}
	.avant {
		margin: 0 0 var(--espace-8);
		color: var(--doux);
		font-size: var(--texte-14);
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
		gap: var(--espace-6);
	}
	.equipe::before {
		content: '';
		display: inline-block;
		width: 10px;
		height: 10px;
		margin-right: var(--espace-6);
		border-radius: 2px;
		background: var(--equipe);
	}
	.semaine {
		padding: var(--espace-6) var(--espace-12);
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
		gap: var(--espace-4) var(--espace-12);
	}
	.numero {
		min-width: 2.6em;
		color: var(--doux);
		font-size: var(--texte-14);
		font-variant-numeric: tabular-nums;
	}
	.dates {
		font-weight: 600;
	}
	.marque {
		padding: 0 var(--espace-8);
		border-radius: 999px;
		background: var(--encre);
		color: var(--surface);
		font-size: var(--texte-14);
	}
	.equipe {
		margin-left: auto;
		font-size: var(--texte-15);
	}
	.reperes {
		margin-top: var(--espace-4);
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: var(--texte-14);
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
		margin-top: var(--espace-4);
		color: var(--encre);
		font-size: var(--texte-14);
		font-weight: 600;
	}
	@media (prefers-reduced-motion: reduce) {
		.repli summary::before,
		.interrupteur input::after {
			transition: none;
		}
	}
</style>
