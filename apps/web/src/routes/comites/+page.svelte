<script lang="ts">
	import { murDuComite } from '#lib/murs/phrases.ts';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import ListeRangees from '#lib/ui/ListeRangees.svelte';
	import Insigne from '#lib/ui/Insigne.svelte';
	import Rangee from '#lib/ui/Rangee.svelte';
	import type { IconeRole as NomIcone } from '#lib/ui/icones-roles.ts';

	let { data } = $props();

	type Titulaire = { id: number; nom: string; grade: string | null; ecrire: boolean };
	const PERSONNE = 'Personne pour l’instant';
	// Les rôles d'équipe, rangés selon leur nature.
	const avecEquipes = $derived(data.equipes.filter((r) => r.parEquipe.length > 0));
	const fonctionsEquipe = $derived(avecEquipes.filter((r) => r.nature === 'fonction'));
	const missionsEquipe = $derived(avecEquipes.filter((r) => r.nature === 'mission'));
	// Nommer est ce qui change le plus souvent ; à défaut, les réglages (comités, rôles).
	const gerer = $derived(data.peutNominations ? { href: '/nominations', quoi: 'les nominations' } : data.peutReglages ? { href: '/reglages', quoi: 'les réglages du centre' } : null);
</script>

<svelte:head>
	<title>Comités et référents · Gyro Caserne</title>
</svelte:head>

