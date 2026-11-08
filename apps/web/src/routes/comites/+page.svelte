<script lang="ts">
	import { murDuComite } from '#lib/murs/phrases.ts';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import ListeRangees from '#lib/ui/ListeRangees.svelte';
	import Rangee from '#lib/ui/Rangee.svelte';
	import type { IconeRole as NomIcone } from '#lib/ui/icones-roles.ts';

	let { data } = $props();

	type Titulaire = { id: number; nom: string; ecrire: boolean };
	const PERSONNE = 'Personne pour l’instant';
	const qui = (titulaires: Titulaire[]) => (titulaires.length > 0 ? titulaires.map((t) => t.nom).join(', ') : PERSONNE);
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

<!-- Un titulaire : « Écrire » à droite ; plusieurs : un « Écrire à … » par titulaire, sous les noms. -->
{#snippet role(titre: string, titulaires: Titulaire[], icone?: NomIcone)}
	{@const ecrits = titulaires.filter((t) => t.ecrire)}
	<li>
		{#if titulaires.length > 1 && ecrits.length > 0}
			<Rangee {icone} {titre} sous={qui(titulaires)}>
				{#each ecrits as t (t.id)}{@render ecrire(t, true)}{/each}
			</Rangee>
		{:else}
			<Rangee {icone} {titre} sous={qui(titulaires)}>
				{#snippet droite()}{#if ecrits[0]}{@render ecrire(ecrits[0])}{/if}{/snippet}
			</Rangee>
		{/if}
	</li>
{/snippet}

<div class="page">
	<EnTetePage titre="Comités et référents">
		{#snippet secondaire()}
			{#if gerer}<a class="lien-secondaire" href={gerer.href}>Gérer<span class="masque">{` ${gerer.quoi}`}</span></a>{/if}
		{/snippet}
	</EnTetePage>

	<div class="colonnes">
		<section class="colonne" aria-labelledby="titre-comites">
			<h2 id="titre-comites" class="titre-section">Comités</h2>
			{#each data.comites as c (c.id)}
				<ListeRangees titre={c.nom} compte={c.membres.length} niveau={3}>
					{#each c.membres as m (m.id)}
						<li>
							<Rangee titre={m.nom} sous={m.roles.join(', ')}>
								{#snippet droite()}{#if m.ecrire}{@render ecrire(m)}{/if}{/snippet}
							</Rangee>
						</li>
					{:else}
						<li><Rangee titre="Aucun membre pour l’instant" discret /></li>
					{/each}
					{#if c.mur}
						<li><Rangee href="/echanges/comite:{c.id}" icone={c.icone} titre={murDuComite(c.nom)} /></li>
					{/if}
					{#each c.ressources as r (r.id)}
						<li><Rangee href="/reservations/{r.id}" icone={r.icone} titre={r.nom} sous="Calendrier des réservations" /></li>
					{/each}
				</ListeRangees>
			{:else}
				<ul role="list" class="lignes"><li><Rangee titre="Aucun comité pour l’instant" discret /></li></ul>
			{/each}
		</section>

		<section class="colonne" aria-labelledby="titre-roles">
			<h2 id="titre-roles" class="titre-section">Référents et rôles</h2>
			{#if data.commandement.length > 0}
				<ListeRangees titre="Chef de centre et adjoint" niveau={3}>
					{#each data.commandement as r (r.id)}{@render role(r.nom, r.titulaires)}{/each}
				</ListeRangees>
			{/if}
			{#each data.equipes as r (r.id)}
				{#if r.parEquipe.length > 0}
					<ListeRangees titre={r.systeme === 'chef_equipe' ? 'Chefs de garde' : r.nom} niveau={3}>
						{#each r.parEquipe as e (e.equipe)}{@render role(e.equipe, e.titulaires)}{/each}
					</ListeRangees>
				{/if}
			{/each}
			{#if data.referents.length > 0}
				<ListeRangees titre="Référents" compte={data.referents.length} niveau={3}>
					{#each data.referents as r (r.id)}{@render role(r.nom, r.titulaires, r.icone)}{/each}
				</ListeRangees>
			{/if}
		</section>
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
