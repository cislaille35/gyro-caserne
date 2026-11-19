<script lang="ts">
	import { tick } from 'svelte';
	import { afterNavigate, preloadData } from '$app/navigation';
	import type { LigneSuivi, SujetSuivi } from '@gyro-caserne/socle';
	import { ajouterJours } from '@gyro-caserne/socle/dates';
	import { heure } from '#lib/murs/quand.ts';
	import { pluriel } from '#lib/pluriel.ts';
	import { jourLong } from '#lib/planning/dates.ts';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import ListeRangees from '#lib/ui/ListeRangees.svelte';
	import Rangee from '#lib/ui/Rangee.svelte';
	import Vide from '#lib/ui/Vide.svelte';
	import { montrerCouranteDeCote } from '#lib/ui/zone-defilante.ts';

	type Donnees = { lignes: LigneSuivi[]; suite: number | null; vu: number | null; sujet: SujetSuivi | null; aujourdhui: string };
	let { data }: { data: Donnees } = $props();

	const SUJETS: { id: SujetSuivi | null; libelle: string }[] = [
		{ id: null, libelle: 'Tout' },
		{ id: 'planning', libelle: 'Planning' },
		{ id: 'nominations', libelle: 'Nominations' },
		{ id: 'demandes', libelle: 'Demandes' },
		{ id: 'agents', libelle: 'Agents' },
		{ id: 'reglages', libelle: 'Réglages' }
	];

	// La liste grandit avec « Voir les plus anciennes » ; un autre filtre la reprend de zéro.
	let lignes = $derived(data.lignes);
	let suite = $derived(data.suite);
	let annonce = $state('');
	// Au téléphone, les filtres défilent sur une ligne : le filtre choisi est ramené à l'écran.
	let filtres = $state<HTMLElement>();
	afterNavigate(() => montrerCouranteDeCote(filtres));
	let enCours = $state(false);

	// Une carte par jour, du plus récent au plus ancien. Le repère de la dernière visite coupe la liste ; chaque carte garde son jour.
	const nomDuJour = (jour: string) => (jour === data.aujourdhui ? 'Aujourd’hui' : jour === ajouterJours(data.aujourdhui, -1) ? 'Hier' : jourLong(jour));
	const limite = $derived(data.vu === null ? -1 : lignes.findIndex((l) => l.id <= data.vu!));
	const groupes = $derived(
		lignes.reduce<{ jour: string; repere: boolean; lignes: LigneSuivi[] }[]>((groupes, l, i) => {
			const jour = l.quand.slice(0, 10);
			const repere = limite > 0 && i === limite;
			const dernier = groupes.at(-1);
			if (dernier?.jour === jour && !repere) dernier.lignes.push(l);
			else groupes.push({ jour, repere, lignes: [l] });
			return groupes;
		}, [])
	);
	const lienSuite = $derived(`?${data.sujet ? `sujet=${data.sujet}&` : ''}avant=${suite}`);

	// Avec JavaScript, la suite s'ajoute sous la liste ; le focus va à sa première ligne. Sans, le lien ouvre la page suivante.
	async function voirPlus(e: MouseEvent & { currentTarget: HTMLAnchorElement }) {
		if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
		e.preventDefault();
		if (enCours) return;
		enCours = true;
		const href = e.currentTarget.href;
		try {
			const r = await preloadData(href);
			if (r.type !== 'loaded' || r.status !== 200) return location.assign(href);
			const page = r.data as unknown as Donnees;
			lignes = [...lignes, ...page.lignes];
			suite = page.suite;
			annonce = `${pluriel(page.lignes.length, 'action')} de plus.`;
			await tick();
			const ligne = document.getElementById(`suivi-${page.lignes[0]?.id}`);
			const cible = ligne?.querySelector('a') ?? ligne;
			if (cible === ligne) ligne?.setAttribute('tabindex', '-1');
			cible?.focus();
		} catch {
			location.assign(href);
		} finally {
			enCours = false;
		}
	}
	// Certaines actions ne sont datées que du jour : pas d'heure inventée.
	const sousLigne = (l: LigneSuivi) => (l.quand.length > 10 ? heure(l.quand) : undefined);
</script>

<svelte:head>
	<title>Suivi du centre · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<EnTetePage titre="Suivi du centre" retour={{ href: '/caserne', libelle: 'Caserne' }} />
	<nav class="puces" aria-label="Filtrer le suivi" bind:this={filtres}>
		{#each SUJETS as s (s.libelle)}
			<a class="puce" href={s.id ? `?sujet=${s.id}` : '/suivi'} aria-current={data.sujet === s.id ? 'page' : undefined}>{s.libelle}</a>
		{/each}
	</nav>
	{#if lignes.length === 0 && data.sujet}
		<Vide texte="Rien dans ce sujet ces trois derniers mois." gyro={false} />
	{:else if lignes.length === 0}
		<Vide titre="Rien de nouveau au centre" texte="Ce qui s’est passé au centre ces trois derniers mois (planning, nominations, réglages, fiches, décisions sur les demandes) s’affichera ici." />
	{:else}
		{#each groupes as g (g.lignes[0]!.id)}
			{#if g.repere}<p class="repere">Avant votre dernière visite</p>{/if}
			<ListeRangees titre={nomDuJour(g.jour)}>
				{#each g.lignes as l (l.id)}
					<li id="suivi-{l.id}"><Rangee titre={`${l.qui} ${l.phrase}`} sous={sousLigne(l)} href={l.lien ?? undefined} /></li>
				{/each}
			</ListeRangees>
		{/each}
		{#if suite !== null}
			<p class="suite"><a class="lien-secondaire" href={lienSuite} onclick={voirPlus}>Voir les plus anciennes</a></p>
		{/if}
	{/if}
	<p class="masque" role="status" aria-live="polite">{annonce}</p>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--espace-24);
		max-width: var(--largeur-liste);
		margin-inline: auto;
		width: 100%;
	}
	/* Les filtres tiennent sur une ligne qui défile ; la marge laisse voir le contour du focus. */
	.puces {
		display: flex;
		gap: var(--espace-8);
		margin: -4px -16px;
		padding: var(--espace-4) var(--espace-16);
		overflow-x: auto;
		scrollbar-width: none;
	}
	.puce {
		flex: none;
		min-height: var(--cible);
		padding: 0 var(--espace-16);
		border: 1px solid var(--trait);
		border-radius: var(--rayon-bouton);
		background: var(--surface);
		color: var(--encre);
		font: 600 var(--texte-15) var(--police);
		white-space: nowrap;
		cursor: pointer;
	}
	/* Ici des liens : centrés comme les boutons des agents. */
	a.puce {
		display: inline-flex;
		align-items: center;
		text-decoration: none;
	}
	@media (hover: hover) and (pointer: fine) {
		.puce:hover {
			border-color: var(--encre);
		}
	}
	/* Choisi : fond plein et gras, pas seulement une teinte. */
	.puce[aria-current='page'] {
		background: var(--encre);
		color: var(--surface);
		border-color: var(--encre);
		font-weight: 700;
	}
	.suite {
		margin: 0;
		text-align: center;
	}
	/* Le repère de la dernière visite : un trait et ce qu'il sépare, écrit. */
	.repere {
		margin: 0;
		padding-top: var(--espace-8);
		border-top: 1px solid var(--trait);
		color: var(--doux);
		font-size: var(--texte-14);
		font-weight: 600;
		text-align: center;
	}
</style>
