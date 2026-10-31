<script lang="ts">
	import type { Snippet } from 'svelte';
	import { periodeCourte, type VueReservation } from '@gyro-caserne/socle';
	import { ETATS } from '../reservations.ts';
	import Pastille from './Pastille.svelte';

	// Une réservation : ressource, quantité et période, état écrit, qui la demande (`demandeur`, pour qui gère) ou le nom saisi par la réserve citoyenne,
	// le téléphone s'il est visible, le mot et le motif ; les gestes en dessous.
	let { r, demandeur = false, children }: { r: VueReservation; demandeur?: boolean; children?: Snippet } = $props();
	const qui = $derived(demandeur ? r.demandeur : r.nomDemandeur);
	const quand = $derived(`${r.forme === 'jours' ? `${r.quantite} · ` : ''}${periodeCourte(r.forme, r.debut, r.fin)}`);
</script>

<article class="carte" id="reservation-{r.id}" aria-labelledby="reservation-{r.id}-titre">
	<div class="haut">
		<h3 id="reservation-{r.id}-titre">{r.ressource}</h3>
		<Pastille ton={ETATS[r.etat].ton}>{ETATS[r.etat].libelle}</Pastille>
	</div>
	<p class="quand">{quand}</p>
	{#if qui}<p>{demandeur ? 'Demandé par' : 'Pour'} {qui}{#if r.telephone} · <a href="tel:{r.telephone}">{r.telephone}</a>{/if}</p>{/if}
	{#if r.mot}<p class="mot">« {r.mot} »</p>{/if}
	{#if r.motif}<p class="motif">{r.motif}</p>{/if}
	{#if children}<div class="gestes">{@render children()}</div>{/if}
</article>

<style>
	.carte {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 14px 16px;
		background: var(--surface);
		border: 1px solid var(--trait-doux);
		border-radius: var(--rayon-grand);
		overflow-wrap: anywhere;
	}
	.haut {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	h3 {
		margin: 0;
		font: 700 1.1875rem var(--police-titre);
	}
	p {
		margin: 0;
	}
	.quand {
		font-weight: 600;
	}
	.mot {
		color: var(--doux);
	}
	.motif {
		color: var(--statut-danger-texte);
		font-weight: 600;
	}
	.gestes {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 6px;
	}
</style>
