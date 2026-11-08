<script lang="ts">
	import { humeurDuJour } from '#lib/gyro/humeurs.ts';
	import { formatDeDate } from '@gyro-caserne/socle/dates';
	import TirerPourActualiser from '#lib/animations/TirerPourActualiser.svelte';
	import { pluriel } from '#lib/pluriel.ts';
	import { page } from '$app/state';
	import { aujourdhuiParis } from '#lib/aujourdhui.ts';
	import { untrack } from 'svelte';
	import { lireAffichageContexte } from '#lib/gyro/niveau.ts';
	import { lireNonLus } from '#lib/messagerie/pastille.ts';
	import { quand } from '#lib/murs/quand.ts';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import FiltresEchanges from '#lib/ui/FiltresEchanges.svelte';
	import { ICONE_MAISON } from '#lib/ui/icones-roles.ts';
	import Pastille from '#lib/ui/Pastille.svelte';
	import PastilleMur from '#lib/ui/PastilleMur.svelte';
	import type { TuileMur } from './+layout.server';

	let { data, children } = $props();

	const affichage = lireAffichageContexte();
	const nonLus = lireNonLus();
	// Les messages ont leur propre page : la liste des murs s'efface.
	const surMessages = $derived(page.url.pathname === '/echanges/messages' || page.url.pathname.startsWith('/echanges/messages/'));

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

	const somme = (tuiles: (TuileMur | null)[]) => tuiles.reduce((n, t) => n + (t?.nouveautes ?? 0), 0);
	// La supervision, repliée, a son propre compte dans son résumé.
	const total = $derived(somme([s.centre, ...s.groupes, ...s.autres]));
	const totalSupervision = $derived(somme(s.supervision));
	const phrase = $derived.by(() => {
		const premiere = total === 0 ? 'Rien de neuf depuis votre dernière visite.' : `${pluriel(total, 'nouveauté')} depuis votre dernière visite.`;
		if (affichage.niveau !== 'vivant') return premiere;
		return `${premiere} ${humeurDuJour(aujourdhuiParis(), 'echanges')}`;
	});

	const SORTES: Record<TuileMur['type'], string | null> = { centre: null, vie: 'tout le monde', equipe: 'équipe', comite: 'comité' };
	const sorte = (t: TuileMur) => (t.type === 'equipe' && t.membre ? 'mon équipe' : SORTES[t.type]);
	const apercu = (t: TuileMur) => (t.derniere ? `${t.derniere.auteur} : ${t.derniere.texte}` : 'Rien de publié pour l’instant');
	const souhaiter = (prenom: string) => `/echanges/publier?mur=vie&texte=${encodeURIComponent(`Joyeux anniversaire ${prenom} !`)}`;
	// Les dates sont enregistrées à l'heure de Paris : on les lit telles quelles.
	const date = (iso: string, options: Intl.DateTimeFormatOptions) => formatDeDate({ ...options, timeZone: 'UTC' }).format(new Date(`${iso.slice(0, 16)}:00Z`));
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
	<svelte:element this={actif ? 'p' : 'h2'} {id} class="titre-groupe">{texte}</svelte:element>
{/snippet}

