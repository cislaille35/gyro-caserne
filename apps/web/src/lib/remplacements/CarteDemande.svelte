<script lang="ts">
	import type { VueDemande } from '@gyro-caserne/socle';
	import { texteDemande } from '@gyro-caserne/socle';
	import { enhance } from '$app/forms';
	import Pastille from '../ui/Pastille.svelte';
	import { ETATS, majuscule, suite, titreDemande } from './textes.ts';

	// Une demande : qui, quoi, son état écrit, ce qui reste à faire, et les gestes permis à l'agent. `detail` : un lien vers sa page.
	let { v, detail = true, niveau = 3 }: { v: VueDemande; detail?: boolean; niveau?: 2 | 3 } = $props();
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

<article class="carte" id="demande-{v.id}" aria-labelledby="demande-{v.id}-titre">
	<div class="haut">
		<svelte:element this={`h${niveau}`} id="demande-{v.id}-titre" class="titre">{titreDemande(v)}</svelte:element>
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

	{#if Object.values(v.gestes).some(Boolean) || detail}
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
			{#if detail}<a class="bouton lien" href="/remplacements/{v.id}">Détails<span class="masque">{` : ${titreDemande(v)}, ${v.texte}`}</span></a>{/if}
		</div>
	{/if}
</article>

<style>
	.carte {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 14px 16px;
		background: var(--surface);
		border: 1px solid var(--trait-doux);
		border-radius: var(--rayon-grand);
		overflow-wrap: anywhere;
	}
	.haut {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 8px;
	}
	.titre {
		margin: 0;
		font: 700 1.1875rem var(--police-titre);
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
		padding: 8px 12px;
		border-radius: 12px;
		background: var(--statut-alerte-fond);
		color: var(--statut-alerte-texte);
		border: 1px solid var(--statut-alerte-trait);
	}
	.gestes {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 8px;
		margin-top: 6px;
	}
	.bouton {
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		padding: 0 18px;
		border-radius: 999px;
		font: inherit;
		font-weight: 600;
		text-decoration: none;
		cursor: pointer;
	}
	.principal {
		border: 2px solid var(--encre);
		background: var(--rouge);
		color: var(--sur-rouge);
	}
	.secondaire,
	.lien {
		border: 1px solid var(--trait);
		background: var(--surface);
		color: var(--encre);
	}
	.danger {
		border: 0;
		background: var(--rouge);
		color: var(--sur-rouge);
	}
	.plus {
		flex-basis: 100%;
	}
	.plus summary {
		list-style: none;
		display: inline-flex;
	}
	.plus summary::-webkit-details-marker {
		display: none;
	}
	.plus form {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-top: 10px;
	}
	.plus form button {
		align-self: flex-start;
	}
	label {
		font-weight: 600;
	}
	textarea {
		padding: 10px 14px;
		border: 2px solid var(--doux);
		border-radius: var(--rayon-petit);
		background: var(--surface);
		color: var(--encre);
		font: 400 1rem var(--police);
		resize: vertical;
	}
</style>
