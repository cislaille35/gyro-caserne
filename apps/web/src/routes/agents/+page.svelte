<script lang="ts">
	let { data } = $props();
</script>

<svelte:head>
	<title>Agents · Gyro Caserne</title>
</svelte:head>

{#if data.gestion}
	<p class="invite">Choisissez un agent dans la liste.</p>
{/if}

<style>
	.invite {
		margin: 0;
		color: var(--doux);
	}
</style>
