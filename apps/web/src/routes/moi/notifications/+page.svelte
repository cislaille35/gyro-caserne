<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import { activerPush, desactiverPush, etatPush } from '#lib/push.ts';
	import Carte from '#lib/ui/Carte.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import Interrupteur from '#lib/ui/Interrupteur.svelte';
	import CeTelephone, { type EtatTelephone } from './CeTelephone.svelte';

	let { data, form } = $props();

	let etat = $state<EtatTelephone>('verification');
	let echec = $state(false);
	onMount(() => {
		if (!data.clePublique) etat = 'sans-cles';
		else etatPush(data.clePublique).then((e) => (etat = e)).catch(() => (etat = 'indisponible'));
	});

	async function changer(faire: () => Promise<EtatTelephone>) {
		const avant = etat;
		etat = 'en-cours';
		echec = false;
		try {
			etat = await faire();
			echec = etat === 'inactif';
		} catch {
			etat = avant;
			echec = true;
		}
		await invalidateAll();
	}
	const activer = () => changer(() => activerPush(data.clePublique!));
	const desactiver = () => changer(desactiverPush);
	// La case garde sa position après l'envoi : la page relue la confirme.
	const garder = () => ({ update }: { update: (o: { reset: boolean }) => Promise<void> }) => update({ reset: false });
</script>

<svelte:head>
	<title>Notifications · Moi · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<EnTetePage titre="Notifications" phrase="Ce qui sonne sur votre téléphone." retour={{ href: '/moi', libelle: 'Moi' }} />

	<p class="masque" role="status">{form?.succes ?? ''}</p>
	<p class="erreur" class:masque={!form?.message} role="alert">{form?.message ?? ''}</p>

	{#if data.urgences !== null && data.urgences !== undefined}
		<!-- Le chef de centre et l'adjoint : en premier, ce qui sonne à toute heure. -->
		<Carte titre="Urgences du centre">
			<form method="POST" action="?/urgences" use:enhance={garder}>
				<Interrupteur libelle="Recevoir les urgences" description="Un engin indisponible, un remplacement sans remplaçant la veille, une équipe sans chef de garde la veille de sa relève : votre téléphone sonne, à toute heure." nom="oui" coche={data.urgences} envoyer />
			</form>
		</Carte>
	{/if}

	<Carte titre="Ce téléphone">
		<CeTelephone etat={data.clePublique ? etat : 'sans-cles'} appareils={data.appareils} {echec} {activer} {desactiver} />
	</Carte>

	{#if data.courriel !== null && data.courriel !== undefined}
		<Carte titre="Par e-mail">
			<form method="POST" action="?/courriel" use:enhance={garder}>
				<Interrupteur libelle="Recevoir les demandes par e-mail" description="Une nouvelle demande adressée à vos rôles (habillement, anomalie, réservation à valider) arrive aussi dans votre boîte. La suite reste dans l’appli." nom="oui" coche={data.courriel} envoyer />
			</form>
		</Carte>
	{/if}

	<Carte titre="Tout couper">
		<form method="POST" action="?/toutCouper" use:enhance={garder}>
			<Interrupteur libelle="Tout couper au téléphone" description="Plus rien ne sonne, sur aucun appareil. La cloche de l’appli montre toujours tout." nom="oui" coche={data.tout} envoyer />
			{#if data.tout && data.urgences !== null && data.urgences !== undefined}<p class="avertissement">Vous ne recevrez plus les urgences du centre (engin indisponible…).</p>{/if}
		</form>
	</Carte>

	<Carte titre="Coupés">
		{#if data.coupes.length === 0}
			<p class="doux">Rien n’est coupé. Pour couper un mur ou une conversation, appuyez sur le haut-parleur dans son en-tête.</p>
		{:else}
			<ul role="list">
				{#each data.coupes as c (c.lieu)}
					<li>
						<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
							><path d="M6 16v-5a6 6 0 0 1 9.5-4.9 M18 10.5V16l2 2H8 M10 20a2 2 0 0 0 4 0 M3 3l18 18" /></svg
						>
						<span class="nom">{c.nom}</span>
						<form method="POST" action="?/reactiver" use:enhance>
							<input type="hidden" name="lieu" value={c.lieu} />
							<button type="submit" class="reactiver">Réactiver<span class="masque">{` ${c.nom}`}</span></button>
						</form>
					</li>
				{/each}
			</ul>
		{/if}
	</Carte>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--espace-20);
		max-width: var(--largeur-lecture);
		margin-inline: auto;
	}
	.doux {
		margin: 0;
		color: var(--doux);
	}
	.erreur {
		margin: 0;
		padding: var(--espace-12) var(--espace-16);
		border: 1px solid var(--statut-danger-trait);
		border-radius: var(--rayon-grand);
		background: var(--statut-danger-fond);
		color: var(--statut-danger-texte);
		font-weight: 600;
	}
	.avertissement {
		margin: var(--espace-8) 0 0;
		font-weight: 600;
		color: var(--statut-alerte-texte);
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
	}
	li {
		display: flex;
		align-items: center;
		gap: var(--espace-12);
		min-height: 56px;
		border-top: 1px solid var(--trait-doux);
	}
	li:first-child {
		border-top: 0;
	}
	li svg {
		flex: none;
		color: var(--doux);
	}
	.nom {
		flex: 1;
		min-width: 0;
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.reactiver {
		min-height: var(--cible);
		padding: 0 var(--espace-16);
		border: 1px solid var(--trait);
		border-radius: var(--rayon-bouton);
		background: var(--surface);
		color: var(--encre);
		font: 600 var(--texte-16) var(--police);
		cursor: pointer;
	}
	@media (hover: hover) and (pointer: fine) {
		.reactiver:hover {
			border-color: var(--encre);
		}
	}
</style>
