<script lang="ts">
	import type { VueDemande } from '@gyro-caserne/socle';
	import { texteDemande } from '@gyro-caserne/socle';
	import { enhance } from '$app/forms';
	import Pastille from '../ui/Pastille.svelte';
	import { ETATS, majuscule, suite, titreDemande } from './textes.ts';

	// Une demande : qui, quoi, son état écrit, ce qui reste à faire, et les gestes permis à l'agent.
	// `detail` : le titre mène à sa page, et toute la demande avec (les gestes restent au-dessus). `ligne` : une ligne de la carte d'une liste.
	let { v, detail = true, niveau = 3, ligne = false }: { v: VueDemande; detail?: boolean; niveau?: 2 | 3; ligne?: boolean } = $props();
	const etat = $derived(ETATS[v.etat]);
	const quoi = $derived(
		v.genre === 'manoeuvre'
			? `Manœuvre « ${v.manoeuvre?.theme ?? ''} » contre « ${v.manoeuvreCible?.theme ?? ''} »`
			: v.genre === 'echange'
				? `${majuscule(texteDemande(v.periodes))}, contre ${texteDemande(v.periodesCible)}`
				: majuscule(v.texte)
	);
	const reste = $derived(suite(v));
	const qui = $derived(v.demandeur.prenom ? `${v.demandeur.prenom} ${v.demandeur.nom}` : v.demandeur.nom);
</script>