{#if surMessages}
	{@render children()}
{:else}
	<TirerPourActualiser />
	<div class="echanges" class:sur-un-mur={actif !== undefined} class:avec-journee={journee}>
		<!-- Sur un mur, aucun titre ici : celui du mur (h1) vient en premier. -->
		<nav class="murs" aria-label="Murs">
			{#if !actif}
				<EnTetePage titre="Échanges" {phrase} action={{ href: '/echanges/publier', libelle: 'Écrire' }} />
				{#if data.avis}<p class="avis" role="status">{data.avis}</p>{/if}
				{#if data.messagerie}<FiltresEchanges actif="murs" nonLus={nonLus.nombre} />{/if}
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
								<ul class="lignes">{@render tuile(c)}</ul>
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
							<ul class="lignes">
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
							<summary
								>Supervision {#if totalSupervision > 0}· {pluriel(totalSupervision, 'nouveauté')}{:else}<span class="doux">({s.supervision.length})</span>{/if}</summary
							>
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
										<strong>{#if e.enCours}En cours, depuis {heure(e.debut)}{:else}{jourCourt(e.debut)}, {heure(e.debut)}{/if}</strong>
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
{/if}

<style>
	.echanges {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 1rem;
	}
	.murs {
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
	}

	.avis {
		margin: 0;
		padding: var(--espace-12) var(--espace-16);
		border: 1px solid var(--statut-info-trait);
		border-radius: var(--rayon-grand);
		background: var(--statut-info-fond);
		color: var(--statut-info-texte);
		font-weight: 600;
	}

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
		gap: var(--espace-20);
	}
	.section {
		display: flex;
		flex-direction: column;
		gap: var(--espace-8);
	}
	.rubrique {
		margin: 0;
		font: 700 var(--texte-20) var(--police-titre);
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.doux {
		color: var(--doux);
		font-size: var(--texte-14);
		font-weight: 400;
	}

	/* Aujourd'hui au centre */
	.jour {
		display: flex;
		flex-direction: column;
		gap: var(--espace-12);
		padding: var(--espace-16);
		border-radius: var(--rayon-grand);
		border: 1px solid transparent;
		background: var(--surface);
	}
	.ligne-jour {
		display: flex;
		align-items: center;
		gap: var(--espace-12);
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
		background: var(--statut-neutre-fond);
		color: var(--statut-neutre-texte);
		font-weight: 700;
	}
	.souhaiter {
		flex: none;
		min-height: 44px;
		padding: 0 var(--espace-16);
		border: 1px solid var(--trait);
		border-radius: var(--rayon-bouton);
		display: inline-flex;
		align-items: center;
		background: var(--surface);
		color: var(--encre);
		font-weight: 600;
		text-decoration: none;
	}
	.evenement {
		min-height: 44px;
	}
	@media (hover: hover) and (pointer: fine) {
		.evenement:hover strong {
			text-decoration: underline;
		}
	}
	.calendrier {
		flex: none;
		width: 44px;
		height: 44px;
		border-radius: var(--rayon-bouton);
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		line-height: 1;
		background: var(--surface);
	}
	.jour-semaine {
		font-size: var(--texte-12);
		font-weight: 700;
		color: var(--accent);
	}
	.calendrier .numero {
		font: 700 var(--texte-18) var(--police-titre);
	}

	/* À venir, sur un mur à l'ordinateur */
	.journee {
		display: none;
	}
	.a-venir {
		display: flex;
		flex-direction: column;
		gap: var(--espace-8);
		padding: var(--espace-16);
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
		border-radius: var(--rayon-grand);
		background: var(--surface);
	}
	.a-venir ul {
		display: flex;
		flex-direction: column;
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
	@media (hover: hover) and (pointer: fine) {
		.venir:hover strong {
			text-decoration: underline;
		}
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
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
		border-radius: var(--rayon-grand);
		background: var(--surface);
		color: var(--encre);
		text-decoration: none;
	}
	.bandeau {
		display: flex;
		align-items: center;
		gap: var(--espace-12);
		padding: var(--espace-12) var(--espace-16);
		background: var(--rouge);
		color: var(--sur-rouge);
	}
	.bandeau .nom {
		flex: 1;
		font-weight: 700;
		font-size: var(--texte-18);
	}
	.officiel {
		padding: 3px var(--espace-8);
		border-radius: 999px;
		background: color-mix(in srgb, var(--sur-rouge) 20%, transparent);
		font-size: var(--texte-14);
		font-weight: 600;
	}
	.bandeau .compte {
		background: var(--sur-rouge);
		color: var(--rouge);
	}
	.contenu {
		display: flex;
		flex-direction: column;
		gap: var(--espace-6);
		padding: var(--espace-12) var(--espace-16);
	}
	.a-confirmer {
		display: flex;
		align-items: center;
		gap: var(--espace-6);
		color: var(--statut-alerte-texte);
		font-size: var(--texte-14);
		font-weight: 600;
	}
	.extrait {
		font-size: var(--texte-15);
	}
	@media (hover: hover) and (pointer: fine) {
		.centre:hover .extrait {
			text-decoration: underline;
		}
	}

	/* Un mur : une ligne de la carte du groupe, toute la ligne est le lien. */
	.tuile {
		min-height: 56px;
		display: flex;
		align-items: center;
		gap: var(--espace-12);
		padding: var(--espace-12) var(--espace-16);
		color: var(--encre);
		text-decoration: none;
	}
	@media (hover: hover) and (pointer: fine) {
		.tuile:hover {
			background: color-mix(in srgb, var(--encre) 4%, var(--surface));
		}
	}
	.tuile:focus-visible {
		outline-offset: -3px;
	}
	/* Le mur affiché : fond et nom en gras, pas la couleur seule. */
	.tuile[aria-current='page'] {
		background: var(--statut-neutre-fond);
	}
	.nom {
		overflow-wrap: anywhere;
	}
	.tuile[aria-current='page'] .nom {
		font-weight: 800;
	}
	.breve {
		min-height: var(--cible);
		padding: var(--espace-8) var(--espace-12);
		gap: var(--espace-12);
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
		column-gap: var(--espace-6);
		row-gap: 2px;
	}
	.nom {
		font-size: var(--texte-16);
	}
	.sorte,
	.heure {
		color: var(--doux);
		font-size: var(--texte-14);
	}
	.apercu {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		color: var(--doux);
		font-size: var(--texte-14);
	}
	.apercu.vide {
		font-style: italic;
	}
	.cote {
		flex: none;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: var(--espace-4);
	}
	.compte {
		min-width: 22px;
		height: 22px;
		padding: 0 var(--espace-6);
		border-radius: var(--rayon-bouton);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--rouge);
		color: var(--sur-rouge);
		font-size: var(--texte-12);
		font-weight: 700;
	}

	/* Sections repliées */
	.repli {
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
		border-radius: var(--rayon-grand);
		background: var(--surface);
		overflow: hidden;
	}
	.repli summary:focus-visible {
		outline-offset: -3px;
	}
	.repli summary {
		min-height: 48px;
		padding: 0 var(--espace-16);
		display: flex;
		align-items: center;
		gap: var(--espace-8);
		font-weight: 600;
		cursor: pointer;
		list-style: none;
	}
	/* Dans le bloc replié : les lignes sous un trait fin, sans carte de plus. */
	.repli li {
		border-top: 1px solid var(--trait-doux);
	}

	/* Téléphone : la liste seule, ou le mur seul. */
	.sur-un-mur .murs,
	.echanges:not(.sur-un-mur) .mur {
		display: none;
	}
	@media (min-width: 1024px) {
		.echanges:not(.sur-un-mur) .colonnes {
			display: grid;
			grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
			align-items: start;
			gap: var(--espace-24);
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
			gap: var(--espace-16);
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
			gap: var(--espace-16);
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
			grid-template-columns: 13rem minmax(0, 1fr) 15rem;
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
