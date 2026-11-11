<script lang="ts">
	import type { Apercu } from '@gyro-caserne/socle';
	import type { CompteRendu } from '#lib/fichier-effectif/appliquer.ts';
	import Carte from '#lib/ui/Carte.svelte';
	import { pluriel } from '#lib/pluriel.ts';

	let { compte, departs }: { compte: CompteRendu; departs: Apercu['departs'] } = $props();

	const nomDuDepart = (personneId: number) => departs.find((d) => d.personneId === personneId)?.nom;

	function libelle({ operation, message }: CompteRendu['erreurs'][number]) {
		if (operation.ligne > 0) return `Ligne ${operation.ligne} : ${message}`;
		const nom = operation.type === 'statut' ? nomDuDepart(operation.personneId) : undefined;
		return nom ? `Départ de ${nom} : ${message}` : message;
	}

	// « ligne 3, ligne 7, départ de Xavier Xu » : chaque ligne une fois, dans l'ordre.
	const nonTentees = $derived(
		[
			...[...new Set(compte.nonTentees.filter((o) => o.ligne > 0).map((o) => o.ligne))].sort((a, b) => a - b).map((l) => `ligne ${l}`),
			...compte.nonTentees.flatMap((o) => (o.ligne === 0 && o.type === 'statut' ? [`départ de ${nomDuDepart(o.personneId) ?? `l'agent n° ${o.personneId}`}`] : []))
		].join(', ')
	);
	const ARRETS = { connexion: 'connexion perdue', abandon: 'page quittée' };
</script>

<Carte titre="Compte rendu" ancre="titre-compte-rendu">
	<div class="compte">
		{#if compte.interruption}
			<p class="arret"><strong>Application arrêtée : {ARRETS[compte.interruption]}.</strong></p>
		{/if}
		<p>{compte.appliquees === 0 ? 'Aucune opération appliquée.' : `${pluriel(compte.appliquees, 'opération appliquée', 'opérations appliquées')}.`}</p>
		{#if compte.erreurs.length > 0}
			<section>
				<h3>{pluriel(compte.erreurs.length, 'erreur', 'erreurs')}</h3>
				<ul>
					{#each compte.erreurs as e, i (i)}<li>{libelle(e)}</li>{/each}
				</ul>
			</section>
		{/if}
		{#if compte.nonTentees.length > 0}
			<p>{pluriel(compte.nonTentees.length, 'opération non tentée', 'opérations non tentées')} : {nonTentees}.</p>
		{/if}
		<p class="rappel"><strong>Réexportez avant le prochain import.</strong></p>
	</div>
</Carte>

<style>
	.compte {
		display: flex;
		flex-direction: column;
		gap: var(--espace-12);
	}
	h3 {
		margin: 0 0 var(--espace-8);
		font: 700 var(--texte-20) var(--police-titre);
	}
	p {
		margin: 0;
	}
	ul {
		margin: 0;
		padding-left: var(--espace-20);
		overflow-wrap: anywhere;
	}
</style>
