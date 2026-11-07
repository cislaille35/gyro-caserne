<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Fiche } from '@gyro-caserne/socle';
	import { compteFiche } from '#lib/engins/textes.ts';
	import Bouton from '#lib/ui/Bouton.svelte';
	import Champ from '#lib/ui/Champ.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import ListeRangees from '#lib/ui/ListeRangees.svelte';
	import Rangee from '#lib/ui/Rangee.svelte';

	let { data, form }: { data: { fiches: Fiche[] }; form: { message?: string; nom?: string } | null } = $props();
</script>

<svelte:head>
	<title>Fiches de prise de garde · Engins · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<EnTetePage titre="Fiches de prise de garde" phrase="Une fiche par type d’engin. Une prise passée garde la fiche de son époque." retour={{ href: '/engins', libelle: 'Engins' }} />

	<div class="colonnes">
		<ListeRangees titre="Les fiches" compte={data.fiches.length}>
			{#each data.fiches as f (f.typeId)}
				<li><Rangee href="/engins/fiches/{f.typeId}" titre="Fiche {f.type}" sous={compteFiche(f.zones)} valeur="version {f.version.numero}" /></li>
			{/each}
		</ListeRangees>

		<div class="cote">
			<section class="panneau" aria-labelledby="titre-type">
				<h2 id="titre-type">Nouveau type d’engin</h2>
				<p class="doux">Pour un type que le centre n’avait pas (CCF, VLHR…) : sa fiche commence vide.</p>
				<form method="POST" action="?/nouveauType" use:enhance class="formulaire">
					<Champ id="nom-type" name="nom" libelle="Type" aide="Court, comme sur l’engin : « CCF »." requis maxlength={20} valeur={form?.nom ?? ''} erreur={form?.message} />
					<div><Bouton type="submit">Créer le type</Bouton></div>
				</form>
			</section>
			<ListeRangees titre="En une fois">
				<li><Rangee href="/engins/fiches/fichier" titre="Fichier des fiches" sous="Exporter ou importer toutes les fiches dans Excel ou LibreOffice" /></li>
			</ListeRangees>
		</div>
	</div>
</div>

<style>
	.page,
	.colonnes,
	.cote {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}
	h2,
	p {
		margin: 0;
	}
	h2 {
		font: 700 1.25rem var(--police-titre);
	}
	.doux {
		color: var(--doux);
	}
	.panneau,
	.formulaire {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.panneau {
		padding: 16px;
		background: var(--surface);
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
		border-radius: var(--rayon-grand);
	}
	@media (min-width: 1024px) {
		.colonnes {
			display: grid;
			grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
			align-items: start;
			gap: 28px;
		}
	}
</style>
