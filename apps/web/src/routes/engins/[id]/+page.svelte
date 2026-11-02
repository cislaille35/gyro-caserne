<script lang="ts">
	import type { EnginVu, Fiche } from '@gyro-caserne/socle';
	import { compteFiche, dateCourte, ETATS, situationDe } from '#lib/engins/textes.ts';
	import ZonesFiche from '#lib/engins/ZonesFiche.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import Pastille from '#lib/ui/Pastille.svelte';

	let { data }: { data: { engin: EnginVu; gere: boolean; fiche: Fiche } } = $props();
	const e = $derived(data.engin);
</script>

<svelte:head>
	<title>{e.nom} · Engins · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<EnTetePage titre={e.nom} phrase={[e.type, e.immatriculation].filter(Boolean).join(' · ')} retour={{ href: '/engins', libelle: 'Engins' }} />

	<div class="colonnes">
		<section class="panneau" aria-labelledby="titre-etat">
			<h2 id="titre-etat">État</h2>
			<dl>
				<div><dt>Disponibilité</dt><dd><Pastille ton={ETATS[e.etat].ton}>{ETATS[e.etat].texte}</Pastille></dd></div>
				<div><dt>Situation</dt><dd>{situationDe(e)}</dd></div>
				<div><dt>Prise de garde</dt><dd class="doux">Le suivi des prises arrive avec la prise de garde au téléphone.</dd></div>
			</dl>
			{#if data.gere}
				<div class="gestes">
					<a class="bouton" href="/engins/{e.id}/modifier">Modifier l’engin</a>
					<a class="bouton" href="/engins/fiches/{e.typeId}">Modifier la fiche {e.type}</a>
				</div>
			{/if}
		</section>

		<section class="fiche" aria-labelledby="titre-fiche">
			<div class="tete">
				<h2 id="titre-fiche">Fiche {data.fiche.type}</h2>
				<p class="doux">{compteFiche(data.fiche.zones)} · version {data.fiche.version.numero}, du {dateCourte(data.fiche.version.creeLe)} ({data.fiche.version.auteur})</p>
			</div>
			{#if data.fiche.zones.length === 0}
				<p class="doux">Cette fiche est encore vide.{data.gere ? ' Ajoutez ses zones et ses éléments depuis « Modifier la fiche ».' : ''}</p>
			{:else}
				<ZonesFiche zones={data.fiche.zones} />
			{/if}
		</section>
	</div>
</div>

<style>
	.page,
	.colonnes,
	.fiche {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.colonnes {
		gap: 24px;
	}
	h2,
	p,
	dl,
	dd {
		margin: 0;
	}
	h2 {
		font: 700 1.25rem var(--police-titre);
	}
	.doux {
		color: var(--doux);
	}
	.tete {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.panneau {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 16px;
		background: var(--surface);
		border: 1px solid var(--trait-doux);
		border-radius: var(--rayon-grand);
	}
	dl {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	dl div {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	dt {
		font-weight: 700;
	}
	.gestes {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}
	.bouton {
		display: inline-flex;
		align-items: center;
		min-height: var(--cible);
		padding: 0 16px;
		border: 1px solid var(--trait);
		border-radius: 999px;
		color: var(--encre);
		font-weight: 700;
		text-decoration: none;
	}
	.bouton:hover {
		background: var(--fond);
	}
	@media (min-width: 1024px) {
		.colonnes {
			display: grid;
			grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
			align-items: start;
			gap: 28px;
		}
	}
</style>
