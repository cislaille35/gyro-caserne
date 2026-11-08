<script lang="ts">
	import type { Prise, Ressource } from '@gyro-caserne/socle';
	import { untrack } from 'svelte';
	import { disponibilite } from '#lib/reservations.ts';
	import Bouton from '#lib/ui/Bouton.svelte';
	import Champ from '#lib/ui/Champ.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';

	let { data, form }: { data: { ressource: Ressource; prises: Prise[]; reserveCitoyenne: boolean; jour: string; aujourdhui: string; maintenant: string }; form?: { message?: string; valeurs?: Record<string, string> } | null } = $props();

	const r = $derived(data.ressource);
	const creneau = $derived(r.forme === 'creneau');
	// Valeurs de départ, prises une fois : celles renvoyées après un refus, sinon le jour choisi (de 9 h à 12 h pour un créneau).
	const depart = (nom: string, sinon: string) => untrack(() => form?.valeurs?.[nom] ?? sinon);
	const [jour, enCreneau] = untrack(() => [data.jour, data.ressource.forme === 'creneau'] as const);
	let debut = $state(depart('debut', enCreneau ? `${jour}T09:00` : jour));
	let fin = $state(depart('fin', enCreneau ? `${jour}T12:00` : jour));
	let quantite = $state(depart('quantite', '1'));
	// Lié comme les dates : un mot tapé avant que la page soit prête n'est pas effacé.
	let mot = $state(depart('mot', ''));
	const dispo = $derived(disponibilite(r, data.prises, { debut, fin, quantite: String(quantite) }, data.maintenant));
</script>

<svelte:head>
	<title>Réserver · {r.nom} · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<EnTetePage
		titre="Réserver · {r.nom}"
		phrase={creneau ? 'Choisissez le créneau. S’il est libre, la réservation est acceptée tout de suite.' : `Choisissez les jours et la quantité. ${r.gestionnaire.nom} accepte ou refuse votre demande.`}
		retour={{ href: `/reservations/${r.id}`, libelle: r.nom }}
	/>

	<div role="alert">
		{#if form?.message}<p class="echec">{form.message}</p>{/if}
	</div>

	<form method="POST" class="formulaire">
		{#if data.reserveCitoyenne}
			<fieldset>
				<legend>Pour qui ?</legend>
				<Champ id="reserver-nom" name="nom" libelle="Nom du demandeur" requis maxlength={60} autocomplete="off" valeur={depart('nom', '')} aide="La personne de la réserve citoyenne qui aura la VL." />
				<Champ id="reserver-telephone" name="telephone" type="tel" libelle="Téléphone (facultatif)" maxlength={20} autocomplete="off" valeur={depart('telephone', '')} aide="Vu seulement par qui gère la ressource." />
			</fieldset>
		{/if}
		<fieldset>
			<legend>{creneau ? 'Le créneau' : 'Les jours'}</legend>
			<div class="periode">
				<Champ id="reserver-debut" name="debut" type={creneau ? 'datetime-local' : 'date'} libelle={creneau ? 'Début' : 'Du'} requis bind:valeur={debut} />
				<Champ id="reserver-fin" name="fin" type={creneau ? 'datetime-local' : 'date'} libelle={creneau ? 'Fin' : 'Au (inclus)'} requis bind:valeur={fin} />
			</div>
			{#if !creneau}
				<Champ id="reserver-quantite" name="quantite" type="number" libelle="Quantité" requis aide="{r.stock} en stock." bind:valeur={quantite} />
			{/if}
			<p class="dispo ton-{dispo?.ton ?? 'neutre'}" role="status">{dispo?.texte ?? ''}</p>
		</fieldset>
		<div class="champ-mot">
			<label for="reserver-mot">Un mot (facultatif)</label>
			<textarea id="reserver-mot" name="mot" maxlength="200" rows="3" bind:value={mot}></textarea>
		</div>
		<Bouton type="submit">{creneau ? 'Réserver' : 'Demander'}</Bouton>
	</form>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
	}
	p {
		margin: 0;
	}
	.formulaire {
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
		max-width: 36rem;
		padding: var(--espace-16);
		background: var(--surface);
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
		border-radius: var(--rayon-grand);
	}
	.formulaire > :global(button) {
		align-self: flex-start;
	}
	fieldset {
		margin: 0;
		padding: 0;
		border: 0;
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
	}
	legend {
		padding: 0;
		margin-bottom: var(--espace-12);
		font: 700 var(--texte-18) var(--police-titre);
	}
	.periode {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--espace-16);
	}
	@media (min-width: 560px) {
		.periode {
			grid-template-columns: 1fr 1fr;
		}
	}
	.dispo:empty {
		display: none;
	}
	.dispo {
		padding: var(--espace-12) var(--espace-16);
		border-radius: var(--rayon-petit);
		border: 1px solid var(--statut-neutre-trait);
		font-weight: 600;
	}
	.ton-ok {
		background: var(--statut-ok-fond);
		color: var(--statut-ok-texte);
		border-color: var(--statut-ok-trait);
	}
	.ton-alerte {
		background: var(--statut-alerte-fond);
		color: var(--statut-alerte-texte);
		border-color: var(--statut-alerte-trait);
	}
	.ton-danger {
		background: var(--statut-danger-fond);
		color: var(--statut-danger-texte);
		border-color: var(--statut-danger-trait);
	}
	.champ-mot {
		display: flex;
		flex-direction: column;
		gap: var(--espace-6);
	}
	label {
		font-weight: 600;
	}
	textarea {
		padding: var(--espace-12) var(--espace-16);
		background: var(--surface);
		color: var(--encre);
		font: 400 var(--texte-16) var(--police);
		resize: vertical;
	}
	.echec {
		padding: var(--espace-12) var(--espace-16);
		border-radius: var(--rayon-petit);
		border: 2px solid var(--accent);
		font-weight: 600;
	}
</style>
