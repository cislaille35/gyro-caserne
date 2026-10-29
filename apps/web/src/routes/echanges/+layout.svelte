<script lang="ts">
	import { page } from '$app/state';
	import { aujourdhuiParis } from '#lib/aujourdhui.ts';
	import { untrack } from 'svelte';
	import GyroDuMoment from '#lib/gyro/GyroDuMoment.svelte';
	import { gyroSelonNiveau, lireAffichageContexte } from '#lib/gyro/niveau.ts';
	import { quand } from '#lib/murs/quand.ts';
	import { ICONE_MAISON } from '#lib/ui/icones-roles.ts';
	import Pastille from '#lib/ui/Pastille.svelte';
	import PastilleMur from '#lib/ui/PastilleMur.svelte';
	import type { TuileMur } from './+layout.server';

	let { data, children } = $props();

	const affichage = lireAffichageContexte();

	// Sur un mur : au téléphone, la liste laisse la place au mur ; à l'ordinateur, elle reste à gauche, en bref.
	const actif = $derived(page.params.mur);
	const s = $derived(data.sections);
	const jour = $derived(data.aujourdhui);
	// Sur un mur, à l'ordinateur : la colonne « Aujourd'hui », si elle a quelque chose à dire.
	const journee = $derived(actif !== undefined && (jour.anniversaires.length > 0 || data.aVenir.length > 0));
	// Au premier rendu seulement : ensuite, la personne ouvre et ferme les sections repliées à son gré.
	const ouvrir = untrack(() => ({
		autres: data.sections.autres.some((t) => t.cle === page.params.mur),
		supervision: data.sections.supervision.some((t) => t.cle === page.params.mur)
	}));

	const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;
	const total = $derived([s.centre, ...s.groupes, ...s.autres, ...s.supervision].reduce((n, t) => n + (t?.nouveautes ?? 0), 0));
	const VARIANTES = ['Le café est encore chaud.', 'Rien ne vous a échappé : Gyro veille.', 'La caserne bavarde, voici l’essentiel.'];
	const jourDeLAnnee = (iso: string) => Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${iso.slice(0, 4)}-01-01T00:00:00Z`)) / 864e5) + 1;
	const phrase = $derived.by(() => {
		const premiere = total === 0 ? 'Rien de neuf depuis votre dernière visite.' : `${pluriel(total, 'nouveauté')} depuis votre dernière visite.`;
		if (affichage.niveau !== 'vivant') return premiere;
		const aujourdhui = aujourdhuiParis();
		return `${premiere} ${VARIANTES[jourDeLAnnee(aujourdhui) % 3]}`;
	});

	const SORTES: Record<TuileMur['type'], string | null> = { centre: null, vie: 'tout le monde', equipe: 'équipe', comite: 'comité' };
	const sorte = (t: TuileMur) => (t.type === 'equipe' && t.membre ? 'mon équipe' : SORTES[t.type]);
	const apercu = (t: TuileMur) => (t.derniere ? `${t.derniere.auteur} : ${t.derniere.texte}` : 'Rien de publié pour l’instant');
	const souhaiter = (prenom: string) => `/echanges/publier?mur=vie&texte=${encodeURIComponent(`Joyeux anniversaire ${prenom} !`)}`;
	// Les dates sont enregistrées à l'heure de Paris : on les lit telles quelles.
	const date = (iso: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fr-FR', { ...options, timeZone: 'UTC' }).format(new Date(`${iso.slice(0, 16)}:00Z`));
	const jourCourt = (iso: string) => {
		const d = date(iso, { weekday: 'short', day: 'numeric', month: 'short' });
		return d.charAt(0).toUpperCase() + d.slice(1);
	};
	const heure = (iso: string) => (iso.slice(14, 16) === '00' ? `${Number(iso.slice(11, 13))} h` : `${Number(iso.slice(11, 13))} h ${iso.slice(14, 16)}`);
</script>

{#snippet compte(t: TuileMur)}
	{#if t.nouveautes > 0 && t.cle !== actif}
		<span class="compte"><span aria-hidden="true">{t.nouveautes}</span><span class="masque">{pluriel(t.nouveautes, 'nouveauté')}</span></span>
	{/if}
{/snippet}

{#snippet tuile(t: TuileMur)}
	<li>
		<a class="tuile" class:breve={actif} href="/echanges/{t.cle}" aria-current={t.cle === actif ? 'page' : undefined}>
			<PastilleMur icone={t.icone} couleur={t.couleur} numero={t.numero} taille={actif ? 28 : 48} />
			<span class="corps">
				<span class="ligne">
					<strong class="nom">{t.nom}</strong>
					{#if sorte(t) && !actif}<span class="sorte">· {sorte(t)}</span>{/if}
					{#if t.lectureSeule}<Pastille ton="neutre">Lecture seule</Pastille>{/if}
				</span>
				{#if !actif}<span class="apercu" class:vide={!t.derniere}>{apercu(t)}</span>{/if}
			</span>
			<span class="cote">
				{#if t.derniere && !actif}<span class="heure">{quand(t.derniere.creeLe)}</span>{/if}
				{@render compte(t)}
			</span>
		</a>
	</li>
{/snippet}

{#snippet anniversaire(a: { prenom: string; nom: string })}
	<div class="ligne-jour">
		<span class="visage" aria-hidden="true">{`${a.prenom.charAt(0)}${a.nom.charAt(0)}`.toUpperCase()}</span>
		<strong class="quoi">{a.prenom} {a.nom} fête son anniversaire</strong>
		<a class="souhaiter" href={souhaiter(a.prenom)}>Souhaiter<span class="masque">{` à ${a.prenom}`}</span></a>
	</div>
{/snippet}

{#snippet titre(id: string, texte: string)}
	<svelte:element this={actif ? 'p' : 'h2'} {id} class="rubrique">{texte}</svelte:element>
{/snippet}

<div class="echanges" class:sur-un-mur={actif !== undefined} class:avec-journee={journee}>
	<!-- Sur un mur, aucun titre ici : celui du mur (h1) vient en premier. -->
	<nav class="murs" aria-label="Murs">
		{#if !actif}
			<header class="entete">
				{#if gyroSelonNiveau(affichage.niveau).visible}<span class="mascotte"><GyroDuMoment tenue="normal" taille={72} decoratif /></span>{/if}
				<div class="titres">
					<h1>Échanges</h1>
					<p class="phrase">{phrase}</p>
				</div>
				<a class="ecrire" href="/echanges/publier">
					<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
					<span class="libelle">Écrire</span>
				</a>
			</header>
		{/if}

		<div class="colonnes">
			<div class="colonne">
				{#if !actif && (jour.anniversaires.length > 0 || jour.evenement)}
					<section class="jour" aria-labelledby="t-jour">
						<h2 id="t-jour" class="rubrique">Aujourd’hui au centre</h2>
						{#each jour.anniversaires as a, i (i)}{@render anniversaire(a)}{/each}
						{#if jour.evenement}
							{@const e = jour.evenement}
							<a class="ligne-jour evenement" href="/echanges/{e.cle}/{e.id}">
								<span class="calendrier" aria-hidden="true"
									><span class="jour-semaine">{date(e.debut, { weekday: 'short' }).replace('.', '').toUpperCase()}</span><span class="numero">{Number(e.debut.slice(8, 10))}</span></span
								>
								<span class="quoi">
									<strong>{e.titre}</strong>
									<span class="doux">{date(e.debut, { weekday: 'long', day: 'numeric', month: 'long' })}, {heure(e.debut)} · vous n’avez pas répondu</span>
								</span>
							</a>
						{/if}
					</section>
				{/if}

				{#if s.centre}
					{@const c = s.centre}
					<section class="section" aria-labelledby="t-centre">
						{@render titre('t-centre', 'Le centre')}
						{#if actif}
							<ul>{@render tuile(c)}</ul>
						{:else}
							<a class="centre" href="/echanges/centre">
								<span class="bandeau">
									<svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d={ICONE_MAISON} /></svg>
									<span class="nom">Le centre</span>
									<span class="officiel">Officiel</span>
									{@render compte(c)}
								</span>
								<span class="contenu">
									{#if c.aConfirmer > 0}
										<span class="a-confirmer">
											<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 7v6M12 17v.5" /><circle cx="12" cy="12" r="10" /></svg>
											{pluriel(c.aConfirmer, 'annonce')} à lire et confirmer
										</span>
									{/if}
									{#if c.derniere}
										<span class="extrait"><strong>{c.derniere.auteur}</strong> : {c.derniere.texte}</span>
										<span class="doux">{quand(c.derniere.creeLe)} · visible par tous les agents</span>
									{:else}
										<span class="doux">Rien de publié pour l’instant</span>
									{/if}
								</span>
							</a>
						{/if}
					</section>
				{/if}
			</div>

			<div class="colonne">
				{#if s.groupes.length > 0}
					<section class="section" aria-labelledby="t-groupes">
						{@render titre('t-groupes', 'Mes groupes')}
						<ul>
							{#each s.groupes as t (t.cle)}{@render tuile(t)}{/each}
						</ul>
						{#if s.autres.length > 0}
							<details class="repli" open={ouvrir.autres}>
								<summary>Autres comités <span class="doux">({s.autres.length}, rien de neuf)</span></summary>
								<ul>
									{#each s.autres as t (t.cle)}{@render tuile(t)}{/each}
								</ul>
							</details>
						{/if}
					</section>
				{/if}

				{#if s.supervision.length > 0}
					<details class="repli" open={ouvrir.supervision}>
						<summary>Supervision <span class="doux">({s.supervision.length})</span></summary>
						<ul>
							{#each s.supervision as t (t.cle)}{@render tuile(t)}{/each}
						</ul>
					</details>
				{/if}
			</div>
		</div>
	</nav>
	<div class="mur">{@render children()}</div>
	<!-- Après le mur, à l'écran comme au clavier : à côté à partir de 1280 px, dessous en deçà. -->
	{#if journee}
		<aside class="journee" aria-label="Aujourd’hui">
			{#if jour.anniversaires.length > 0}
				<section class="jour" aria-labelledby="t-jour-mur">
					<h2 id="t-jour-mur" class="rubrique">Aujourd’hui au centre</h2>
					{#each jour.anniversaires as a, i (i)}{@render anniversaire(a)}{/each}
				</section>
			{/if}
			{#if data.aVenir.length > 0}
				<section class="a-venir" aria-labelledby="t-a-venir">
					<h2 id="t-a-venir" class="rubrique">À venir</h2>
					<ul>
						{#each data.aVenir as e (e.id)}
							<li>
								<a class="venir" href="/echanges/{e.cle}/{e.id}">
									<strong>{jourCourt(e.debut)}, {heure(e.debut)}</strong>
									<span class="doux">{e.titre}{e.cle === 'centre' ? '' : ` (${e.nomMur})`}</span>
								</a>
							</li>
						{/each}
					</ul>
				</section>
			{/if}
		</aside>
	{/if}
</div>

<style>
	.echanges {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 1rem;
	}
	.murs {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	/* En-tête */
	.entete {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.mascotte {
		flex: none;
		margin: -10px -8px -10px -12px;
	}
	.titres {
		flex: 1;
		min-width: 0;
	}
	h1 {
		margin: 0;
		font: 700 1.875rem/1.1 var(--police-titre);
	}
	.phrase {
		margin: 2px 0 0;
		color: var(--doux);
		font-size: 0.9375rem;
	}
	.ecrire {
		flex: none;
		min-width: 48px;
		height: 48px;
		border-radius: 999px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		background: var(--rouge);
		color: var(--sur-rouge);
		font-weight: 600;
		text-decoration: none;
		box-shadow: 0 4px 12px color-mix(in srgb, var(--rouge) 30%, transparent);
	}
	.ecrire:hover {
		background: color-mix(in srgb, var(--rouge) 88%, black);
		color: var(--sur-rouge);
	}
	.libelle,
	.masque {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.colonnes,
	.colonne {
		display: flex;
		flex-direction: column;
		gap: 22px;
	}
	.section {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.rubrique {
		margin: 0;
		font: 700 1.25rem var(--police-titre);
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.doux {
		color: var(--doux);
		font-size: 0.875rem;
		font-weight: 400;
	}

	/* Aujourd'hui au centre */
	.jour {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;
		border-radius: 20px;
		background: linear-gradient(135deg, var(--statut-alerte-fond) 0%, var(--icone-coeur-fond) 100%);
	}
	.ligne-jour {
		display: flex;
		align-items: center;
		gap: 12px;
		color: var(--encre);
		text-decoration: none;
	}
	.quoi {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.visage {
		flex: none;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--icone-coeur-texte);
		color: var(--surface);
		font-weight: 700;
	}
	.souhaiter {
		flex: none;
		min-height: 44px;
		padding: 0 16px;
		border-radius: 999px;
		display: inline-flex;
		align-items: center;
		background: var(--surface);
		color: var(--icone-coeur-texte);
		font-weight: 600;
		text-decoration: none;
	}
	.evenement {
		min-height: 44px;
	}
	.evenement:hover strong {
		text-decoration: underline;
	}
	.calendrier {
		flex: none;
		width: 44px;
		height: 44px;
		border-radius: 12px;
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		line-height: 1;
		background: var(--surface);
	}
	.jour-semaine {
		font-size: 0.6875rem;
		font-weight: 700;
		color: var(--accent);
	}
	.calendrier .numero {
		font: 700 1.125rem var(--police-titre);
	}

	/* À venir, sur un mur à l'ordinateur */
	.journee {
		display: none;
	}
	.a-venir {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 16px;
		border: 1px solid var(--trait-doux);
		border-radius: 20px;
		background: var(--surface);
	}
	.a-venir ul {
		gap: 2px;
	}
	.venir {
		min-height: 44px;
		display: flex;
		flex-direction: column;
		justify-content: center;
		color: var(--encre);
		text-decoration: none;
	}
	.venir:hover strong {
		text-decoration: underline;
	}
	.journee .ligne-jour {
		flex-wrap: wrap;
	}
	.journee .ligne-jour .quoi {
		flex-basis: calc(100% - 56px);
	}
	.journee .souhaiter {
		margin-left: 56px;
	}

	/* Le centre */
	.centre {
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border: 1px solid var(--trait-doux);
		border-radius: 20px;
		background: var(--surface);
		color: var(--encre);
		text-decoration: none;
		box-shadow: 0 2px 10px color-mix(in srgb, var(--encre) 6%, transparent);
	}
	.bandeau {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 12px 14px;
		background: var(--rouge);
		color: var(--sur-rouge);
	}
	.bandeau .nom {
		flex: 1;
		font-weight: 700;
		font-size: 1.125rem;
	}
	.officiel {
		padding: 3px 8px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--sur-rouge) 20%, transparent);
		font-size: 0.8125rem;
		font-weight: 600;
	}
	.bandeau .compte {
		background: var(--sur-rouge);
		color: var(--rouge);
	}
	.contenu {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 12px 14px;
	}
	.a-confirmer {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--statut-alerte-texte);
		font-size: 0.875rem;
		font-weight: 600;
	}
	.extrait {
		font-size: 0.9375rem;
	}
	.centre:hover .extrait {
		text-decoration: underline;
	}

	/* Une tuile de mur */
	.tuile {
		min-height: 56px;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px;
		border: 1px solid var(--trait-doux);
		border-radius: 18px;
		background: var(--surface);
		color: var(--encre);
		text-decoration: none;
	}
	.tuile:hover {
		border-color: var(--trait);
		box-shadow: 0 2px 10px color-mix(in srgb, var(--encre) 8%, transparent);
	}
	.tuile[aria-current='page'] {
		box-shadow: inset 4px 0 0 var(--accent);
		border-color: var(--trait);
	}
	.breve {
		padding: 8px 12px;
		gap: 10px;
		border-radius: var(--rayon-grand);
	}
	.corps {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.ligne {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		column-gap: 6px;
		row-gap: 2px;
	}
	.nom {
		font-size: 1.0625rem;
	}
	.sorte,
	.heure {
		color: var(--doux);
		font-size: 0.8125rem;
	}
	.apercu {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		color: var(--doux);
		font-size: 0.875rem;
	}
	.apercu.vide {
		font-style: italic;
	}
	.cote {
		flex: none;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 4px;
	}
	.compte {
		min-width: 22px;
		height: 22px;
		padding: 0 6px;
		border-radius: 11px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--rouge);
		color: var(--sur-rouge);
		font-size: 0.75rem;
		font-weight: 700;
	}

	/* Sections repliées */
	.repli {
		border: 1px solid var(--trait-doux);
		border-radius: 18px;
		background: var(--surface);
	}
	.repli summary {
		min-height: 48px;
		padding: 0 14px;
		display: flex;
		align-items: center;
		gap: 8px;
		font-weight: 600;
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
	.repli ul {
		padding: 0 10px 10px;
	}
	@media (prefers-reduced-motion: reduce) {
		.repli summary::before {
			transition: none;
		}
	}

	/* Téléphone : la liste seule, ou le mur seul. */
	.sur-un-mur .murs,
	.echanges:not(.sur-un-mur) .mur {
		display: none;
	}
	@media (min-width: 640px) {
		.ecrire {
			padding: 0 20px 0 16px;
		}
		.libelle {
			position: static;
			width: auto;
			height: auto;
			overflow: visible;
			clip-path: none;
		}
	}
	@media (min-width: 1024px) {
		.echanges:not(.sur-un-mur) .colonnes {
			display: grid;
			grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
			align-items: start;
			gap: 24px;
		}
		.sur-un-mur {
			grid-template-columns: 20rem minmax(0, 1fr);
			align-items: start;
			gap: 1.5rem;
		}
		.sur-un-mur .murs {
			display: flex;
			position: sticky;
			top: 1rem;
		}
		.sur-un-mur .colonnes,
		.sur-un-mur .colonne {
			gap: 14px;
		}
		.sur-un-mur ul {
			gap: 6px;
		}
		.sur-un-mur .murs .rubrique {
			font-size: 1rem;
			color: var(--doux);
		}
		/* Entre 1024 et 1279 px : « Aujourd'hui » sous le mur, dans l'ordre du clavier. */
		.avec-journee .murs {
			grid-row: 1 / span 2;
		}
		.journee {
			grid-column: 2;
			grid-row: 2;
			display: flex;
			flex-wrap: wrap;
			align-items: start;
			gap: 16px;
		}
		.journee > section {
			flex: 1 1 16rem;
		}
		.avec-journee .mur {
			grid-column: 2;
			grid-row: 1;
		}
	}
	/* À partir de 1280 px : trois colonnes, la liste, le mur, puis « Aujourd'hui ». */
	@media (min-width: 1280px) {
		.sur-un-mur {
			grid-template-columns: 16rem minmax(0, 1fr) 16rem;
			gap: 1.25rem;
		}
		.avec-journee .murs {
			grid-row: 1;
		}
		.journee {
			grid-column: 3;
			grid-row: 1;
			flex-direction: column;
			flex-wrap: nowrap;
			align-items: stretch;
			position: sticky;
			top: 1rem;
		}
		.journee > section {
			flex: none;
		}
	}
</style>
