<script lang="ts">
	import Carte from '#lib/ui/Carte.svelte';
	import Vide from '#lib/ui/Vide.svelte';

	let { data } = $props();

	const liens = $derived([
		{ href: '/agents', titre: 'Agents', texte: 'L’équipe et les fiches des agents.' },
		...(data.peutNominations ? [{ href: '/nominations', titre: 'Nominations', texte: 'Qui tient quel rôle, et les nominations à venir.' }] : []),
		...(data.peutReglages ? [{ href: '/reglages', titre: 'Réglages', texte: 'Les comités et les responsabilités du centre.' }] : [])
	]);
</script>

<svelte:head>
	<title>Caserne · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<h1>Caserne</h1>
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
	<Carte titre="Engins"><Vide texte="Les engins arrivent bientôt." /></Carte>
	<Carte titre="Comités"><Vide texte="Les pages des comités arrivent bientôt." /></Carte>
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
	@media (min-width: 1024px) {
		.liens {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
</style>
