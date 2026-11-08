<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import { activerPush, desactiverPush, etatPush } from '#lib/push.ts';
	import Carte from '#lib/ui/Carte.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
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
</script>

<svelte:head>
	<title>Notifications · Moi · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<EnTetePage titre="Notifications" phrase="Ce qui sonne sur votre téléphone." retour={{ href: '/moi', libelle: 'Moi' }} />

	<p class="masque" role="status">{form?.succes ?? ''}</p>
	<p class="erreur" class:masque={!form?.message} role="alert">{form?.message ?? ''}</p>

	<Carte titre="Ce téléphone">
		<CeTelephone etat={data.clePublique ? etat : 'sans-cles'} appareils={data.appareils} {echec} {activer} {desactiver} />
	</Carte>

	<Carte titre="Tout couper">
		<form method="POST" action="?/toutCouper" use:enhance class="interrupteur">
			<p id="aide-tout">Plus rien ne sonne, sur aucun appareil. La cloche de l’appli montre toujours tout.</p>
			<button type="submit" role="switch" aria-checked={data.tout ? 'true' : 'false'} name="oui" value={data.tout ? '0' : '1'} aria-describedby="aide-tout">
				<span class="glissiere" aria-hidden="true"><span class="bouton-rond"></span></span>
				<span>Tout couper au téléphone</span>
			</button>
		</form>
	</Carte>

	<Carte titre="Coupés">
		{#if data.coupes.length === 0}
			<p class="doux">Rien n’est coupé. Pour couper un mur ou une conversation, touchez le haut-parleur dans son en-tête.</p>
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
		max-width: 40rem;
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
	.interrupteur {
		display: flex;
		flex-direction: column;
		gap: var(--espace-12);
	}
	.interrupteur p {
		margin: 0;
	}
	[role='switch'] {
		align-self: flex-start;
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		gap: var(--espace-12);
		padding: 0 var(--espace-16) 0 var(--espace-6);
		border: 1px solid var(--trait);
		border-radius: 999px;
		background: var(--surface);
		color: var(--encre);
		font: 600 var(--texte-16) var(--police);
		cursor: pointer;
	}
	.glissiere {
		position: relative;
		width: 44px;
		height: 26px;
		border-radius: 999px;
		background: var(--doux);
		transition: background var(--duree-etat) var(--courbe-sortie);
	}
	.bouton-rond {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--surface);
		box-shadow: 0 1px 2px color-mix(in srgb, #000 30%, transparent);
		transition: transform var(--duree-etat) var(--courbe-sortie);
	}
	[aria-checked='true'] .glissiere {
		background: var(--accent);
	}
	[aria-checked='true'] .bouton-rond {
		transform: translateX(18px);
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
		.reactiver:hover,
		[role='switch']:hover {
			border-color: var(--encre);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.glissiere,
		.bouton-rond {
			transition: none;
		}
	}
</style>
