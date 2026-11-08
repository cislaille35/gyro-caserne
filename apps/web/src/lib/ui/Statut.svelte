<script lang="ts">
	import { LIBELLES_STATUT, type StatutPersonne } from './statut.ts';

	let { statut }: { statut: StatutPersonne } = $props();

	const teintes: Record<StatutPersonne, string> = {
		operationnel: 'ok',
		stagiaire: 'info',
		inapte_temporaire: 'alerte',
		suspendu: 'alerte',
		parti: 'neutre'
	};
	const aspect = $derived({ texte: LIBELLES_STATUT[statut], teinte: teintes[statut] });
</script>

<span
	class="statut"
	style:background="var(--statut-{aspect.teinte}-fond)"
	style:color="var(--statut-{aspect.teinte}-texte)"
	style:border-color="var(--statut-{aspect.teinte}-trait)">{aspect.texte}</span
>

<style>
	.statut {
		display: inline-block;
		padding: 2px var(--espace-12);
		border: 1px solid;
		border-radius: 999px;
		font-size: var(--texte-14);
		font-weight: 700;
	}
</style>
