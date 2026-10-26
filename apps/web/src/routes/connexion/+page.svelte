<script lang="ts">
	let { form } = $props();
</script>

<svelte:head>
	<title>Connexion · Gyro Caserne</title>
</svelte:head>

<main>
	<h1>Connexion</h1>
	{#if form?.envoye}
		<p role="status">Si cette adresse est autorisée, un lien vient de partir. Pensez à regarder dans vos courriers indésirables.</p>
	{:else}
		<form method="post">
			<label for="email">Adresse e-mail</label>
			<input id="email" name="email" type="email" autocomplete="email" required />
			<button type="submit">Recevoir un lien de connexion</button>
		</form>
	{/if}
</main>
