<script lang="ts">
	import TirerPourActualiser from '#lib/animations/TirerPourActualiser.svelte';
	import Annee from '#lib/planning/Annee.svelte';
	import { jourLong, momentLong } from '#lib/planning/dates.ts';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import Pastille from '#lib/ui/Pastille.svelte';
	import PastilleEquipe from '#lib/ui/PastilleEquipe.svelte';
	import Vide from '#lib/ui/Vide.svelte';

	let { data } = $props();

	const p = $derived(data.planning);
	const CALENDRIER = 'M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4';
	const action = $derived(p.peutPreparer ? { href: `/planning/preparer?annee=${p.annee}`, libelle: 'Préparer l’année', dessin: CALENDRIER } : undefined);
	const equipe = (id: number) => (p.publiee ? p.equipes.find((e) => e.id === id) : undefined);
	const lien = (annee: number, vue: string) => `?annee=${annee}&vue=${vue}`;
	const FETES = { noel: 'Noël', nouvel_an: 'Nouvel An' } as const;
</script>

<svelte:head>
	<title>Planning {p.annee} · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<TirerPourActualiser />
	<EnTetePage titre="Planning {p.annee}" phrase="Les astreintes et les manœuvres de l’année." {action} />

	<nav class="raccourcis" aria-label="Remplacements">
		<a href="/remplacements/demander">Me faire remplacer</a>
		<a href="/remplacements">Remplacements</a>
	</nav>

	<nav class="annees" aria-label="Années">
		<a href={lien(p.annee - 1, data.vue)}>‹ {p.annee - 1}</a>
		<a href={lien(p.annee + 1, data.vue)}>{p.annee + 1} ›</a>
	</nav>

	{#if !p.publiee}
		<Vide titre="Le planning de l’année n’est pas encore publié." texte="Le chef de centre le prépare : il apparaîtra ici dès sa publication, avec vos semaines d’astreinte et les manœuvres." />
	{:else}
		{@const a = p.prochaine.astreinte}
		{@const m = p.prochaine.manoeuvre}
		{@const f = p.prochaine.fete}
		<div class="bref">
			{#if a}
				{@const e = equipe(a.equipeId)}
				<section class="carte" aria-labelledby="prochaine-astreinte">
					<h2 id="prochaine-astreinte">Ma prochaine astreinte</h2>
					{#if a.enCours}<p><Pastille ton="ok">En cours</Pastille></p>{/if}
					<p class="fort">Du {momentLong(a.debut)} au {momentLong(a.fin)}</p>
					{#if e}<p><PastilleEquipe nom={e.nom} couleur={e.couleur} /></p>{/if}
				</section>
			{/if}
			<section class="carte" aria-labelledby="prochaine-manoeuvre">
				<h2 id="prochaine-manoeuvre">Ma prochaine manœuvre</h2>
				{#if m}
					<p class="fort">{m.theme}</p>
					<p>{momentLong(m.debut)} · {m.lieu}{m.petitDejeuner ? ' · petit-déjeuner' : ''}</p>
				{:else}
					<p class="doux">Aucune manœuvre prévue pour vous.</p>
				{/if}
			</section>
			{#if f}
				<section class="carte fete" aria-labelledby="prochaine-fete">
					<h2 id="prochaine-fete">Garde de {FETES[f.fete]}</h2>
					<p>Votre équipe tient la garde de {FETES[f.fete]}, le {jourLong(f.date)}.</p>
				</section>
			{/if}
			{#if p.monEquipe === null && !a}
				<p class="doux note">Vous n’êtes dans aucune équipe : voici le planning de toutes les équipes.</p>
			{/if}
		</div>

		<nav class="vues" aria-label="Vue de l’année">
			<a href={lien(p.annee, 'moi')} aria-current={data.vue === 'moi' ? 'page' : undefined}>Mon année</a>
			<a href={lien(p.annee, 'equipes')} aria-current={data.vue === 'equipes' ? 'page' : undefined}>Toutes les équipes</a>
		</nav>

		<Annee annee={p.annee} vue={data.vue === 'equipes' ? 'equipes' : 'moi'} semaines={p.semaines} equipes={p.equipes} manoeuvres={p.manoeuvres} vacances={p.vacances} feries={p.feries} remplacements={p.remplacements} maintenant={data.maintenant} />
	{/if}
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 16px;
		max-width: 72rem;
	}
	p,
	h2 {
		margin: 0;
	}
	.annees,
	.vues {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	.annees {
		justify-content: space-between;
		max-width: 44rem;
	}
	.raccourcis {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	.raccourcis a,
	.annees a,
	.vues a {
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
	.vues a[aria-current='page'] {
		background: var(--encre);
		border-color: var(--encre);
		color: var(--surface);
	}
	.bref {
		display: grid;
		gap: 12px;
	}
	@media (min-width: 720px) {
		.bref {
			grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
		}
	}
	.carte {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 16px;
		border: 1px solid var(--trait-doux);
		border-radius: var(--rayon-grand);
		background: var(--surface);
	}
	h2 {
		font: 700 1.25rem var(--police-titre);
	}
	.fort {
		font-weight: 600;
	}
	.doux {
		color: var(--doux);
	}
	.fete {
		border-color: var(--statut-alerte-trait);
		background: var(--statut-alerte-fond);
		color: var(--statut-alerte-texte);
	}
</style>
