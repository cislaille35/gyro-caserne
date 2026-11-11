<script lang="ts">
	import ChoixRadio from '#lib/ui/ChoixRadio.svelte';
	import Choix from '#lib/ui/Choix.svelte';
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import type { SituationEngin } from '@gyro-caserne/socle';
	import Bouton from '#lib/ui/Bouton.svelte';
	import Champ from '#lib/ui/Champ.svelte';

	// Ajouter ou modifier un engin : nom, type, plaque, situation (prêté : par quel centre). « Parti » seulement pour un engin existant.
	type Valeurs = { nom: string; typeId: string; immatriculation: string; situation: SituationEngin; provenance: string };
	let { types, valeurs, existant, message, envoi }: { types: { id: number; nom: string }[]; valeurs: Valeurs; existant: boolean; message?: string; envoi: string } = $props();

	// Valeurs de départ (puis tapées) ; après un envoi refusé, la page les renvoie et le formulaire repart d'elles.
	let nom = $state(untrack(() => valeurs.nom));
	let immatriculation = $state(untrack(() => valeurs.immatriculation));
	let provenance = $state(untrack(() => valeurs.provenance));
	let situation = $state<SituationEngin>(untrack(() => valeurs.situation));
	const SITUATIONS: { valeur: SituationEngin; titre: string; texte: string }[] = $derived([
		{ valeur: 'centre', titre: 'Au centre', texte: 'Un engin du centre.' },
		{ valeur: 'prete', titre: 'Prêté au centre', texte: 'Prêté par un autre centre, le temps d’une réparation : il a sa fiche et sa prise de garde.' },
		...(existant ? [{ valeur: 'parti' as const, titre: 'Parti', texte: 'Il quitte le centre (rendu, réformé, réaffecté) : il sort de la liste, son historique reste.' }] : [])
	]);
</script>

<form method="POST" use:enhance class="formulaire">
	<Champ id="nom" name="nom" libelle="Nom" aide="Comme sur l’engin : « VSAV 1 », « FPT »." requis maxlength={30} bind:valeur={nom} />

	<Choix id="type" name="type" libelle="Type" aide="Le type porte la fiche de prise de garde." requis valeur={valeurs.typeId} options={types.map((t) => ({ valeur: String(t.id), libelle: t.nom }))} />

	<Champ id="immatriculation" name="immatriculation" libelle="Immatriculation (facultative)" maxlength={12} bind:valeur={immatriculation} />

	<ChoixRadio id="situation" legende="Situation" name="situation" disposition="rangees" bind:valeur={situation} options={SITUATIONS.map((s) => ({ valeur: s.valeur, libelle: s.titre, sous: s.texte }))} />

	{#if situation === 'prete'}
		<Champ id="provenance" name="provenance" libelle="Prêté par" aide="Le centre qui prête l’engin : « CIS Exemple-Nord »." requis maxlength={60} bind:valeur={provenance} />
	{/if}

	<div role="alert">{#if message}<p class="echec">{message}</p>{/if}</div>
	<div class="gestes"><Bouton type="submit">{envoi}</Bouton></div>
</form>

<style>
	.echec {
		margin: 0;
		padding: var(--espace-12) var(--espace-16);
		border-radius: var(--rayon-petit);
		border: 2px solid var(--accent);
		font-weight: 600;
	}
	.formulaire {
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
		padding: var(--espace-16);
		background: var(--surface);
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
		border-radius: var(--rayon-grand);
	}
	.gestes {
		display: flex;
	}
</style>
