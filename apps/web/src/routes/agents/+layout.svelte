<script lang="ts">
	import { page } from '$app/state';
	import Bouton from '#lib/ui/Bouton.svelte';
	import Champ from '#lib/ui/Champ.svelte';
	import Choix from '#lib/ui/Choix.svelte';
	import PastilleEquipe from '#lib/ui/PastilleEquipe.svelte';
	import Statut from '#lib/ui/Statut.svelte';
	import { LIBELLES_STATUT } from '#lib/ui/statut.ts';
	import Tableau from '#lib/ui/Tableau.svelte';
	import Vide from '#lib/ui/Vide.svelte';

	let { data, children } = $props();

	const enfant = $derived(page.url.pathname !== '/agents');
</script>

<!-- Pour la gestion, le titre vient de la page affichée dans le volet. -->
<svelte:head>
	{#if !data.gestion}<title>Agents · Gyro Caserne</title>{/if}
</svelte:head>

<div class="page">
	<section class="liste" class:masquee={enfant && data.gestion} aria-labelledby="titre-agents">
		<div class="entete">
			<h1 id="titre-agents">Agents</h1>
			{#if data.gestion}
				<a class="ajout" href="/agents/nouveau">Ajouter un agent</a>
			{/if}
		</div>

		{#if data.gestion}
			<form method="GET" role="search" class="filtres">
				<Champ id="filtre-texte" name="texte" type="search" libelle="Rechercher" aide="Nom, prénom ou e-mail" valeur={data.filtres.texte} />
				<Choix
					id="filtre-equipe"
					name="equipe"
					libelle="Équipe"
					valeur={data.filtres.equipe}
					options={[
						{ valeur: '', libelle: 'Toutes' },
						{ valeur: 'aucune', libelle: 'Aucune équipe' },
						...data.equipes.map((e) => ({ valeur: String(e.id), libelle: e.nom }))
					]}
				/>
				<Choix
					id="filtre-statut"
					name="statut"
					libelle="Statut"
					valeur={data.filtres.statut}
					options={[{ valeur: '', libelle: 'Tous' }, ...data.statuts.map((s) => ({ valeur: s, libelle: LIBELLES_STATUT[s] }))]}
				/>
				<Bouton type="submit">Filtrer</Bouton>
			</form>

			{#if data.lignes.length === 0}
				<Vide texte="Aucun agent ne correspond." />
			{:else}
				<Tableau legende="Liste des agents du centre">
					<thead>
						<tr><th scope="col">Nom</th><th scope="col">Grade</th><th scope="col">Équipe</th><th scope="col">Statut</th><th scope="col">Fiche</th></tr>
					</thead>
					<tbody>
						{#each data.lignes as ligne (ligne.id)}
							<tr>
								<th scope="row">{ligne.prenom} {ligne.nom}<span class="email">{ligne.email}</span></th>
								<td>{ligne.grade ?? '—'}</td>
								<td>{#if ligne.equipe}<PastilleEquipe nom={ligne.equipe.nom} couleur={ligne.equipe.couleur} />{:else}—{/if}</td>
								<td><Statut statut={ligne.statut} /></td>
								<td><a href="/agents/{ligne.id}">Voir la fiche<span class="cache"> de {ligne.prenom} {ligne.nom}</span></a></td>
							</tr>
						{/each}
					</tbody>
				</Tableau>
			{/if}
		{:else}
			{#each data.groupes as groupe (groupe.titre)}
				<h2>{groupe.titre}</h2>
				<ul>
					{#each groupe.personnes as p (p.id)}
						<li>
							{p.prenom} {p.nom}{#if p.grade}<span class="grade"> · {p.grade}</span>{/if}
							{#if p.roles.length > 0}<small class="roles">Rôles : {p.roles.join(', ')}</small>{/if}
						</li>
					{/each}
				</ul>
			{:else}
				<Vide texte="Aucun agent à afficher." />
			{/each}
		{/if}
	</section>

	{#if data.gestion || page.error}
		<div class="detail" class:masque={!enfant}>
			{#if enfant}<a class="retour" href="/agents">Retour à la liste</a>{/if}
			{@render children()}
		</div>
	{/if}
</div>

<style>
	.page {
		display: flex;
		gap: 24px;
		align-items: flex-start;
	}
	.liste,
	.detail {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.masquee,
	.masque {
		display: none;
	}
	.entete {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	h1,
	h2 {
		margin: 0;
	}
	.ajout {
		display: inline-flex;
		align-items: center;
		min-height: var(--cible);
		padding: 0 20px;
		border-radius: var(--rayon-petit);
		background: var(--rouge);
		color: var(--sur-rouge);
		border: 2px solid var(--encre);
		font-weight: 700;
		text-decoration: none;
	}
	.filtres {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		align-items: flex-end;
		padding: 16px;
		background: var(--surface);
		border: 1px solid var(--trait);
		border-radius: var(--rayon-grand);
	}
	.filtres :global(.champ) {
		flex: 1 1 180px;
	}
	ul {
		margin: 0;
		padding-left: 20px;
	}
	.roles {
		display: block;
	}
	.grade,
	.roles,
	.email {
		color: var(--doux);
	}
	.email {
		display: block;
		font-weight: 400;
		font-size: 0.875rem;
	}
	.cache {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
	.retour,
	td a {
		display: inline-flex;
		align-items: center;
		min-height: var(--cible);
	}
	.retour {
		align-self: flex-start;
	}
	@media (min-width: 1024px) {
		.masquee,
		.masque {
			display: flex;
		}
		.liste {
			flex: 0 1 560px;
		}
		.detail {
			flex: 1 1 0;
		}
	}
</style>
