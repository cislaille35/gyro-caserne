<script lang="ts">
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import { untrack } from 'svelte';
	import type { Droit } from '@gyro-caserne/socle';
	import { DOMAINES, niveauxDe } from '#lib/paquets.ts';
	import BarreActions from '#lib/ui/BarreActions.svelte';
	import Bouton from '#lib/ui/Bouton.svelte';
	import IconeRole from '#lib/ui/IconeRole.svelte';
	import Domaines from '../../Domaines.svelte';

	let { data, form } = $props();

	const droits = $derived(data.profil.droits as Droit[]);
	let choix = $state(untrack(() => niveauxDe(droits)));
	$effect.pre(() => {
		choix = niveauxDe(droits);
	});
	const depart = $derived(niveauxDe(droits));
	const modifies = $derived(DOMAINES.filter((d) => choix[d.id] !== depart[d.id]).length);
	const message = $derived(modifies === 0 ? '' : modifies === 1 ? '1 domaine modifié, pas encore enregistré' : `${modifies} domaines modifiés, pas encore enregistrés`);
</script>

<svelte:head>
	<title>{data.profil.nom} · Réglages · Gyro Caserne</title>
</svelte:head>

<EnTetePage titre={data.profil.nom} phrase="Profil · {data.profil.typePersonne === 'agent' ? 'agents du centre' : 'personnes extérieures'}">
	{#snippet tete()}<IconeRole icone="casque" taille={48} />{/snippet}
</EnTetePage>

<div role="alert">
	{#if form?.message}<p class="echec">{form.message}</p>{/if}
</div>
<div role="status">
	{#if form?.succes}<p class="succes">{form.succes}</p>{/if}
</div>

<p class="intro">Ce que ce profil donne à chaque personne qui l’a, domaine par domaine. Les droits de base (voir le planning, les engins…) ne se règlent pas ici.</p>

<form method="POST" class="formulaire">
	<Domaines droits={droits} bind:choix profil />
	<BarreActions {message}>
		<Bouton type="submit">Enregistrer</Bouton>
	</BarreActions>
</form>

<style>
	p {
		margin: 0;
	}
	.intro {
		color: var(--doux);
	}
	.formulaire {
		display: flex;
		flex-direction: column;
		gap: var(--espace-12);
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
