<script lang="ts">
	import FormulaireEngin from '#lib/engins/FormulaireEngin.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';

	let { data, form } = $props();
	const depart = $derived(form?.valeurs ?? { nom: '', typeId: String(data.types[0]?.id ?? ''), immatriculation: '', situation: 'centre' as const, provenance: '' });
</script>

<svelte:head>
	<title>Ajouter un engin · Engins · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<EnTetePage titre="Ajouter un engin" phrase="Un engin du centre, ou prêté par un autre centre le temps d’une réparation." retour={{ href: '/engins', libelle: 'Engins' }} />
	{#key depart}
		<FormulaireEngin types={data.types} valeurs={depart} existant={false} message={form?.message} envoi="Ajouter l’engin" />
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
