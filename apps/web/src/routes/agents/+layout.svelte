<script lang="ts">
	import { pluriel } from '#lib/pluriel.ts';
	import { page } from '$app/state';
	import { rechercheListe } from '#lib/liste-agents.ts';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import Groupe from '#lib/ui/Groupe.svelte';
	import Pastille from '#lib/ui/Pastille.svelte';
	import Retour from '#lib/ui/Retour.svelte';
	import Statut from '#lib/ui/Statut.svelte';
	import type { StatutPersonne } from '#lib/ui/statut.ts';
	import Vide from '#lib/ui/Vide.svelte';
	import Visage from '#lib/ui/Visage.svelte';

	let { data, children } = $props();

	type Personne = { id: number; prenom: string; nom: string; grade: string | null; roles: string[]; statut?: StatutPersonne; aCompleter?: boolean };

	const enfant = $derived(page.url.pathname !== '/agents');
	const agents = (n: number) => pluriel(n, 'agent');
	const resume = (n: number, equipe: { chefs: string[] } | null) =>
		!equipe ? agents(n) : equipe.chefs.length === 0 ? `${agents(n)} · sans chef d’équipe` : `${agents(n)} · chef : ${equipe.chefs.join(', ')}`;
	// Les partis restent repliés, sauf quand on les cherche.
	const ouvert = (cle: string) => cle !== 'partis' || (data.gestion && (data.filtres.filtre === 'partis' || data.filtres.texte !== ''));
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
	const filtre = $derived(data.gestion ? data.filtres.filtre : '');
	const cherche = $derived(data.gestion && (data.filtres.texte !== '' || data.filtres.filtre !== ''));
</script>

