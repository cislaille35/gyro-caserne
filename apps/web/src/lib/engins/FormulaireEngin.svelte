<script lang="ts">
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

	<div class="champ">
		<label for="type">Type</label>
		<p id="type-aide" class="aide">Le type porte la fiche de prise de garde.</p>
		<select id="type" name="type" aria-describedby="type-aide" required>
			{#each types as t (t.id)}<option value={String(t.id)} selected={String(t.id) === valeurs.typeId}>{t.nom}</option>{/each}
		</select>
	</div>

	<Champ id="immatriculation" name="immatriculation" libelle="Immatriculation (facultative)" maxlength={12} bind:valeur={immatriculation} />

	<fieldset>
		<legend>Situation</legend>
		{#each SITUATIONS as s (s.valeur)}
			<label class="choix">
				<input type="radio" name="situation" value={s.valeur} bind:group={situation} />
				<span><strong>{s.titre}</strong><span class="aide">{s.texte}</span></span>
			</label>
		{/each}
	</fieldset>

	{#if situation === 'prete'}
		<Champ id="provenance" name="provenance" libelle="Prêté par" aide="Le centre qui prête l’engin : « CIS Exemple-Nord »." requis maxlength={60} bind:valeur={provenance} />
	{/if}

	<div role="alert">{#if message}<p class="echec">{message}</p>{/if}</div>
	<div class="gestes"><Bouton type="submit">{envoi}</Bouton></div>
</form>

<style>
	.formulaire {
		display: flex;
		flex-direction: column;
		gap: 18px;
		padding: 16px;
		background: var(--surface);
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
		border-radius: var(--rayon-grand);
	}
	.champ,
	fieldset {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	fieldset {
		margin: 0;
		padding: 0;
		border: 0;
		gap: 8px;
	}
	label,
	legend {
		font-weight: 600;
	}
	legend {
		padding: 0;
		margin-bottom: 6px;
	}
	select {
		min-height: var(--cible);
		padding: 0 12px;
		border: 2px solid var(--doux);
		border-radius: var(--rayon-petit);
		background: var(--surface);
		color: var(--encre);
		font: inherit;
	}
	.aide {
		margin: 0;
		color: var(--doux);
		font-weight: 400;
	}
	.choix {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		min-height: var(--cible);
		padding: 10px 12px;
		border: 1px solid var(--trait-doux);
		border-radius: var(--rayon-petit);
		cursor: pointer;
	}
	.choix:has(input:checked) {
		border: 2px solid var(--encre);
	}
	.choix input {
		width: 22px;
		height: 22px;
		margin: 2px 0 0;
		flex: none;
		accent-color: var(--encre);
	}
	.choix span {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.echec {
		margin: 0;
		padding: 12px 16px;
		border-radius: var(--rayon-petit);
		border: 2px solid var(--accent);
		font-weight: 600;
	}
	.gestes {
		display: flex;
	}
</style>
