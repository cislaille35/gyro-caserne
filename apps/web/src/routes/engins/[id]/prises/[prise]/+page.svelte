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
	// « 1 écart · 1 retrouvé », ou « Complète ».
	const resume = (refs: { ref: number }[]) => {
		const ecarts = refs.filter((e) => signalee(e.ref) || dejaOuvert(e.ref)).length;
		const retrouves = refs.filter((e) => retrouvee(e.ref)).length;
		return [ecarts ? pluriel(ecarts, 'écart') : '', retrouves ? pluriel(retrouves, 'retrouvé') : ''].filter(Boolean).join(' · ') || 'Complète';
	};
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
			{@const r = resume(z.elements)}
			<Groupe titre={z.nom} resume={r} alerte={r !== 'Complète'} niveauTitre={3} ouvert={r !== 'Complète'}>
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
		gap: var(--espace-16);
	}
	.fiche {
		gap: var(--espace-12);
	}
	h2,
	dl,
	dd {
		margin: 0;
	}
	h2 {
		font: 700 var(--texte-20) var(--police-titre);
	}
	.panneau {
		gap: var(--espace-12);
		padding: var(--espace-16);
		background: var(--surface);
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
		border-radius: var(--rayon-grand);
	}
	dl {
		display: flex;
		flex-direction: column;
		gap: var(--espace-12);
	}
	dt {
		font-weight: 700;
	}
	ul {
		margin: 0;
		padding: var(--espace-4) var(--espace-16);
		list-style: none;
	}
	li {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: var(--espace-4) var(--espace-12);
		padding: var(--espace-12) 0;
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
			max-width: var(--largeur-liste);
			margin-inline: auto;
		}
	}
</style>
