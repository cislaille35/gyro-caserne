<script lang="ts">
	import { pluriel } from '#lib/pluriel.ts';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import { iconeDuComite } from '@gyro-caserne/socle';
	import Bouton from '#lib/ui/Bouton.svelte';
	import Champ from '#lib/ui/Champ.svelte';
	import IconeRole from '#lib/ui/IconeRole.svelte';
	import Pastille from '#lib/ui/Pastille.svelte';
	import ChoixIcone from '../../ChoixIcone.svelte';

	let { data, form } = $props();

	const c = $derived(data.comite);
	const concerne = (cible: string) => form?.cible === cible;
	// Un bloc s'ouvre seulement s'il est visé ; sinon aucun attribut open n'est posé, et l'hydratation ne referme pas ce que l'agent a ouvert.
	const ouvert = (cible: string) => (concerne(cible) && !form?.succes ? { open: true } : {});
	const erreurs = (cible: string): Record<string, string> => (concerne(cible) ? (form?.erreurs ?? {}) : {});
	const saisie = (champ: 'nom' | 'theme', defaut: string) => (concerne('comite') ? (form?.valeurs?.[champ] ?? defaut) : defaut);
	const iconeSaisie = $derived((concerne('comite') ? form?.valeurs?.icone : undefined) as ReturnType<typeof iconeDuComite> | undefined);

	const SUITE = 'les nominations à venir sont annulées. Les responsabilités qu’il attribuait seront attribuées par le chef de centre.';
	const avertissement = (n: number) =>
		n === 0
			? `Personne ne tient de rôle dans ce comité aujourd’hui ; ${SUITE}`
			: n === 1
				? `La personne qui tient un rôle dans ce comité le perd aujourd’hui, avec ses droits ; ${SUITE}`
				: `Les ${n} personnes qui tiennent un rôle dans ce comité le perdent aujourd’hui, avec ses droits ; ${SUITE}`;
</script>

<svelte:head>
	<title>{c.nom} · Réglages · Gyro Caserne</title>
</svelte:head>

{#snippet retour(cible: string)}
	<div role="alert">
		{#if concerne(cible) && (form?.message || form?.erreurs)}<p class="echec">{form?.message ?? 'Le formulaire contient des erreurs.'}</p>{/if}
	</div>
	<div role="status">
		{#if concerne(cible) && form?.succes}<p class="succes">{form.succes}</p>{/if}
	</div>
{/snippet}

<EnTetePage titre={c.nom} phrase="{pluriel(c.membresEnCours, 'membre')} · {c.rapporteurs.length > 0 ? `rapporteur : ${c.rapporteurs.join(', ')}` : 'pas de rapporteur'}">
	{#snippet tete()}<IconeRole icone={iconeDuComite(c)} taille={48} />{/snippet}
</EnTetePage>
{#if c.dissousLe !== null}<p><Pastille ton="neutre">Dissous</Pastille></p>{/if}

{#if c.dissousLe === null}
	<section class="carte" aria-labelledby="titre-comite">
		<h2 id="titre-comite">Nom et thème</h2>
		{@render retour('comite')}
		<form method="POST" action="?/modifier" class="formulaire">
			{#if c.estCentre}
				<input type="hidden" name="nom" value={c.nom} />
				<p class="aide">Le comité du centre ne se renomme pas.</p>
			{:else}
				<Champ id="comite-nom" name="nom" libelle="Nom" requis maxlength={60} valeur={saisie('nom', c.nom)} erreur={erreurs('comite').nom} />
			{/if}
			<Champ id="comite-theme" name="theme" libelle="Thème" requis maxlength={60} valeur={saisie('theme', c.theme)} erreur={erreurs('comite').theme} />
			<ChoixIcone legende="Icône du mur" valeur={iconeSaisie ?? iconeDuComite(c)} erreur={erreurs('comite').icone} />
			<Bouton type="submit">Enregistrer</Bouton>
		</form>
	</section>

	{#if c.estCentre}
		<p class="aide">Le comité du centre ne se dissout pas.</p>
	{:else}
		<details class="pli" {...ouvert('dissoudre')}>
			<summary>Dissoudre le comité</summary>
			{@render retour('dissoudre')}
			<form method="POST" action="?/dissoudre" class="formulaire">
				<p class="avertissement">{avertissement(c.membresEnCours)}</p>
				<label class="case"><input type="checkbox" name="confirmation" value="oui" /> Je confirme</label>
				<Bouton type="submit" variante="secondaire">Dissoudre le comité</Bouton>
			</form>
		</details>
	{/if}
{:else}
	{@render retour('dissoudre')}
	<p class="aide">Ce comité est dissous : il ne se modifie plus.</p>
{/if}

<style>
	h2,
	p {
		margin: 0;
	}
	.aide {
		color: var(--doux);
	}
	.carte,
	.pli {
		background: var(--surface);
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
		border-radius: var(--rayon-grand);
		padding: var(--espace-16);
		display: flex;
		flex-direction: column;
		gap: var(--espace-12);
	}
	.pli {
		display: block;
		padding: 0 var(--espace-16);
	}
	summary {
		min-height: 56px;
		display: flex;
		align-items: center;
		font-weight: 600;
		cursor: pointer;
	}
	.formulaire {
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
		max-width: 36rem;
		padding-bottom: var(--espace-16);
	}
	.formulaire > :global(button) {
		align-self: flex-start;
	}
	.case {
		display: flex;
		align-items: center;
		gap: var(--espace-12);
		min-height: var(--cible);
	}
	.avertissement {
		font-weight: 600;
	}
	.echec,
	.succes {
		padding: var(--espace-12) var(--espace-16);
		border-radius: var(--rayon-petit);
		border: 2px solid var(--accent);
		font-weight: 600;
	}
	.succes {
		border-color: var(--ok);
	}
</style>
