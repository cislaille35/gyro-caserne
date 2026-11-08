<script lang="ts">
	import FormulaireEngin from '#lib/engins/FormulaireEngin.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';

	let { data, form } = $props();
	const e = $derived(data.engin);
	const depart = $derived(form?.valeurs ?? { nom: e.nom, typeId: String(e.typeId), immatriculation: e.immatriculation ?? '', situation: e.situation, provenance: e.provenance ?? '' });
</script>

<svelte:head>
	<title>Modifier {e.nom} · Engins · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<EnTetePage titre="Modifier {e.nom}" phrase="Son nom, son type, sa plaque et sa situation. Son état se décide depuis ses anomalies." retour={{ href: `/engins/${e.id}`, libelle: e.nom }} />
	{#key depart}
		<FormulaireEngin types={data.types} valeurs={depart} existant message={form?.message} envoi="Enregistrer" />
	{/key}
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
		max-width: 40rem;
	}
</style>
