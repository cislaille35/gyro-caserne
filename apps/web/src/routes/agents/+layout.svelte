<script lang="ts">
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { montrerCourante } from '#lib/ui/zone-defilante.ts';
	import { pluriel } from '#lib/pluriel.ts';
	import { page } from '$app/state';
	import { emailCherche, rechercheListe } from '#lib/liste-agents.ts';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import Groupe from '#lib/ui/Groupe.svelte';
	import Pastille from '#lib/ui/Pastille.svelte';
	import Recherche from '#lib/ui/Recherche.svelte';
	import Retour from '#lib/ui/Retour.svelte';
	import Statut from '#lib/ui/Statut.svelte';
	import type { StatutPersonne } from '#lib/ui/statut.ts';
	import Vide from '#lib/ui/Vide.svelte';
	import Visage from '#lib/ui/Visage.svelte';

	let { data, children } = $props();

	type Personne = { id: number; prenom: string; nom: string; email?: string; grade: string | null; roles: string[]; statut?: StatutPersonne; aCompleter?: boolean };
	type GroupeAgents = { cle: string; titre: string; equipe: { couleur: string; chefs: string[] } | null; personnes: Personne[] };

	const enfant = $derived(page.url.pathname !== '/agents');
	const equipes = $derived<GroupeAgents[]>(data.groupes.filter((g) => g.equipe));
	const horsEquipes = $derived<GroupeAgents[]>(data.groupes.filter((g) => !g.equipe));
	const agents = (n: number) => pluriel(n, 'agent');
	const resume = (n: number, equipe: { chefs: string[] } | null) =>
		!equipe ? agents(n) : equipe.chefs.length === 0 ? `${agents(n)} · sans chef de garde` : `${agents(n)} · chef : ${equipe.chefs.join(', ')}`;
	// Au téléphone, les équipes s'ouvrent à la demande. Le serveur ne connaît pas l'écran : tout part ouvert, ce qui reste lisible sans JavaScript.
	let replier = $state(false);
	let liste = $state<HTMLElement>();
	afterNavigate(() => montrerCourante(liste));

	onMount(() => {
		const ecran = matchMedia('(max-width: 1023px)');
		const suivre = () => (replier = ecran.matches);
		suivre();
		ecran.addEventListener('change', suivre);
		return () => ecran.removeEventListener('change', suivre);
	});
	// Les partis restent repliés, sauf quand on les cherche. Une recherche ou un filtre montre toujours ses résultats.
	const ouvert = (cle: string) => (cle === 'partis' ? data.gestion && (data.filtres.filtre === 'partis' || data.filtres.texte !== '') : cherche || !replier);
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
	{@const email = data.gestion && emailCherche(p, data.filtres.texte)}
	<li class="agent" class:courant>
		<Visage prenom={p.prenom} nom={p.nom} {couleur} />
		<span class="identite">
			{#if data.gestion}
				<!-- La liste garde sa recherche et son filtre à côté de la fiche. -->
				<a class="nom" href="/agents/{p.id}{rechercheListe(page.url)}" aria-current={courant ? 'page' : undefined}>{p.prenom} {p.nom}</a>
			{:else}
				<span class="nom">{p.prenom} {p.nom}</span>
			{/if}
			{#if p.grade || p.roles.length > 0 || email}
				<span class="sous"
					>{p.grade ?? ''}{#if p.grade && p.roles.length > 0}{' · '}{/if}{#if p.roles.length > 0}<span class="masque">Rôles :</span> {p.roles.join(' · ')}{/if}{#if email}{#if p.grade || p.roles.length > 0}{' · '}{/if}{p.email}{/if}</span
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

{#snippet groupe(g: GroupeAgents)}
	{@const sansChef = g.equipe?.chefs.length === 0}
	<!-- Une valeur à part : relire la page (une fiche enregistrée) ne referme pas ce qu'on a ouvert. -->
	{@const depart = ouvert(g.cle)}
	<Groupe titre={g.titre} resume={resume(g.personnes.length, g.equipe)} couleur={g.equipe?.couleur} alerte={sansChef} ouvert={depart}>
		{#snippet action()}
			{#if data.gestion && sansChef}<a class="nommer" href="/nominations">Nommer <span class="masque">un chef pour {g.titre}</span></a>{/if}
		{/snippet}
		<ul>
			{#each g.personnes as p (p.id)}{@render agent(p, g.equipe?.couleur ?? null)}{/each}
		</ul>
	</Groupe>
{/snippet}

<!-- Pour la gestion, le titre vient de la page affichée dans le volet. -->
<svelte:head>
	{#if !data.gestion}<title>Agents · Gyro Caserne</title>{/if}
</svelte:head>

<div class="page" class:a-cote={enfant}>
	<section class="liste" class:masquee={enfant && data.gestion} aria-label="Agents" bind:this={liste}>
		{#if data.gestion}
			<EnTetePage titre="Agents" retour={{ href: '/caserne', libelle: 'Caserne' }} action={{ href: '/agents/nouveau', libelle: 'Ajouter', discrete: true }}>
				{#snippet secondaire()}
					<a class="lien-secondaire" href="/agents/fichier"
						><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
							><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z M14 3v6h6 M8 13h8 M8 17h8" /></svg
						>Fichier<span class="masque">{' de l’effectif'}</span></a
					>
				{/snippet}
			</EnTetePage>

			<form method="GET" role="search" class="filtres">
				<!-- Premier bouton du formulaire : Entrée dans la recherche garde le filtre en cours. -->
				<Recherche id="filtre-texte" name="texte" valeur={data.filtres.texte} libelle="Rechercher un agent" aide="Nom, prénom ou e-mail" bouton={{ name: 'filtre', value: filtre }} />
				<div class="puces" role="group" aria-label="Filtrer la liste">
					{#each filtres as f (f.valeur)}
						<button type="submit" class="puce" name="filtre" value={f.valeur} aria-pressed={filtre === f.valeur ? 'true' : 'false'}>{f.libelle}</button>
					{/each}
				</div>
			</form>
		{:else}
			<EnTetePage titre="Agents" retour={{ href: '/caserne', libelle: 'Caserne' }} />
		{/if}

		{#if data.groupes.length > 0}
			<!-- À l'ordinateur : une colonne par équipe, et une dernière pour ceux qui n'en ont pas. -->
			<div class="colonnes">
				{#each equipes as g (g.cle)}{@render groupe(g)}{/each}
				{#if horsEquipes.length > 0}
					<div class="hors-equipes">
						{#each horsEquipes as g (g.cle)}{@render groupe(g)}{/each}
					</div>
				{/if}
			</div>
		{:else if cherche}
			<Vide titre="Personne ici" texte="Aucun agent ne correspond. Essayez un autre nom ou un autre filtre." action={{ href: '/agents', libelle: 'Tout afficher' }} />
		{:else}
			<Vide titre="Personne ici" texte="Aucun agent à afficher pour l’instant." />
		{/if}
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
		gap: var(--espace-32);
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
		gap: var(--espace-16);
	}
	.liste {
		gap: var(--espace-16);
	}
	.colonnes,
	.hors-equipes {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
	}
	.masquee,
	.masque-detail {
		display: none;
	}
	@media (max-width: 639px) {
		.etat :global(span) {
			padding: 1px var(--espace-8);
			font-size: var(--texte-14);
		}
	}
	.filtres {
		display: flex;
		flex-direction: column;
		gap: var(--espace-12);
	}
	/* Les filtres tiennent sur une ligne qui défile ; la marge laisse voir le contour du focus. */
	.puces {
		display: flex;
		gap: var(--espace-8);
		margin: -4px -16px;
		padding: var(--espace-4) var(--espace-16);
		overflow-x: auto;
		scrollbar-width: none;
	}
	.puce {
		flex: none;
		min-height: var(--cible);
		padding: 0 var(--espace-16);
		border: 1px solid var(--trait);
		border-radius: var(--rayon-bouton);
		background: var(--surface);
		color: var(--encre);
		font: 600 var(--texte-15) var(--police);
		white-space: nowrap;
		cursor: pointer;
	}
	@media (hover: hover) and (pointer: fine) {
		.puce:hover {
			border-color: var(--encre);
		}
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
		gap: var(--espace-12);
		min-height: 64px;
		padding: var(--espace-12) var(--espace-16);
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
		font-size: var(--texte-16);
		line-height: 1.3;
		color: var(--encre);
	}
	.sous {
		color: var(--doux);
		font-size: var(--texte-14);
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
	@media (hover: hover) and (pointer: fine) {
		.agent:hover a.nom {
			text-decoration: underline;
		}
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
		gap: var(--espace-4);
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
		margin-right: var(--espace-12);
		padding: 0 var(--espace-16);
		border: 1px solid var(--trait);
		border-radius: var(--rayon-bouton);
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
	@media (hover: hover) and (pointer: fine) {
		.nommer:hover {
			border-color: var(--encre);
		}
	}
	@media (min-width: 1024px) {
		.page {
			flex-direction: row;
			align-items: flex-start;
		}
		.detail {
			order: 0;
		}
		.masquee {
			display: flex;
		}
		/* Une fiche ouverte : la liste à gauche, sur une colonne. */
		.a-cote .liste {
			flex: 0 1 460px;
			position: sticky;
			top: 16px;
			max-height: calc(100dvh - 32px);
			overflow-y: auto;
		}
		.detail {
			flex: 1 1 0;
		}
		/* Sinon, une colonne par équipe. De 2 à 6 équipes, les colonnes se partagent la largeur et passent à la ligne s'il le faut. */
		.page:not(.a-cote) .colonnes {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(14.5rem, 1fr));
			align-items: start;
		}
		.page:not(.a-cote) .agent {
			flex-wrap: wrap;
			gap: 2px var(--espace-12);
		}
		.page:not(.a-cote) .identite {
			flex-basis: calc(100% - 52px);
		}
		.page:not(.a-cote) .etat {
			flex-basis: calc(100% - 52px);
			flex-direction: row;
			flex-wrap: wrap;
			align-items: center;
			margin-left: 52px;
			white-space: normal;
		}
		/* Toute la ligne ouvre la fiche : le chevron prendrait la place du nom. */
		.page:not(.a-cote) .chevron {
			display: none;
		}
		.page:not(.a-cote) .filtres {
			flex-direction: row;
			flex-wrap: wrap;
			align-items: center;
			gap: var(--espace-12) var(--espace-16);
		}
		.page:not(.a-cote) .filtres > :global(.recherche) {
			flex: 0 1 26rem;
		}
		.page:not(.a-cote) .puces {
			flex: 1 1 auto;
			margin: -4px 0;
			padding: var(--espace-4);
		}
		/* La liste est à côté : pas de retour. */
		.retour {
			display: none;
		}
	}
</style>
