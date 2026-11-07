<script lang="ts">
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import Installer from '#lib/ui/Installer.svelte';
</script>

<svelte:head>
	<title>Installer l’appli · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<EnTetePage titre="Installer l’appli" phrase="Sur l’écran d’accueil, Gyro Caserne s’ouvre comme une appli et reçoit les notifications." retour={{ href: '/moi', libelle: 'Moi' }} />
	<Installer mode="page" />
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 16px;
		max-width: 40rem;
	}
</style>
