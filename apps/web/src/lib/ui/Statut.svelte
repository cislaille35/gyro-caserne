<script lang="ts">
	type Statut = 'operationnel' | 'stagiaire' | 'inapte_temporaire' | 'suspendu' | 'parti';

	let { statut }: { statut: Statut } = $props();

	const aspects: Record<Statut, { texte: string; teinte: string }> = {
		operationnel: { texte: 'Opérationnel', teinte: 'ok' },
		stagiaire: { texte: 'Stagiaire', teinte: 'info' },
		inapte_temporaire: { texte: 'Inapte temporaire', teinte: 'alerte' },
		suspendu: { texte: 'Suspendu', teinte: 'alerte' },
		parti: { texte: 'Parti', teinte: 'neutre' }
	};
	const aspect = $derived(aspects[statut]);
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
		padding: 2px 10px;
		border: 1px solid;
		border-radius: 999px;
		font-size: 0.875rem;
		font-weight: 700;
	}
</style>
