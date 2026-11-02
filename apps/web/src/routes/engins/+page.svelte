<script lang="ts">
	import type { EnginVu, PriseDeLaReleve, Releve } from '@gyro-caserne/socle';
	import { ETATS, etatPrise, situationDe, sousLigne, texteReleve } from '#lib/engins/textes.ts';
	import { pluriel } from '#lib/pluriel.ts';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import Groupe from '#lib/ui/Groupe.svelte';
	import ListeRangees from '#lib/ui/ListeRangees.svelte';
	import Pastille from '#lib/ui/Pastille.svelte';
	import Rangee from '#lib/ui/Rangee.svelte';
	import Vide from '#lib/ui/Vide.svelte';
	import { DESSINS } from '#lib/ui/icones-roles.ts';

	type PriseEngin = { prise: PriseDeLaReleve['prise']; ouvertes: number };
	let { data }: { data: { engins: EnginVu[]; gere: boolean; releve?: Releve; prises?: Record<number, PriseEngin> } } = $props();

	// Sous chaque engin : son type, sa plaque, où en est sa prise, ses écarts ouverts.
	const sous = (e: EnginVu) => {
		const p = data.prises?.[e.id];
		if (!p) return sousLigne(e);
		return [sousLigne(e), etatPrise(p.prise).texte, p.ouvertes ? pluriel(p.ouvertes, 'écart ouvert', 'écarts ouverts') : ''].filter(Boolean).join(' · ');
	};
	const faites = $derived(Object.values(data.prises ?? {}).filter((p) => p.prise?.etat === 'validee').length);

	const presents = $derived(data.engins.filter((e) => e.situation !== 'parti'));
	const partis = $derived(data.engins.filter((e) => e.situation === 'parti'));
</script>

<svelte:head>
	<title>Engins · Caserne · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<EnTetePage
		titre="Engins"
		phrase="Les engins du centre, leur état et leur fiche de prise de garde."
		retour={{ href: '/caserne', libelle: 'Caserne' }}
		action={data.gere ? { href: '/engins/nouveau', libelle: 'Ajouter un engin', dessin: DESSINS.plus } : undefined}
	/>

	<div class="colonnes">
		<div class="principal">
			{#if data.releve && presents.length}
				<ListeRangees titre="Prise de garde">
					<li><Rangee href="/engins/prise" titre={texteReleve(data.releve)} sous="{faites} sur {presents.length} {faites > 1 ? 'prises faites' : 'prise faite'}" icone="livre" alerte={faites < presents.length} /></li>
				</ListeRangees>
			{/if}

			{#if presents.length === 0}
				<Vide titre="Aucun engin pour l’instant." texte="Les engins du centre et ceux qu’on lui prête apparaîtront ici, avec leur état." action={data.gere ? { href: '/engins/nouveau', libelle: 'Ajouter un engin' } : undefined} />
			{:else}
				<ListeRangees titre="Au centre" compte={presents.length}>
					{#each presents as e (e.id)}
						<li>
							<Rangee href="/engins/{e.id}" titre={e.nom} sous={sous(e)} icone="camion">
								{#snippet droite()}<Pastille ton={ETATS[e.etat].ton}>{ETATS[e.etat].texte}</Pastille>{/snippet}
							</Rangee>
						</li>
					{/each}
				</ListeRangees>
			{/if}

			{#if partis.length}
				<Groupe titre="Partis" resume="{pluriel(partis.length, 'engin sorti', 'engins sortis')} de la liste ; leur historique reste">
					<ul class="liste" role="list">
						{#each partis as e (e.id)}
							<li><Rangee href="/engins/{e.id}" titre={e.nom} sous="{e.type} · {situationDe(e)}" icone="camion" discret /></li>
						{/each}
					</ul>
				</Groupe>
			{/if}
		</div>

		{#if data.gere}
			<ListeRangees titre="Gérer">
				<li><Rangee href="/engins/fiches" titre="Fiches de prise de garde" sous="Ce que l’on vérifie, zone par zone, pour chaque type" icone="livre" /></li>
				<li><Rangee href="/engins/fiches/fichier" titre="Fichier des fiches" sous="Toutes les fiches dans Excel ou LibreOffice" icone="outil" /></li>
			</ListeRangees>
		{/if}
	</div>
</div>

<style>
	.page,
	.colonnes,
	.principal {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}
	.liste {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	@media (min-width: 1024px) {
		.colonnes {
			display: grid;
			grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
			align-items: start;
			gap: 28px;
		}
	}
</style>
