<script lang="ts">
	import { murDuComite } from '#lib/murs/phrases.ts';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import ListeRangees from '#lib/ui/ListeRangees.svelte';
	import Rangee from '#lib/ui/Rangee.svelte';

	let { data } = $props();

	const PERSONNE = 'Personne pour l’instant';
	const qui = (titulaires: string[]) => (titulaires.length > 0 ? titulaires.join(', ') : PERSONNE);
	// Nommer est ce qui change le plus souvent ; à défaut, les réglages (comités, rôles).
	const gerer = $derived(data.peutNominations ? { href: '/nominations', quoi: 'les nominations' } : data.peutReglages ? { href: '/reglages', quoi: 'les réglages du centre' } : null);
</script>

<svelte:head>
	<title>Comités et référents · Gyro Caserne</title>
</svelte:head>

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
						<li><Rangee titre={m.nom} sous={m.roles.join(', ')} /></li>
					{:else}
						<li><Rangee titre="Aucun membre pour l’instant" discret /></li>
					{/each}
					{#if c.mur}
						<li><Rangee href="/echanges/comite:{c.id}" icone={c.icone} titre={murDuComite(c.nom)} /></li>
					{/if}
					{#each c.ressources as r (r.id)}
						<li>
							{#if r.lien}
								<Rangee href="/reservations/{r.id}" icone={r.icone} titre={r.nom} sous="Matériel à réserver" />
							{:else}
								<Rangee icone={r.icone} titre={r.nom} sous="Matériel du comité" />
							{/if}
						</li>
					{/each}
				</ListeRangees>
			{/each}
		</section>

		<section class="colonne" aria-labelledby="titre-roles">
			<h2 id="titre-roles" class="titre-section">Référents et rôles</h2>
			{#if data.commandement.length > 0}
				<ListeRangees titre="Chef de centre et adjoint" niveau={3}>
					{#each data.commandement as r (r.id)}<li><Rangee titre={r.nom} sous={qui(r.titulaires)} /></li>{/each}
				</ListeRangees>
			{/if}
			{#each data.equipes as r (r.id)}
				{#if r.parEquipe.length > 0}
					<ListeRangees titre={r.systeme === 'chef_equipe' ? 'Chefs de garde' : r.nom} niveau={3}>
						{#each r.parEquipe as e (e.equipe)}<li><Rangee titre={e.equipe} sous={qui(e.titulaires)} /></li>{/each}
					</ListeRangees>
				{/if}
			{/each}
			{#if data.referents.length > 0}
				<ListeRangees titre="Référents" compte={data.referents.length} niveau={3}>
					{#each data.referents as r (r.id)}<li><Rangee icone={r.icone} titre={r.nom} sous={qui(r.titulaires)} /></li>{/each}
				</ListeRangees>
			{/if}
		</section>
	</div>
</div>

<style>
	.page,
	.colonne {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}
	.colonnes {
		display: flex;
		flex-direction: column;
		gap: 32px;
	}
	.titre-section {
		margin: 0;
		font: 700 1.375rem/1.2 var(--police-titre);
	}
	/* À l'ordinateur, les comités à gauche, les rôles à droite. */
	@media (min-width: 1024px) {
		.colonnes {
			display: grid;
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			align-items: start;
			gap: 28px;
		}
	}
</style>
