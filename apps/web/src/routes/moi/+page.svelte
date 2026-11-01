<script lang="ts">
	import { DESSINS } from '#lib/ui/icones-roles.ts';
	import { oublierBrouillons } from '#lib/messagerie/fil.ts';
	import { oublierCetAppareil } from '#lib/push.ts';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import IconeRole from '#lib/ui/IconeRole.svelte';
	import ListeRangees from '#lib/ui/ListeRangees.svelte';
	import Rangee from '#lib/ui/Rangee.svelte';
	import Visage from '#lib/ui/Visage.svelte';

	let { data } = $props();
	const CALENDRIER = 'M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4';

	const id = $derived(data.identite);
	// En partant, ni les brouillons ni les notifications de ce compte ne restent sur l'appareil (il peut être partagé).
	let partir = false;
	async function deconnecter(e: SubmitEvent & { currentTarget: HTMLFormElement }) {
		oublierBrouillons();
		if (partir) return;
		e.preventDefault();
		const formulaire = e.currentTarget;
		await oublierCetAppareil().catch(() => {});
		partir = true;
		formulaire.requestSubmit();
	}

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
				{#if details || id.role}<p class="doux">{details || id.role}</p>{/if}
				{#if data.aptitudes?.length}
					<p class="aptitudes">Aptitudes : {data.aptitudes.map((a) => (a.valide ? a.nom : `${a.nom} (pas valable aujourd’hui)`)).join(', ')}</p>
				{/if}
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
			<li><Rangee href="/moi/agenda" titre="Ajouter à mon agenda" sous="Mes astreintes et manœuvres dans l’agenda du téléphone" icone="camion" dessin={CALENDRIER} /></li>
			<li><Rangee href="/moi/notifications" titre="Notifications" sous="Ce téléphone, ce qui est coupé" icone="etoile" dessin={DESSINS.cloche} /></li>
		{/if}
		<li><Rangee href="/affichage" titre="Affichage" sous="Thème et niveau de vie de l’appli" icone="cle" dessin={DESSINS.affichage} /></li>
	</ListeRangees>

	<form method="POST" action="?/deconnecter" onsubmit={deconnecter}>
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
	.aptitudes {
		margin-top: 4px !important;
		font-size: 0.9375rem;
		font-weight: 600;
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