{#snippet agent(p: Personne, couleur: string | null)}
	{@const courant = page.url.pathname === `/agents/${p.id}`}
	<li class="agent" class:courant>
		<Visage prenom={p.prenom} nom={p.nom} {couleur} />
		<span class="identite">
			{#if data.gestion}
				<!-- La liste garde sa recherche et son filtre à côté de la fiche. -->
				<a class="nom" href="/agents/{p.id}{rechercheListe(page.url)}" aria-current={courant ? 'page' : undefined}>{p.prenom} {p.nom}</a>
			{:else}
				<span class="nom">{p.prenom} {p.nom}</span>
			{/if}
			{#if p.grade || p.roles.length > 0}
				<span class="sous"
					>{p.grade ?? ''}{#if p.grade && p.roles.length > 0}{' · '}{/if}{#if p.roles.length > 0}<span class="masque">Rôles :</span> {p.roles.join(' · ')}{/if}</span
				>
			{/if}
		</span>
		{#if (p.statut && p.statut !== 'operationnel') || p.aCompleter}
			<span class="etat">
				{#if p.statut && p.statut !== 'operationnel'}<Statut statut={p.statut} />{/if}
				{#if p.aCompleter}<Pastille ton="alerte">À compléter</Pastille>{/if}
			</span>
		{/if}
		{#if data.gestion}
			<svg class="chevron" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6" /></svg>
		{/if}
	</li>
{/snippet}

<!-- Pour la gestion, le titre vient de la page affichée dans le volet. -->
<svelte:head>
	{#if !data.gestion}<title>Agents · Gyro Caserne</title>{/if}
</svelte:head>

<div class="page">
	<section class="liste" class:masquee={enfant && data.gestion} class:seule={!data.gestion} aria-label="Agents">
		{#if data.gestion}
			<EnTetePage titre="Agents" phrase="L’effectif du centre, par équipe." action={{ href: '/agents/nouveau', libelle: 'Ajouter' }}>
				{#snippet secondaire()}
					<a class="fichier" href="/agents/fichier"
						><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
							><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z M14 3v6h6 M8 13h8 M8 17h8" /></svg
						>Fichier<span class="masque">{' de l’effectif'}</span></a
					>
				{/snippet}
			</EnTetePage>

			<form method="GET" role="search" class="filtres">
				<div class="recherche">
					<label for="filtre-texte" class="masque">Rechercher un agent</label>
					<!-- Premier bouton du formulaire : Entrée dans la recherche garde le filtre en cours. -->
					<button type="submit" class="loupe" name="filtre" value={filtre}
						><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M20 20l-4-4" /></svg
						><span class="masque">Rechercher</span></button
					>
					<input id="filtre-texte" name="texte" type="search" value={data.filtres.texte} placeholder="Nom, prénom ou e-mail" autocomplete="off" />
				</div>
				<div class="puces" role="group" aria-label="Filtrer la liste">
					{#each filtres as f (f.valeur)}
						<button type="submit" class="puce" name="filtre" value={f.valeur} aria-pressed={filtre === f.valeur ? 'true' : 'false'}>{f.libelle}</button>
					{/each}
				</div>
			</form>
		{:else}
			<EnTetePage titre="Agents" phrase="L’effectif du centre, par équipe." gyro />
		{/if}

		{#each data.groupes as g (g.cle)}
			{@const sansChef = g.equipe?.chefs.length === 0}
			<Groupe titre={g.titre} resume={resume(g.personnes.length, g.equipe)} couleur={g.equipe?.couleur} alerte={sansChef} ouvert={ouvert(g.cle)}>
				{#snippet action()}
					{#if data.gestion && sansChef}<a class="nommer" href="/nominations">Nommer <span class="masque">un chef pour {g.titre}</span></a>{/if}
				{/snippet}
				<ul>
					{#each g.personnes as p (p.id)}{@render agent(p, g.equipe?.couleur ?? null)}{/each}
				</ul>
			</Groupe>
		{:else}
			{#if cherche}
				<Vide titre="Personne ici" texte="Aucun agent ne correspond. Essayez un autre nom ou un autre filtre." action={{ href: '/agents', libelle: 'Tout afficher' }} />
			{:else}
				<Vide titre="Personne ici" texte="Aucun agent à afficher pour l’instant." />
			{/if}
		{/each}
	</section>

	{#if data.gestion || page.error}
		<div class="detail" class:masque-detail={!enfant}>
			{#if enfant}<div class="retour"><Retour href="/agents{rechercheListe(page.url)}" libelle="Agents" /></div>{/if}
			{@render children()}
		</div>
	{/if}
</div>

<style>
	/* Au téléphone, un refus s'affiche au-dessus de la liste. */
	.page {
		display: flex;
		flex-direction: column;
		gap: 28px;
	}
	.detail {
		order: -1;
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
		gap: 14px;
	}
	.masquee,
	.masque-detail {
		display: none;
	}
	.fichier {
		min-height: 48px;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 0 16px 0 12px;
		border: 1px solid var(--trait);
		border-radius: 999px;
		background: var(--surface);
		color: var(--encre);
		font-weight: 600;
		text-decoration: none;
	}
	.fichier:hover {
		border-color: var(--encre);
	}
	@media (max-width: 639px) {
		.etat :global(span) {
			padding: 1px 8px;
			font-size: 0.8125rem;
		}
	}
	.filtres {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.recherche {
		position: relative;
		display: flex;
	}
	.recherche input {
		flex: 1;
		min-width: 0;
		min-height: 48px;
		padding: 0 16px 0 48px;
		border: 1px solid var(--trait);
		border-radius: 999px;
		background: var(--surface);
		color: var(--encre);
		font: 400 1rem var(--police);
	}
	.recherche input::placeholder {
		color: var(--doux);
	}
	.recherche input:hover {
		border-color: var(--doux);
	}
	.loupe {
		position: absolute;
		left: 2px;
		top: 2px;
		width: 44px;
		height: 44px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 0;
		border-radius: 999px;
		background: none;
		color: var(--doux);
		cursor: pointer;
	}
	.loupe:hover {
		color: var(--encre);
	}
	/* Les filtres tiennent sur une ligne qui défile ; la marge laisse voir le contour du focus. */
	.puces {
		display: flex;
		gap: 8px;
		margin: -4px -16px;
		padding: 4px 16px;
		overflow-x: auto;
		scrollbar-width: none;
	}
	.puce {
		flex: none;
		min-height: var(--cible);
		padding: 0 16px;
		border: 1px solid var(--trait);
		border-radius: 999px;
		background: var(--surface);
		color: var(--encre);
		font: 600 0.9375rem var(--police);
		white-space: nowrap;
		cursor: pointer;
	}
	.puce:hover {
		border-color: var(--encre);
	}
	/* Pressé : fond plein et gras, pas seulement une teinte. */
	.puce[aria-pressed='true'] {
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
		align-items: center;
		gap: 12px;
		min-height: 64px;
		padding: 10px 14px;
	}
	.agent + .agent {
		border-top: 1px solid var(--trait-doux);
	}
	.identite {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.nom {
		font-weight: 600;
		font-size: 1.0625rem;
		line-height: 1.3;
		color: var(--encre);
	}
	.sous {
		color: var(--doux);
		font-size: 0.875rem;
		overflow-wrap: anywhere;
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
	.agent:hover a.nom {
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
	/* Les pastilles s'empilent à droite, chacune sur une ligne. */
	.etat {
		flex: none;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 4px;
		white-space: nowrap;
	}
	.chevron {
		flex: none;
		margin-left: -4px;
		color: var(--doux);
	}
	.nommer {
		flex: none;
		display: inline-flex;
		align-items: center;
		min-height: 36px;
		margin-right: 12px;
		padding: 0 14px;
		border: 1px solid var(--trait);
		border-radius: 999px;
		color: var(--encre);
		font-weight: 600;
		text-decoration: none;
		position: relative;
	}
	/* Cible de 44 px autour d'un bouton de 36 px. */
	.nommer::before {
		content: '';
		position: absolute;
		inset: -4px;
	}
	.nommer:hover {
		border-color: var(--encre);
	}
	@media (min-width: 1024px) {
		.page {
			flex-direction: row;
			align-items: flex-start;
		}
		.detail {
			order: 0;
		}
		.masquee,
		.masque-detail {
			display: flex;
		}
		.liste {
			flex: 0 1 460px;
		}
		.liste.seule {
			flex: 0 1 44rem;
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