<article class="carte" class:ligne id="demande-{v.id}" aria-labelledby="demande-{v.id}-titre">
	<div class="haut">
		<svelte:element this={`h${niveau}`} id="demande-{v.id}-titre" class="titre"
			>{#if detail}<a class="etire" href="/remplacements/{v.id}">{titreDemande(v)}<span class="masque">{` : ${v.texte}`}</span></a>{:else}{titreDemande(v)}{/if}</svelte:element
		>
		<Pastille ton={etat.ton}>{etat.libelle}</Pastille>
	</div>
	<p class="quoi">{quoi}</p>
	{#if v.moi !== 'demandeur' && v.genre === 'remplacement'}<p class="doux">Astreinte de {qui}</p>{/if}
	{#if v.mot}<p class="mot">« {v.mot} »</p>{/if}
	{#if v.motif && v.etat !== 'conclue'}<p class="motif">Motif : {v.motif}</p>{/if}
	{#if reste}<p class="suite">{reste}</p>{/if}
	{#if v.gestes.accepter && v.manquePourMoi.length > 0}
		<p class="avertissement"><strong>Attention :</strong> il vous manque {v.manquePourMoi.join(', ')}. Si vous acceptez, le chef de garde devra valider.</p>
	{/if}

	{#if Object.values(v.gestes).some(Boolean)}
		<div class="gestes">
			{#if v.gestes.accepter}
				<form method="POST" action="?/accepter" use:enhance>
					<input type="hidden" name="id" value={v.id} />
					<button type="submit" class="bouton principal">Accepter<span class="masque">{` : ${titreDemande(v)}, ${v.texte}`}</span></button>
				</form>
			{/if}
			{#if v.gestes.refuser}
				<form method="POST" action="?/refuser" use:enhance>
					<input type="hidden" name="id" value={v.id} />
					<button type="submit" class="bouton secondaire">Refuser<span class="masque">{` : ${titreDemande(v)}, ${v.texte}`}</span></button>
				</form>
			{/if}
			{#if v.gestes.valider}
				<form method="POST" action="?/valider" use:enhance>
					<input type="hidden" name="id" value={v.id} />
					<button type="submit" class="bouton principal">Valider<span class="masque">{` : ${titreDemande(v)}, ${v.texte}`}</span></button>
				</form>
				<details class="plus">
					<summary class="bouton secondaire">Refuser<span class="masque">{` : ${titreDemande(v)}, ${v.texte}`}</span></summary>
					<form method="POST" action="?/refuserValidation" use:enhance>
						<input type="hidden" name="id" value={v.id} />
						<label for="motif-{v.id}">Motif (facultatif), envoyé aux deux agents</label>
						<textarea id="motif-{v.id}" name="motif" maxlength="200" rows="2"></textarea>
						<button type="submit" class="bouton danger">Refuser le remplacement</button>
					</form>
				</details>
			{/if}
			{#if v.gestes.ouvrir}
				<form method="POST" action="?/ouvrir" use:enhance>
					<input type="hidden" name="id" value={v.id} />
					<button type="submit" class="bouton principal">Ouvrir à tous<span class="masque">{` : ${v.texte}`}</span></button>
				</form>
			{/if}
			{#if v.gestes.desister}
				<form method="POST" action="?/desister" use:enhance>
					<input type="hidden" name="id" value={v.id} />
					<button type="submit" class="bouton secondaire">Me désister<span class="masque">{` : ${v.texte}`}</span></button>
				</form>
			{/if}
			{#if v.gestes.annuler}
				<form method="POST" action="?/annuler" use:enhance>
					<input type="hidden" name="id" value={v.id} />
					<button type="submit" class="bouton secondaire">Annuler la demande<span class="masque">{` : ${v.texte}`}</span></button>
				</form>
			{/if}
		</div>
	{/if}
</article>

<style>
	.carte {
		position: relative;
		isolation: isolate;
		display: flex;
		flex-direction: column;
		gap: var(--espace-6);
		padding: var(--espace-16) var(--espace-16);
		background: var(--surface);
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
		border-radius: var(--rayon-grand);
		overflow-wrap: anywhere;
	}
	/* Dans la carte d'une liste : une ligne, séparée des autres par un trait fin. */
	.ligne {
		border: 0;
		box-shadow: none;
		border-radius: 0;
		background: none;
	}
	@media (hover: hover) and (pointer: fine) {
		.ligne:has(.etire:hover) {
			background: color-mix(in srgb, var(--encre) 4%, var(--surface));
		}
	}
	a.etire {
		color: inherit;
		text-decoration: none;
	}
	@media (hover: hover) and (pointer: fine) {
		a.etire:hover {
			text-decoration: underline;
		}
	}
	/* Le lien du titre couvre toute la demande ; son repère du clavier aussi. */
	.etire::after {
		content: '';
		position: absolute;
		inset: 0;
	}
	.etire:focus-visible {
		outline: none;
	}
	.etire:focus-visible::after {
		outline: 3px solid var(--focus);
		outline-offset: -3px;
		border-radius: inherit;
	}
	/* Les gestes restent touchables, au-dessus du lien ; entre eux, le clic va à la demande. */
	.gestes {
		position: relative;
		z-index: 1;
		pointer-events: none;
	}
	.gestes > * {
		pointer-events: auto;
	}
	.haut {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--espace-8);
	}
	.titre {
		margin: 0;
		font: 700 var(--texte-18) var(--police-titre);
	}
	p {
		margin: 0;
	}
	.quoi {
		font-weight: 600;
	}
	.doux,
	.mot {
		color: var(--doux);
	}
	.motif {
		color: var(--statut-danger-texte);
		font-weight: 600;
	}
	.suite,
	.avertissement {
		padding: var(--espace-8) var(--espace-12);
		border-radius: var(--rayon-bouton);
		background: var(--statut-alerte-fond);
		color: var(--statut-alerte-texte);
		border: 1px solid var(--statut-alerte-trait);
	}
	.gestes {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: var(--espace-8);
		margin-top: var(--espace-6);
	}
	.bouton {
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		padding: 0 var(--espace-16);
		border-radius: var(--rayon-bouton);
		font: inherit;
		font-weight: 600;
		text-decoration: none;
		cursor: pointer;
	}
	.principal {
		border: 1px solid transparent;
		background: var(--rouge);
		color: var(--sur-rouge);
	}
	.secondaire {
		border: 1px solid var(--trait);
		background: var(--surface);
		color: var(--encre);
	}
	/* Un geste grave : contour et texte d'alerte, comme `Bouton variante="grave"`. */
	.danger {
		border: 1px solid var(--accent);
		background: var(--surface);
		color: var(--accent);
	}
	.plus {
		flex-basis: 100%;
	}
	.plus form {
		display: flex;
		flex-direction: column;
		gap: var(--espace-8);
		margin-top: var(--espace-12);
	}
	.plus form button {
		align-self: flex-start;
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
</style>
