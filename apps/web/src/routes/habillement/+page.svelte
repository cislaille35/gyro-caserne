<script lang="ts">
	import { enhance } from '$app/forms';
	import { extraitDemande, LIMITE_HABILLEMENT, type DemandeListee } from '@gyro-caserne/socle';
	import { dateCourte } from '#lib/engins/textes.ts';
	import { etatDemande } from '#lib/habillement.ts';
	import Bouton from '#lib/ui/Bouton.svelte';
	import Carte from '#lib/ui/Carte.svelte';
	import Champ from '#lib/ui/Champ.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import ListeRangees from '#lib/ui/ListeRangees.svelte';
	import Pastille from '#lib/ui/Pastille.svelte';
	import Rangee from '#lib/ui/Rangee.svelte';
	import Vide from '#lib/ui/Vide.svelte';

	let { data, form }: { data: { enCours: DemandeListee[]; terminees: DemandeListee[]; gere: boolean }; form: { texte?: string; message?: string } | null } = $props();
	let envoi = $state(false);
	const quand = (d: DemandeListee) => (d.finLe ? `Finie le ${dateCourte(d.finLe)}` : `Demandée le ${dateCourte(d.creeLe)}`);
</script>

<svelte:head>
	<title>Habillement · Gyro Caserne</title>
</svelte:head>

{#snippet ligne(d: DemandeListee)}
	<li>
		<Rangee href="/habillement/{d.id}" titre={extraitDemande(d.texte)} sous={quand(d)}>
			{#snippet droite()}<Pastille ton={etatDemande(d).ton}>{etatDemande(d).texte}</Pastille>{/snippet}
		</Rangee>
	</li>
{/snippet}

<div class="page">
	<EnTetePage titre="Habillement" retour={{ href: '/caserne', libelle: 'Caserne' }}>
		{#snippet secondaire()}{#if data.gere}<a class="lien-secondaire" href="/habillement/toutes">Toutes les demandes</a>{/if}{/snippet}
	</EnTetePage>

	<div class="colonnes">
		<Carte titre="Faire une demande">
			<form
				method="POST"
				use:enhance={() => {
					envoi = true;
					return async ({ update }) => {
						await update();
						envoi = false;
					};
				}}
			>
				<Champ id="texte" name="texte" libelle="Votre demande" lignes={4} requis maxlength={LIMITE_HABILLEMENT} valeur={form?.texte ?? ''} aide="Quelle pièce, quelle taille, pourquoi ? (ex. : veste textile en L, la mienne est déchirée)" erreur={form?.message} />
				<div><Bouton type="submit" desactive={envoi}>Envoyer la demande</Bouton></div>
			</form>
		</Carte>

		<div class="listes">
			{#if data.enCours.length === 0 && data.terminees.length === 0}
				<Vide titre="Aucune demande" texte="Vos demandes de tenue et leur suivi s’afficheront ici." />
			{:else}
				{#if data.enCours.length}
					<ListeRangees titre="Mes demandes en cours" compte={data.enCours.length}>
						{#each data.enCours as d (d.id)}{@render ligne(d)}{/each}
					</ListeRangees>
				{/if}
				{#if data.terminees.length}
					<ListeRangees titre="Terminées">
						{#each data.terminees as d (d.id)}{@render ligne(d)}{/each}
					</ListeRangees>
				{/if}
			{/if}
		</div>
	</div>
</div>

<style>
	.page,
	.colonnes,
	.listes,
	form {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}
	form {
		gap: 14px;
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
