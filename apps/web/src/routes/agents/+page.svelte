<script lang="ts">
	import Vide from '#lib/ui/Vide.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Agents · Gyro Caserne</title>
</svelte:head>

<!-- À l'ordinateur, la colonne de droite attend une fiche ; au téléphone, elle est masquée. -->
{#if data.gestion}
	<div class="attente">
		<Vide titre="Choisissez un agent dans la liste." texte="Sa fiche s’ouvre ici : contact, parcours, équipe, statut et rôles." />
	</div>
{/if}

<style>
	.attente {
		margin-top: 48px;
		border: 1px dashed var(--trait);
		border-radius: 18px;
	}
</style>