<!-- « Écrire » ouvre la conversation à deux, comme « Message » sur la fiche d'un agent. -->
{#snippet ecrire(t: Titulaire, nomVisible = false)}
	{#if nomVisible}
		<a class="lien-secondaire ecrire" href="/echanges/messages/a/{t.id}">{`Écrire à ${t.nom}`}</a>
	{:else}
		<a class="lien-secondaire ecrire" href="/echanges/messages/a/{t.id}">Écrire<span class="masque">{` à ${t.nom}`}</span></a>
	{/if}
{/snippet}

<!-- Les titulaires, chacun avec l'insigne de son grade. -->
{#snippet noms(titulaires: Titulaire[])}
	{#each titulaires as t, i (t.id)}{#if i > 0}{', '}{/if}{t.nom}<Insigne grade={t.grade} />{:else}{PERSONNE}{/each}
{/snippet}

<!-- Un rôle tenu équipe par équipe. -->
{#snippet parEquipe(r: (typeof data.equipes)[number])}
	<ListeRangees titre={r.systeme === 'chef_equipe' ? 'Chefs de garde' : r.nom} niveau={3}>
		{#each r.parEquipe as e (e.equipe)}{@render role(e.equipe, e.titulaires)}{/each}
	</ListeRangees>
{/snippet}

<!-- Un titulaire : « Écrire » à droite ; plusieurs : un « Écrire à … » par titulaire, sous les noms. -->
{#snippet role(titre: string, titulaires: Titulaire[], icone?: NomIcone)}
	{@const ecrits = titulaires.filter((t) => t.ecrire)}
	{#snippet sousNoms()}{@render noms(titulaires)}{/snippet}
	<li>
		{#if titulaires.length > 1 && ecrits.length > 0}
			<Rangee {icone} {titre} sousContenu={sousNoms}>
				{#each ecrits as t (t.id)}{@render ecrire(t, true)}{/each}
			</Rangee>
		{:else}
			<Rangee {icone} {titre} sousContenu={sousNoms}>
				{#snippet droite()}{#if ecrits[0]}{@render ecrire(ecrits[0])}{/if}{/snippet}
			</Rangee>
		{/if}
	</li>
{/snippet}

<div class="page">
	<EnTetePage titre="Comités et référents" retour={{ href: '/caserne', libelle: 'Caserne' }}>
		{#snippet secondaire()}
			{#if gerer}<a class="lien-secondaire" href={gerer.href}>Gérer<span class="masque">{` ${gerer.quoi}`}</span></a>{/if}
		{/snippet}
	</EnTetePage>

	<div class="colonnes">
		<section class="colonne" aria-labelledby="titre-comites">
			<h2 id="titre-comites" class="titre-section">Comités</h2>
			{#each data.comites as c (c.id)}
				<ListeRangees titre={c.nom} compte={c.membres.length} niveau={3}>
					{#if c.membres.length > 0}<li class="intertitre"><h4>Membres</h4></li>{/if}
					{#each c.membres as m (m.id)}
						<li>
							<Rangee titre={m.nom} grade={m.grade} sous={m.roles.join(', ')}>
								{#snippet droite()}{#if m.ecrire}{@render ecrire(m)}{/if}{/snippet}
							</Rangee>
						</li>
					{:else}
						<li><Rangee titre="Aucun membre pour l’instant" discret /></li>
					{/each}
					{#if c.mur}
						<li><Rangee href="/echanges/comite:{c.id}" titre={murDuComite(c.nom)} /></li>
					{/if}
					{#if c.ressources.length > 0}<li class="intertitre"><h4>À réserver</h4></li>{/if}
					{#each c.ressources as r (r.id)}
						<li><Rangee href="/reservations/{r.id}" titre={r.nom} /></li>
					{/each}
				</ListeRangees>
			{:else}
				<ul role="list" class="lignes"><li><Rangee titre="Aucun comité pour l’instant" discret /></li></ul>
			{/each}
		</section>

		<div class="colonne roles">
			{#if data.commandement.length > 0 || fonctionsEquipe.length > 0 || data.fonctions.length > 0}
				<section class="colonne" aria-labelledby="titre-fonctions">
					<h2 id="titre-fonctions" class="titre-section">Fonctions</h2>
					{#if data.commandement.length > 0}
						<ListeRangees titre="Chef de centre et adjoint" niveau={3}>
							{#each data.commandement as r (r.id)}{@render role(r.nom, r.titulaires)}{/each}
						</ListeRangees>
					{/if}
					{#each fonctionsEquipe as r (r.id)}{@render parEquipe(r)}{/each}
					{#if data.fonctions.length > 0}
						<ListeRangees titre="Autres fonctions" niveau={3}>
							{#each data.fonctions as r (r.id)}{@render role(r.nom, r.titulaires, r.icone)}{/each}
						</ListeRangees>
					{/if}
				</section>
			{/if}
			{#if data.missions.length > 0 || missionsEquipe.length > 0}
				<section class="colonne" aria-labelledby="titre-missions">
					<h2 id="titre-missions" class="titre-section">Missions</h2>
					{#if data.missions.length > 0}
						<ListeRangees>
							{#each data.missions as r (r.id)}{@render role(r.nom, r.titulaires, r.icone)}{/each}
						</ListeRangees>
					{/if}
					{#each missionsEquipe as r (r.id)}{@render parEquipe(r)}{/each}
				</section>
			{/if}
		</div>
	</div>
</div>

<style>
	/* Plus serré qu'un lien de page : il tient dans la ligne, au téléphone aussi. */
	.ecrire {
		min-height: 40px;
		padding: 0 var(--espace-12);
		font-size: var(--texte-15);
	}
	.page,
	.colonne {
		display: flex;
		flex-direction: column;
		gap: var(--espace-24);
	}
	.colonnes {
		display: flex;
		flex-direction: column;
		gap: var(--espace-32);
	}
	/* Entre Fonctions et Missions, le même écart qu'entre deux sections. */
	.roles {
		gap: var(--espace-32);
	}
	/* Les parties d'une carte de comité. */
	.intertitre h4 {
		margin: 0;
		padding: var(--espace-12) var(--espace-16) var(--espace-4);
		font: 600 var(--texte-15)/1.2 var(--police-titre);
		color: var(--doux);
	}
	.intertitre + li {
		border-top: none;
	}
	.titre-section {
		margin: 0;
		font: 700 var(--texte-20)/1.2 var(--police-titre);
	}
	/* À l'ordinateur, les comités à gauche, les rôles à droite. */
	@media (min-width: 1024px) {
		.colonnes {
			display: grid;
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			align-items: start;
			gap: var(--espace-32);
		}
	}
</style>
