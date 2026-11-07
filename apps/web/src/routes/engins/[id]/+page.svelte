<script lang="ts">
	import type { AnomalieVue, EnginVu, Fiche, PriseDeLaReleve, PriseHistorique, Releve } from '@gyro-caserne/socle';
	import { compteFiche, dateCourte, etatAffiche, etatPrise, ETATS, jourCourt, jourHeure, parEquipe, situationDe, texteEcart, texteEtape, texteReleve, tonEtape } from '#lib/engins/textes.ts';
	import { pluriel } from '#lib/pluriel.ts';
	import ListeRangees from '#lib/ui/ListeRangees.svelte';
	import Rangee from '#lib/ui/Rangee.svelte';
	import ZonesFiche from '#lib/engins/ZonesFiche.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import Pastille from '#lib/ui/Pastille.svelte';

	type Donnees = { engin: EnginVu; gere: boolean; fiche: Fiche; releve?: Releve; peutFaire?: boolean; prise?: PriseDeLaReleve['prise']; ouvertes?: AnomalieVue[]; historique?: PriseHistorique[]; peutSignaler?: boolean; aRemettre?: number | null };
	let { data }: { data: Donnees } = $props();
	const e = $derived(data.engin);
	const etat = $derived(etatPrise(data.prise ?? null));
	const ouvertes = $derived(data.ouvertes ?? []);
	const affiche = $derived(etatAffiche(e.etat, ouvertes.length));
	const geste = $derived(data.prise?.etat === 'validee' ? 'Voir la prise' : data.prise ? 'Reprendre la prise' : 'Faire la prise');
</script>

<svelte:head>
	<title>{e.nom} · Engins · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<EnTetePage titre={e.nom} phrase={[e.type, e.immatriculation].filter(Boolean).join(' · ')} retour={{ href: '/engins', libelle: 'Engins' }} />

	{#if e.situation !== 'parti' && (affiche !== 'disponible')}
		<section class="bandeau {affiche === 'indisponible' ? 'danger' : 'alerte'}" aria-labelledby="titre-bandeau">
			<h2 id="titre-bandeau">{affiche === 'indisponible' ? `${e.nom} est indisponible` : `Avertissement : ${pluriel(ouvertes.length, 'anomalie ouverte', 'anomalies ouvertes')}`}</h2>
			{#if ouvertes.length}
				<ul role="list">
					{#each ouvertes as o (o.id)}
						<li>
							<a href="/engins/anomalies/{o.id}"><strong>{o.libelle}</strong></a>
							<span>· {texteEcart(o)}{o.bloquante ? ' · rend l’engin indisponible' : ''}</span>
							<Pastille ton={tonEtape(o)}>{texteEtape(o)}</Pastille>
						</li>
					{/each}
				</ul>
			{:else}
				<p>Ses anomalies sont closes : la remise en service attend la décision du référent engins ou d’un chef.{#if data.aRemettre}{' '}<a href="/engins/anomalies/{data.aRemettre}">Voir l’anomalie et remettre en service</a>{/if}</p>
			{/if}
		</section>
	{/if}

	<div class="colonnes">
		<section class="panneau" aria-labelledby="titre-etat">
			<h2 id="titre-etat">État</h2>
			<dl>
				<div><dt>Disponibilité</dt><dd><Pastille ton={ETATS[affiche].ton}>{ETATS[affiche].texte}</Pastille></dd></div>
				<div><dt>Situation</dt><dd>{situationDe(e)}</dd></div>
				{#if data.releve && e.situation !== 'parti'}
					<div>
						<dt>Prise de garde</dt>
						<dd class="prise"><span class="doux">{texteReleve(data.releve)}</span><Pastille ton={etat.ton}>{etat.texte}</Pastille></dd>
					</div>
				{/if}
			</dl>
			{#if data.releve && e.situation !== 'parti' && (data.peutFaire || data.prise)}
				<div class="gestes"><a class="bouton principal" href="/engins/{e.id}/prise">{geste}</a></div>
			{/if}
			<div class="gestes">
				{#if data.peutSignaler}<a class="bouton" href="/engins/anomalies/signaler?engin={e.id}">Signaler un problème</a>{/if}
				<a class="bouton" href="/engins/anomalies?engin={e.id}">Anomalies de l’engin</a>
			</div>
			{#if data.gere}
				<div class="gestes">
					<a class="bouton" href="/engins/{e.id}/modifier">Modifier l’engin</a>
					<a class="bouton" href="/engins/fiches/{e.typeId}">Modifier la fiche {e.type}</a>
				</div>
			{/if}
		</section>

		{#if data.historique?.length}
			<ListeRangees titre="Dernières prises">
				{#each data.historique as h (h.id)}
					<li>
						<Rangee href="/engins/{e.id}/prises/{h.id}" titre="Relève du {jourCourt(h.releve)}" sous="Par {h.equipe ? parEquipe(h.equipe) : h.par}, {jourHeure(h.valideeLe)} · {h.signalees ? pluriel(h.signalees, 'écart') : 'complète'}{h.retrouvees ? ` · ${pluriel(h.retrouvees, 'retrouvé')}` : ''}" />
					</li>
				{/each}
			</ListeRangees>
		{/if}

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
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
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
		border-radius: var(--rayon-bouton);
		color: var(--encre);
		font-weight: 700;
		text-decoration: none;
	}
	.bouton:hover {
		background: var(--fond);
	}
	.bouton.principal {
		border-color: var(--rouge);
		background: var(--rouge);
		color: var(--sur-rouge);
	}
	.bouton.principal:hover {
		background: var(--rouge-survol);
	}
	.prise {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 10px;
	}
	.bandeau {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 14px 16px;
		border: 1px solid;
		border-radius: var(--rayon-grand);
	}
	.bandeau h2 {
		font-size: 1.0625rem;
	}
	.bandeau.alerte {
		background: var(--statut-alerte-fond);
		color: var(--statut-alerte-texte);
		border-color: var(--statut-alerte-trait);
	}
	.bandeau.danger {
		background: var(--statut-danger-fond);
		color: var(--statut-danger-texte);
		border-color: var(--statut-danger-trait);
	}
	.bandeau ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.bandeau li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 8px;
	}
	.bandeau a {
		color: inherit;
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
