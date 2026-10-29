<script lang="ts">
	import { oublierBrouillons } from '#lib/messagerie/fil.ts';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import IconeRole from '#lib/ui/IconeRole.svelte';
	import ListeRangees from '#lib/ui/ListeRangees.svelte';
	import Rangee from '#lib/ui/Rangee.svelte';
	import Visage from '#lib/ui/Visage.svelte';

	let { data } = $props();

	const DESSINS = {
		profil: 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1',
		affichage: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.5 1.5 M17.5 17.5 19 19 M5 19l1.5-1.5 M17.5 6.5 19 5',
		sortir: 'M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4 M10 17l5-5-5-5 M15 12H3'
	};
	const id = $derived(data.identite);
	const details = $derived(id ? [id.grade, id.equipe?.nom].filter(Boolean).join(' · ') : '');
</script>

<svelte:head>
	<title>Moi · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<EnTetePage titre="Moi" phrase="Votre compte et vos réglages." />

	<section class="carte" aria-label="Mon identité" style:--teinte={id?.equipe?.couleur ?? null}>
		{#if id}
			<Visage prenom={id.prenom} nom={id.nom} couleur={id.equipe?.couleur ?? null} taille={52} />
			<div class="qui">
				<p class="nom">{id.prenom} {id.nom}</p>
				<p class="doux">{details || 'Agent du centre'}</p>
			</div>
		{:else if !data.estPersonne}
			<IconeRole icone="cle" taille={52} />
			<div class="qui">
				<p class="nom">Super administrateur</p>
				<p class="doux">Tout le centre, sans fiche d’agent.</p>
			</div>
		{:else}
			<IconeRole icone="groupe" dessin={DESSINS.profil} taille={52} />
			<div class="qui"><p class="nom">Mon compte</p></div>
		{/if}
	</section>

	<ListeRangees>
		<!-- Le super administrateur n'a pas de fiche : pas de « Mon profil ». -->
		{#if data.estPersonne}
			<li><Rangee href="/profil" titre="Mon profil" sous="Surnom, téléphone, contact d’urgence" icone="livre" dessin={DESSINS.profil} /></li>
		{/if}
		<li><Rangee href="/affichage" titre="Affichage" sous="Thème et niveau de vie de l’appli" icone="cle" dessin={DESSINS.affichage} /></li>
	</ListeRangees>

	<!-- En partant, les brouillons de messages ne restent pas sur l'appareil pour le compte suivant. -->
	<form method="POST" action="?/deconnecter" onsubmit={oublierBrouillons}>
		<button type="submit" class="sortir"
			><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d={DESSINS.sortir} /></svg>Se déconnecter</button
		>
	</form>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 20px;
		max-width: 40rem;
	}
	.carte {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 18px;
		border: 1px solid var(--trait-doux);
		border-radius: 20px;
		background: var(--surface);
		/* Un liseré à la couleur de l'équipe, quand il y en a une. */
		box-shadow: inset 0 4px 0 var(--teinte, transparent);
	}
	.qui {
		min-width: 0;
	}
	.qui p {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.nom {
		font: 700 1.5rem/1.15 var(--police-titre);
	}
	form {
		display: flex;
		justify-content: center;
		margin-top: 8px;
	}
	.sortir {
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 0 16px;
		border: 0;
		border-radius: 999px;
		background: none;
		color: var(--accent);
		font: 600 1rem var(--police);
		cursor: pointer;
	}
	.sortir:hover {
		background: var(--statut-danger-fond);
		text-decoration: underline;
	}
</style>
