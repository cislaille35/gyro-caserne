<script lang="ts">
	import Bouton from '#lib/ui/Bouton.svelte';

	let { data } = $props();

	// Le super administrateur n'a pas de fiche : pas de « Mon profil ».
	const liens = $derived([
		...(data.estPersonne ? [{ href: '/profil', titre: 'Mon profil', texte: 'Surnom, téléphone, contact d’urgence.' }] : []),
		{ href: '/affichage', titre: 'Affichage', texte: 'Thème et niveau de vie de l’appli.' }
	]);
</script>

<svelte:head>
	<title>Moi · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<h1>Moi</h1>
	<ul class="liens">
		{#each liens as lien (lien.href)}
			<li>
				<a href={lien.href}>
					<span class="titre">{lien.titre}</span>
					<span class="texte">{lien.texte}</span>
				</a>
			</li>
		{/each}
	</ul>
	<form method="POST" action="?/deconnecter">
		<Bouton type="submit" variante="secondaire">Se déconnecter</Bouton>
	</form>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	h1 {
		margin: 0;
	}
	.liens {
		display: grid;
		gap: 12px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.liens a {
		min-height: var(--cible);
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 16px 20px;
		background: var(--surface);
		border: 1px solid var(--trait-doux);
		border-radius: var(--rayon-grand);
		color: var(--encre);
		text-decoration: none;
	}
	.liens a:hover .titre {
		text-decoration: underline;
	}
	.titre {
		font: 700 1.25rem var(--police-titre);
	}
	.texte {
		color: var(--doux);
	}
</style>
