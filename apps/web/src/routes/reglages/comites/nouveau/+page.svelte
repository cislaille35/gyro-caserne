<script lang="ts">
	import Bouton from '#lib/ui/Bouton.svelte';
	import Champ from '#lib/ui/Champ.svelte';
	import type { IconeRole } from '#lib/ui/icones-roles.ts';
	import ChoixIcone from '../../ChoixIcone.svelte';

	let { form } = $props();
	const erreurs = $derived<Record<string, string>>(form?.erreurs ?? {});
</script>

<svelte:head>
	<title>Nouveau comité · Réglages · Gyro Caserne</title>
</svelte:head>

<h1>Nouveau comité</h1>
<p class="intro">Un comité réunit des agents autour d’un thème (amicale, sport…). Ses membres et son rapporteur se nomment ensuite.</p>
<div role="alert">
	{#if form?.message || form?.erreurs}<p class="echec">{form?.message ?? 'Le formulaire contient des erreurs.'}</p>{/if}
</div>
<form method="POST" class="formulaire">
	<Champ id="comite-nom" name="nom" libelle="Nom" requis maxlength={60} valeur={form?.valeurs?.nom ?? ''} erreur={erreurs.nom} />
	<Champ id="comite-theme" name="theme" libelle="Thème" requis maxlength={60} valeur={form?.valeurs?.theme ?? ''} erreur={erreurs.theme} />
	<ChoixIcone legende="Icône du mur" valeur={(form?.valeurs?.icone || undefined) as IconeRole | undefined} erreur={erreurs.icone} />
	<Bouton type="submit">Créer le comité</Bouton>
</form>

<style>
	h1,
	p {
		margin: 0;
	}
	.intro {
		color: var(--doux);
	}
	.formulaire {
		display: flex;
		flex-direction: column;
		gap: 16px;
		max-width: 36rem;
		padding: 16px;
		background: var(--surface);
		border: 1px solid var(--trait-doux);
		border-radius: var(--rayon-grand);
	}
	.formulaire > :global(button) {
		align-self: flex-start;
	}
	.echec {
		padding: 12px 16px;
		border-radius: var(--rayon-petit);
		border: 2px solid var(--accent);
		font-weight: 600;
	}
</style>
