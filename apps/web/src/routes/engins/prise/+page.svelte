<script lang="ts">
	import type { PriseDeLaReleve, Releve } from '@gyro-caserne/socle';
	import { etatPrise, texteReleve } from '#lib/engins/textes.ts';
	import { pluriel } from '#lib/pluriel.ts';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import ListeRangees from '#lib/ui/ListeRangees.svelte';
	import Rangee from '#lib/ui/Rangee.svelte';
	import Vide from '#lib/ui/Vide.svelte';

	let { data }: { data: { releve: Releve; peutFaire: boolean; engins: PriseDeLaReleve[] } } = $props();
	const faites = $derived(data.engins.filter((x) => x.prise?.etat === 'validee').length);
</script>

<svelte:head>
	<title>Prise de garde · Engins · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<EnTetePage titre="Prise de garde" phrase="{texteReleve(data.releve)}." retour={{ href: '/engins', libelle: 'Engins' }} />

	{#if data.engins.length === 0}
		<Vide titre="Aucun engin à vérifier." texte="Les engins du centre apparaîtront ici à chaque relève." />
	{:else}
		<p class="bilan"><strong>{faites} sur {data.engins.length}</strong> {faites > 1 ? 'prises faites' : 'prise faite'} pour cette relève.</p>
		<ListeRangees titre="Engins" compte={data.engins.length}>
			{#each data.engins as x (x.engin.id)}
				<li>
					<Rangee href="/engins/{x.engin.id}/prise" titre={x.engin.nom} sous={[x.engin.type, [etatPrise(x.prise).texte, x.ouvertes ? pluriel(x.ouvertes, 'anomalie ouverte', 'anomalies ouvertes') : ''].filter(Boolean).join(' · ')]} alerte={x.ouvertes > 0} />
				</li>
			{/each}
		</ListeRangees>
		{#if !data.peutFaire}<p class="doux">La prise est faite par les agents du centre ; vous la suivez ici.</p>{/if}
	{/if}
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--espace-20);
	}
	.bilan,
	.doux {
		margin: 0;
	}
	.doux {
		color: var(--doux);
	}
	@media (min-width: 1024px) {
		.page {
			max-width: 52rem;
		}
	}
</style>
