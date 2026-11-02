<script lang="ts">
	import type { PriseFaite } from '@gyro-caserne/socle';
	import { jourCourt, jourHeure, parEquipe, texteEcart } from '#lib/engins/textes.ts';
	import { pluriel } from '#lib/pluriel.ts';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import Groupe from '#lib/ui/Groupe.svelte';

	let { data }: { data: { prise: PriseFaite } } = $props();
	const p = $derived(data.prise);
	const signalee = (ref: number) => p.signalees.find((a) => a.ref === ref);
	const retrouvee = (ref: number) => p.retrouvees.find((a) => a.ref === ref);
	const dejaOuvert = (ref: number) => p.dejaOuvertes.includes(ref);
	const nbDans = (refs: { ref: number }[]) => refs.filter((e) => signalee(e.ref) || retrouvee(e.ref) || dejaOuvert(e.ref)).length;
</script>

<svelte:head>
	<title>Prise du {jourCourt(p.releve)} · {p.engin.nom} · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<EnTetePage titre="Prise du {jourCourt(p.releve)}" phrase="{p.engin.nom} · faite par {p.equipe ? parEquipe(p.equipe) : p.participants[0]}, {jourHeure(p.valideeLe)}" retour={{ href: `/engins/${p.engin.id}`, libelle: p.engin.nom }} />

	<section class="panneau" aria-labelledby="titre-bilan">
		<h2 id="titre-bilan">Bilan</h2>
		<dl>
			<div><dt>Participants</dt><dd>{p.participants.join(', ')}</dd></div>
			<div><dt>Écarts signalés</dt><dd>{p.signalees.length ? pluriel(p.signalees.length, 'anomalie créée', 'anomalies créées') : 'Aucun'}</dd></div>
			{#if p.retrouvees.length}<div><dt>Retrouvés</dt><dd>{pluriel(p.retrouvees.length, 'signalement clos', 'signalements clos')}</dd></div>{/if}
		</dl>
	</section>

	<section class="fiche" aria-labelledby="titre-fiche">
		<h2 id="titre-fiche">La fiche, telle que vérifiée</h2>
		{#each p.zones as z (z.ref)}
			{@const n = nbDans(z.elements)}
			<Groupe titre={z.nom} resume={n ? pluriel(n, 'écart') : 'Complète'} alerte={n > 0} niveauTitre={3} ouvert={n > 0}>
				<ul role="list">
					{#each z.elements as e (e.ref)}
						{@const a = signalee(e.ref)}
						{@const r = retrouvee(e.ref)}
						<li class:alerte={a}>
							<span class="libelle">{e.libelle}</span>
							{#if a}<span class="etat">{texteEcart(a, e.quantite)}</span>
							{:else if r}<span class="etat ok">Retrouvé</span>
							{:else if dejaOuvert(e.ref)}<span class="etat">Déjà signalé</span>
							{:else}<span class="etat doux">Présent</span>{/if}
						</li>
					{/each}
				</ul>
			</Groupe>
		{/each}
	</section>
</div>

<style>
	.page,
	.fiche,
	.panneau {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.fiche {
		gap: 10px;
	}
	h2,
	dl,
	dd {
		margin: 0;
	}
	h2 {
		font: 700 1.25rem var(--police-titre);
	}
	.panneau {
		gap: 12px;
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
	dt {
		font-weight: 700;
	}
	ul {
		margin: 0;
		padding: 4px 14px;
		list-style: none;
	}
	li {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 4px 12px;
		padding: 10px 0;
	}
	li + li {
		border-top: 1px solid var(--trait-doux);
	}
	.libelle {
		flex: 1 1 60%;
		overflow-wrap: anywhere;
	}
	.alerte .libelle,
	.etat {
		font-weight: 700;
	}
	.alerte .etat {
		color: var(--statut-alerte-texte);
	}
	.ok {
		color: var(--statut-ok-texte);
	}
	.doux {
		color: var(--doux);
		font-weight: 400;
	}
	@media (min-width: 1024px) {
		.page {
			max-width: 52rem;
		}
	}
</style>
