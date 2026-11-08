<script lang="ts">
	import { extraitDemande, type DemandeListee } from '@gyro-caserne/socle';
	import { dateCourte } from '#lib/engins/textes.ts';
	import { etatDemande } from '#lib/habillement.ts';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import ListeRangees from '#lib/ui/ListeRangees.svelte';
	import Pastille from '#lib/ui/Pastille.svelte';
	import Rangee from '#lib/ui/Rangee.svelte';
	import Vide from '#lib/ui/Vide.svelte';

	let { data }: { data: { enCours: DemandeListee[]; terminees: DemandeListee[]; estPersonne?: boolean } } = $props();
	// Le demandeur, puis qui la suit (ou la date de fin).
	const sousLigne = (d: DemandeListee) => [d.demandeur, d.finLe ? `finie le ${dateCourte(d.finLe)}` : d.prisePar ? `suivie par ${d.prisePar}` : `le ${dateCourte(d.creeLe)}`].join(', ');
</script>

<svelte:head>
	<title>Toutes les demandes · Habillement · Gyro Caserne</title>
</svelte:head>

{#snippet ligne(d: DemandeListee)}
	<li>
		<Rangee href="/habillement/{d.id}" titre={extraitDemande(d.texte)} sous={sousLigne(d)}>
			{#snippet droite()}<Pastille ton={etatDemande(d).ton}>{etatDemande(d).texte}</Pastille>{/snippet}
		</Rangee>
	</li>
{/snippet}

<div class="page">
	<EnTetePage titre="Toutes les demandes" retour={data.estPersonne === false ? { href: '/caserne', libelle: 'Caserne' } : { href: '/habillement', libelle: 'Habillement' }} />
	{#if data.enCours.length === 0 && data.terminees.length === 0}
		<Vide titre="Aucune demande" texte="Les demandes de tenue des agents arriveront ici, et dans votre casquette sur l’Accueil." />
	{:else}
		<div class="colonnes">
			<ListeRangees titre="En cours" compte={data.enCours.length}>
				{#each data.enCours as d (d.id)}{@render ligne(d)}{:else}<li><Rangee titre="Aucune demande en cours" discret /></li>{/each}
			</ListeRangees>
			{#if data.terminees.length}
				<ListeRangees titre="Terminées">
					{#each data.terminees as d (d.id)}{@render ligne(d)}{/each}
				</ListeRangees>
			{/if}
		</div>
	{/if}
</div>

<style>
	.page,
	.colonnes {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}
	@media (min-width: 1024px) {
		.colonnes {
			display: grid;
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			align-items: start;
			gap: 28px;
		}
	}
</style>
