<script lang="ts">
	import type { LigneSuivi } from '@gyro-caserne/socle';
	import { ajouterJours } from '@gyro-caserne/socle/dates';
	import { heure } from '#lib/murs/quand.ts';
	import { jourLong } from '#lib/planning/dates.ts';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import ListeRangees from '#lib/ui/ListeRangees.svelte';
	import Rangee from '#lib/ui/Rangee.svelte';
	import Vide from '#lib/ui/Vide.svelte';

	let { data }: { data: { lignes: LigneSuivi[]; suite: number | null; aujourdhui: string } } = $props();

	// Une carte par jour, du plus récent au plus ancien.
	const nomDuJour = (jour: string) => (jour === data.aujourdhui ? 'Aujourd’hui' : jour === ajouterJours(data.aujourdhui, -1) ? 'Hier' : jourLong(jour));
	const jours = $derived(
		data.lignes.reduce<{ jour: string; lignes: LigneSuivi[] }[]>((groupes, l) => {
			const jour = l.quand.slice(0, 10);
			const dernier = groupes.at(-1);
			if (dernier?.jour === jour) dernier.lignes.push(l);
			else groupes.push({ jour, lignes: [l] });
			return groupes;
		}, [])
	);
	// Certaines actions ne sont datées que du jour : pas d'heure inventée.
	const sousLigne = (l: LigneSuivi) => (l.quand.length > 10 ? heure(l.quand) : undefined);
</script>

<svelte:head>
	<title>Suivi du centre · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<EnTetePage titre="Suivi du centre" retour={{ href: '/caserne', libelle: 'Caserne' }} />
	{#if data.lignes.length === 0}
		<Vide titre="Rien de nouveau au centre" texte="Ce que font les autres au centre (planning, nominations, réglages, fiches, décisions sur les demandes) s’affichera ici." />
	{:else}
		{#each jours as g (g.jour)}
			<ListeRangees titre={nomDuJour(g.jour)}>
				{#each g.lignes as l (l.id)}
					<li><Rangee titre={`${l.qui} ${l.phrase}`} sous={sousLigne(l)} href={l.lien ?? undefined} /></li>
				{/each}
			</ListeRangees>
		{/each}
		{#if data.suite !== null}
			<p class="suite"><a class="lien-secondaire" href="?avant={data.suite}">Voir les plus anciennes</a></p>
		{/if}
	{/if}
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
	.suite {
		margin: 0;
		text-align: center;
	}
</style>
