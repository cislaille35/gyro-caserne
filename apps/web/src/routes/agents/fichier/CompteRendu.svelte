<script lang="ts">
	import type { Apercu } from '@gyro-caserne/socle';
	import type { CompteRendu } from '#lib/fichier-effectif/appliquer.ts';
	import Carte from '#lib/ui/Carte.svelte';
	import { compter } from './textes.ts';

	let { compte, departs }: { compte: CompteRendu; departs: Apercu['departs'] } = $props();

	function libelle({ operation, message }: CompteRendu['erreurs'][number]) {
		if (operation.ligne > 0) return `Ligne ${operation.ligne} : ${message}`;
		const nom = operation.type === 'statut' ? departs.find((d) => d.personneId === operation.personneId)?.nom : undefined;
		return nom ? `Départ de ${nom} : ${message}` : message;
	}
</script>

<Carte titre="Compte rendu">
	<div class="compte">
		<p>{compte.appliquees === 0 ? 'Aucune opération appliquée.' : `${compter(compte.appliquees, 'opération appliquée', 'opérations appliquées')}.`}</p>
		{#if compte.erreurs.length > 0}
			<section>
				<h3>{compter(compte.erreurs.length, 'erreur', 'erreurs')}</h3>
				<ul>
					{#each compte.erreurs as e, i (i)}<li>{libelle(e)}</li>{/each}
				</ul>
			</section>
		{/if}
		{#if compte.sautees > 0}
			<p>{compter(compte.sautees, 'opération non tentée', 'opérations non tentées')} après une erreur sur leur ligne.</p>
		{/if}
		<p class="rappel"><strong>Réexportez avant le prochain import.</strong></p>
	</div>
</Carte>

<style>
	.compte {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	h3 {
		margin: 0 0 8px;
		font: 700 1.25rem var(--police-titre);
	}
	p {
		margin: 0;
	}
	ul {
		margin: 0;
		padding-left: 20px;
		overflow-wrap: anywhere;
	}
</style>
