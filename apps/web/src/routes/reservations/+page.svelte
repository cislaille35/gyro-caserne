<script lang="ts">
	import type { Ressource } from '@gyro-caserne/socle';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import ListeRangees from '#lib/ui/ListeRangees.svelte';
	import Rangee from '#lib/ui/Rangee.svelte';
	import Vide from '#lib/ui/Vide.svelte';

	let { data }: { data: { ressources: Ressource[]; peutReserver: boolean; reserveCitoyenne: boolean; aValider: number; mesAVenir: number; peutGererMateriel: boolean } } = $props();

	const regle = (r: Ressource) => (r.forme === 'creneau' ? 'Par créneau, acceptée d’office si libre' : `${r.stock} en stock · validé par ${r.gestionnaire.nom}`);
	const gere = $derived(data.aValider > 0 || data.ressources.some((r) => r.jeGere));
</script>

<svelte:head>
	<title>Réservations · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<EnTetePage
		titre="Réservations"
		phrase={data.reserveCitoyenne ? 'Réservez la VL pour la réserve citoyenne.' : 'La VL et le matériel de l’amicale : voyez ce qui est pris, réservez le reste.'}
		retour={{ href: '/caserne', libelle: 'Caserne' }}
	/>

	{#if data.ressources.length === 0}
		<Vide titre="Rien à réserver pour vous." texte="Les ressources du centre que vous pouvez réserver apparaîtront ici." />
	{:else}
		<div class="colonnes">
			<ListeRangees titre="Suivre">
				<li><Rangee href="/reservations/miennes" titre="Mes réservations" sous="Vos demandes, à venir et passées" valeur={data.mesAVenir > 0 ? `${data.mesAVenir} à venir` : undefined} /></li>
				{#if gere}
					<li><Rangee href="/reservations/a-valider" titre="À valider" sous="Les demandes qui attendent votre réponse" valeur={data.aValider > 0 ? `${data.aValider} en attente` : undefined} alerte={data.aValider > 0} /></li>
				{/if}
				{#if data.peutGererMateriel}
					<li><Rangee href="/reservations/materiel" titre="Gérer le matériel" sous="Ajouter, changer le stock, retirer" /></li>
				{/if}
			</ListeRangees>
			<ListeRangees titre="Réserver">
				{#each data.ressources as r (r.id)}
					<li><Rangee href="/reservations/{r.id}" titre={r.nom} sous={regle(r)} icone={r.icone} /></li>
				{/each}
			</ListeRangees>
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
			grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
			align-items: start;
			gap: 28px;
		}
		/* « Réserver » à gauche, « Suivre » à droite. */
		.colonnes > :global(:first-child) {
			grid-column: 2;
			grid-row: 1;
		}
		.colonnes > :global(:last-child) {
			grid-column: 1;
			grid-row: 1;
		}
	}
</style>
