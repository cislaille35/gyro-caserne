<script lang="ts">
	import centre from '$centre';
</script>

<svelte:head>
	<title>Gyro Caserne · {centre.nom}</title>
</svelte:head>

<div class="page">
	<h1>Gyro Caserne</h1>
	<p>{centre.nom}, {centre.commune}</p>
	<ul>
		{#each centre.equipes as equipe (equipe.numero)}
			<li><span class="pastille" style:background={equipe.couleur}></span>{equipe.nom}</li>
		{/each}
	</ul>
</div>

<style>
	.page {
		font-family: system-ui, sans-serif;
		max-width: 40rem;
		margin: 0 auto;
		padding: 1.5rem 1rem;
	}
	ul {
		list-style: none;
		padding: 0;
	}
	li {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0;
	}
	.pastille {
		width: 1rem;
		height: 1rem;
		border-radius: 50%;
	}
</style>
