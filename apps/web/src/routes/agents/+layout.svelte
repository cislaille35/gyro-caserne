<script lang="ts">
	import { page } from '$app/state';
	import { rechercheListe } from '#lib/liste-agents.ts';
	import Champ from '#lib/ui/Champ.svelte';
	import Groupe from '#lib/ui/Groupe.svelte';
	import Initiales from '#lib/ui/Initiales.svelte';
	import Pastille from '#lib/ui/Pastille.svelte';
	import Statut from '#lib/ui/Statut.svelte';
	import type { StatutPersonne } from '#lib/ui/statut.ts';
	import Vide from '#lib/ui/Vide.svelte';

	let { data, children } = $props();

	type Personne = { id: number; prenom: string; nom: string; grade: string | null; roles: string[]; email?: string; statut?: StatutPersonne; aCompleter?: boolean };

	const enfant = $derived(page.url.pathname !== '/agents');
	const pluriel = (n: number) => `${n} ${n > 1 ? 'agents' : 'agent'}`;
	const resume = (n: number, equipe: { chefs: string[] } | null) =>
		!equipe ? pluriel(n) : equipe.chefs.length === 0 ? `${pluriel(n)} · sans chef d’équipe` : `${pluriel(n)} · chef : ${equipe.chefs.join(', ')}`;
	// Les partis restent repliés, sauf quand on les cherche.
	const ouvert = (titre: string) => titre !== 'Partis' || (data.gestion && (data.filtres.filtre === 'partis' || data.filtres.texte !== ''));
	const filtres = $derived(
		data.gestion
			? [
					{ valeur: '', libelle: 'Tous' },
					{ valeur: 'a-completer', libelle: `À compléter (${data.comptes['a-completer']})` },
					{ valeur: 'indisponibles', libelle: `Indisponibles (${data.comptes.indisponibles})` },
					{ valeur: 'partis', libelle: `Partis (${data.comptes.partis})` }
				]
			: []
	);
</script>

