<script lang="ts">
	import Bouton from '#lib/ui/Bouton.svelte';
	import Champ from '#lib/ui/Champ.svelte';
	import IconeRole from '#lib/ui/IconeRole.svelte';
	import Pastille from '#lib/ui/Pastille.svelte';

	let { data, form } = $props();

	const c = $derived(data.comite);
	const concerne = (cible: string) => form?.cible === cible;
	const erreurs = (cible: string): Record<string, string> => (concerne(cible) ? (form?.erreurs ?? {}) : {});
	const saisie = (champ: 'nom' | 'theme', defaut: string) => (concerne('comite') ? (form?.valeurs?.[champ] ?? defaut) : defaut);
	const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

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

<header class="titre">
	<IconeRole icone="groupe" taille={48} />
	<div>
		<h1>{c.nom}</h1>
		<p class="sous-titre">
			{pluriel(c.membresEnCours, 'membre')} · {c.rapporteurs.length > 0 ? `rapporteur : ${c.rapporteurs.join(', ')}` : 'pas de rapporteur'}
		</p>
	</div>
</header>
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
			<Bouton type="submit">Enregistrer</Bouton>
		</form>
	</section>

	{#if c.estCentre}
		<p class="aide">Le comité du centre ne se dissout pas.</p>
	{:else}
		<details class="pli" open={concerne('dissoudre') && !form?.succes ? true : undefined}>
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
	.titre {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	h1,
	h2,
	p {
		margin: 0;
	}
	.sous-titre,
	.aide {
		color: var(--doux);
	}
	.carte,
	.pli {
		background: var(--surface);
		border: 1px solid var(--trait-doux);
		border-radius: var(--rayon-grand);
		padding: 14px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.pli {
		display: block;
		padding: 0 14px;
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
		gap: 16px;
		max-width: 36rem;
		padding-bottom: 14px;
	}
	.formulaire > :global(button) {
		align-self: flex-start;
	}
	.case {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: var(--cible);
	}
	.case input {
		width: 24px;
		height: 24px;
	}
	.avertissement {
		font-weight: 600;
	}
	.echec,
	.succes {
		padding: 12px 16px;
		border-radius: var(--rayon-petit);
		border: 2px solid var(--accent);
		font-weight: 600;
	}
	.succes {
		border-color: var(--ok);
	}
</style>
