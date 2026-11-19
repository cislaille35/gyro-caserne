<script lang="ts">
	import { untrack } from 'svelte';
	import { heure } from '#lib/murs/quand.ts';
	import { jourLong } from '#lib/planning/dates.ts';
	import Bouton from '#lib/ui/Bouton.svelte';
	import Champ from '#lib/ui/Champ.svelte';
	import Choix from '#lib/ui/Choix.svelte';
	import ChoixRadio from '#lib/ui/ChoixRadio.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import Vide from '#lib/ui/Vide.svelte';

	let { data, form } = $props();
	// Le jour du premier début possible ; un début du lendemain (fin de nuit) le dit.
	const jour = $derived(data.debuts[0]?.debut.slice(0, 10) ?? '');
	const libelle = (d: string) => (d.slice(0, 10) === jour ? heure(d) : `${heure(d)}, ${jourLong(d)}`);
	const options = $derived(data.debuts.map((d) => ({ valeur: d.debut, libelle: libelle(d.debut) })));
	// Le premier début proposé, choisi d'office ; ensuite, celui de l'agent.
	let debut = $state(untrack(() => data.debuts[0]?.debut ?? ''));
	let duree = $state('2');
	const max = $derived(data.debuts.find((d) => d.debut === debut)?.max ?? 2);
	// Trois heures ne tiennent pas avant la fin de l'astreinte : on revient à deux.
	$effect(() => {
		if (max === 2) duree = '2';
	});
	const durees = $derived([{ valeur: '2', libelle: '2 h' }, ...(max === 3 ? [{ valeur: '3', libelle: '3 h' }] : [])]);
	const fin = $derived(debut ? new Date(Date.parse(`${debut}:00Z`) + Number(duree) * 3_600_000).toISOString().slice(0, 16) : '');
	const recap = $derived(debut ? `Remplacement de ${heure(debut)} à ${heure(fin)}${debut.slice(0, 10) === jour ? '' : `, ${jourLong(debut)}`}, ouvert à tous les disponibles.` : '');
</script>

<svelte:head>
	<title>Quelques heures · Me faire remplacer · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<EnTetePage titre="Quelques heures" phrase="2 ou 3 h de votre astreinte du jour. Le premier collègue qui accepte vous remplace." retour={{ href: '/remplacements/demander', libelle: 'Me faire remplacer' }} />

	{#if data.debuts.length === 0}
		<Vide titre="Pas d’astreinte aujourd’hui." texte="Quelques heures se demandent le jour même, pendant votre astreinte ou avant qu’elle commence." action={{ href: '/remplacements/demander', libelle: 'Choisir des jours' }} gyro={false} />
	{:else}
		<p class="erreur" class:masque={!form?.message} role="alert">{form?.message ?? ''}</p>
		<form method="POST" class="carte">
			<Choix id="debut" libelle="Début" name="debut" {options} bind:valeur={debut} requis />
			<ChoixRadio id="duree" legende="Durée" name="duree" options={durees} bind:valeur={duree} />
			<p class="recap" aria-live="polite">{recap}</p>
			<Champ id="mot" name="mot" libelle="Un mot pour vos collègues (facultatif)" maxlength={200} lignes={2} />
			<div><Bouton type="submit">Envoyer la demande</Bouton></div>
		</form>
		<p class="doux">S’il manque au remplaçant une de vos aptitudes contrôlées, votre chef de garde est prévenu et peut refuser jusqu’au début.</p>
	{/if}
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
		max-width: var(--largeur-lecture);
		margin-inline: auto;
	}
	p {
		margin: 0;
	}
	.carte {
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
		padding: var(--espace-16);
		background: var(--surface);
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
		border-radius: var(--rayon-grand);
	}
	.recap {
		font-weight: 700;
	}
	.doux {
		color: var(--doux);
	}
	.erreur {
		padding: var(--espace-12) var(--espace-16);
		border-radius: var(--rayon-grand);
		font-weight: 600;
		background: var(--statut-danger-fond);
		color: var(--statut-danger-texte);
		border: 1px solid var(--statut-danger-trait);
	}
</style>