{#snippet agent(p: Personne)}
	{@const courant = page.url.pathname === `/agents/${p.id}`}
	<li class="agent" class:courant>
		<Initiales prenom={p.prenom} nom={p.nom} />
		<span class="identite">
			{#if data.gestion}
				<!-- La liste garde sa recherche et son filtre à côté de la fiche. -->
				<a class="nom" href="/agents/{p.id}{rechercheListe(page.url)}" aria-current={courant ? 'page' : undefined}>{p.prenom} {p.nom}</a>
			{:else}
				<span class="nom">{p.prenom} {p.nom}</span>
			{/if}
			{#if p.grade}<span class="petit">{p.grade}</span>{/if}
			{#if p.email}<span class="petit email">{p.email}</span>{/if}
		</span>
		<span class="etat">
			{#if p.statut && p.statut !== 'operationnel'}<Statut statut={p.statut} />{/if}
			{#if p.aCompleter}<Pastille ton="alerte">À compléter</Pastille>{/if}
			{#if p.roles.length > 0}<small class="petit"><span class="cache">Rôles :</span> {p.roles.join(' · ')}</small>{/if}
		</span>
	</li>
{/snippet}

<!-- Pour la gestion, le titre vient de la page affichée dans le volet. -->
<svelte:head>
	{#if !data.gestion}<title>Agents · Gyro Caserne</title>{/if}
</svelte:head>

<div class="page">
	<section class="liste" class:masquee={enfant && data.gestion} aria-labelledby="titre-agents">
		<div class="entete">
			<h1 id="titre-agents">Agents</h1>
			{#if data.gestion}
				<div class="liens">
					<a class="fichier" href="/agents/fichier">Fichier de l'effectif</a>
					<a class="ajout" href="/agents/nouveau">Ajouter un agent</a>
				</div>
			{/if}
		</div>

		{#if data.gestion}
			<form method="GET" role="search" class="filtres">
				<div class="recherche">
					<Champ id="filtre-texte" name="texte" type="search" libelle="Rechercher un agent" aide="Nom, prénom ou e-mail" valeur={data.filtres.texte} />
					<!-- Premier bouton du formulaire : Entrée dans la recherche garde le filtre en cours. -->
					<button type="submit" class="chercher" name="filtre" value={data.filtres.filtre}>Rechercher</button>
				</div>
				<div class="pastilles" role="group" aria-label="Filtrer la liste">
					{#each filtres as f (f.valeur)}
						<button type="submit" class="pastille" name="filtre" value={f.valeur} aria-pressed={data.filtres.filtre === f.valeur ? 'true' : 'false'}>{f.libelle}</button>
					{/each}
				</div>
			</form>
		{/if}

		{#each data.groupes as g (g.titre)}
			{@const sansChef = g.equipe?.chefs.length === 0}
			<Groupe titre={g.titre} resume={resume(g.personnes.length, g.equipe)} couleur={g.equipe?.couleur} alerte={sansChef} ouvert={ouvert(g.titre)}>
				{#snippet action()}
					{#if data.gestion && sansChef}<a class="nommer" href="/nominations">Nommer <span class="cache">un chef pour {g.titre}</span></a>{/if}
				{/snippet}
				<ul>
					{#each g.personnes as p (p.id)}{@render agent(p)}{/each}
				</ul>
			</Groupe>
		{:else}
			<Vide texte={data.gestion ? 'Aucun agent ne correspond.' : 'Aucun agent à afficher.'} />
		{/each}
	</section>

	{#if data.gestion || page.error}
		<div class="detail" class:masque={!enfant}>
			{#if enfant}<a class="retour" href="/agents{rechercheListe(page.url)}">Retour à la liste</a>{/if}
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
	.liste {
		gap: 12px;
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
	h1 {
		margin: 0;
	}
	.liens {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
	}
	.fichier {
		display: inline-flex;
		align-items: center;
		min-height: var(--cible);
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
		flex-direction: column;
		gap: 12px;
	}
	.recherche {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 8px;
	}
	.recherche :global(.champ) {
		flex: 1 1 180px;
	}
	.pastilles {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	button {
		min-height: var(--cible);
		font: 600 1rem var(--police);
		color: var(--encre);
		cursor: pointer;
	}
	.chercher {
		padding: 0 16px;
		border-radius: var(--rayon-petit);
		border: 2px solid var(--encre);
		background: var(--surface);
	}
	.pastille {
		padding: 0 16px;
		border-radius: 999px;
		border: 1px solid var(--trait);
		background: var(--surface);
	}
	/* Pressé : fond plein et gras, pas seulement une teinte. */
	.pastille[aria-pressed='true'] {
		background: var(--encre);
		color: var(--surface);
		border-color: var(--encre);
		font-weight: 700;
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.agent {
		position: relative;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 12px;
		min-height: 56px;
		padding: 8px 14px;
	}
	.agent + .agent {
		border-top: 1px solid var(--trait-doux);
	}
	.identite {
		flex: 1 1 140px;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.nom {
		font-weight: 600;
		color: var(--encre);
	}
	/* Toute la ligne ouvre la fiche. */
	a.nom {
		text-decoration: none;
	}
	a.nom::after {
		content: '';
		position: absolute;
		inset: 0;
	}
	a.nom:hover {
		text-decoration: underline;
	}
	a.nom:focus-visible {
		outline: none;
	}
	a.nom:focus-visible::after {
		outline: 3px solid var(--focus);
		outline-offset: -3px;
	}
	/* L'agent affiché : fond, liseré et nom en gras, pas la couleur seule. */
	.courant {
		background: var(--statut-neutre-fond);
		box-shadow: inset 4px 0 0 var(--encre);
	}
	.courant .nom {
		font-weight: 800;
	}
	.nommer {
		display: inline-flex;
		align-items: center;
		min-height: var(--cible);
		padding: 0 14px;
		font-weight: 600;
	}
	.etat {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: 4px 8px;
		max-width: 100%;
	}
	.petit {
		color: var(--doux);
		font-size: 0.875rem;
	}
	.email {
		overflow-wrap: anywhere;
	}
	.cache {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
	.retour {
		display: inline-flex;
		align-items: center;
		min-height: var(--cible);
		align-self: flex-start;
	}
	@media (min-width: 1024px) {
		.masquee,
		.masque {
			display: flex;
		}
		.liste {
			flex: 0 1 480px;
		}
		.detail {
			flex: 1 1 0;
		}
		/* La liste est à côté : pas de retour. */
		.retour {
			display: none;
		}
	}
</style>
