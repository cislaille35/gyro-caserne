<script lang="ts">
	import Retour from '#lib/ui/Retour.svelte';
	import { phraseAudience, phraseDuMur } from '#lib/murs/phrases.ts';
	import { teinteDuMur } from '#lib/murs/teinte.ts';
	import CouperNotifications from '#lib/ui/CouperNotifications.svelte';
	import Pastille from '#lib/ui/Pastille.svelte';
	import PastilleMur from '#lib/ui/PastilleMur.svelte';
	import Publication from '#lib/ui/Publication.svelte';
	import Vide from '#lib/ui/Vide.svelte';

	let { data, form } = $props();

	// Une seule zone annoncée par page, pour toutes les réponses des formulaires.
	const annonceSucces = $derived(form?.succes ?? '');
	const annonceEchec = $derived(form && !form.succes ? (form.message ?? 'La publication contient des erreurs.') : '');

	const agir = $derived(data.estPersonne === true && !data.mur.lectureSeule);
	const retour = (id: number) => (form?.cible === `publication:${id}` ? form : undefined);
	const suite = $derived(data.plusAnciennes);
	// « Alice Martin, Bruno Petit et Chloé Roux »
	const fetes = $derived(new Intl.ListFormat('fr', { type: 'conjunction' }).format(data.anniversaires.map((a) => `${a.prenom} ${a.nom}`.trim())));

	// La tuile du mur dans la liste donne son icône et sa couleur, avec les mêmes règles.
	const s = $derived(data.sections);
	const tuile = $derived([s.centre, ...s.groupes, ...s.autres, ...s.supervision].find((t) => t?.cle === data.mur.cle) ?? { icone: null, couleur: null, numero: null });
	const teinte = $derived(teinteDuMur(data.mur.type, tuile));
	const phrase = $derived(phraseDuMur(data.mur.type, data.sienne));
	// Gyro du bravo s'anime une fois, sur le premier bravo seulement.
	const premierBravo = $derived([...data.epinglees, ...data.publications].find((p) => p.type === 'bravo')?.id);
</script>

<svelte:head>
	<title>{data.mur.nom} · Échanges · Gyro Caserne</title>
</svelte:head>

<header class="bande" class:centre={data.mur.type === 'centre'} style:--bande-fond={teinte.fond} style:--bande-encre={teinte.encre}>
	<Retour href="/echanges" libelle="Tous les murs" />
	<div class="identite">
		<span class="embleme"><PastilleMur icone={tuile.icone} couleur={tuile.couleur} numero={tuile.numero} /></span>
		<div class="titres">
			<h1 id="titre-mur" tabindex="-1">{data.mur.nom}</h1>
			{#if phrase}<p class="phrase">{phrase}</p>{/if}
		</div>
		{#if data.mur.lectureSeule}<Pastille ton="neutre">Lecture seule</Pastille>{/if}
		{#if data.coupe !== null && data.coupe !== undefined}<CouperNotifications coupe={data.coupe} nom={data.mur.nom} />{/if}
	</div>
	<p class="audience">
		<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
		{phraseAudience(data.mur.type, data.mur.nom, data.audience)}
	</p>
</header>

{#if data.anniversaires.length > 0}<p class="anniversaires">Bon anniversaire à {fetes} !</p>{/if}

<div class="annonce" role="status">{annonceSucces}</div>
<div class="annonce" role="alert">{annonceEchec}</div>

{#if data.epinglees.length > 0}
	<section aria-labelledby="titre-epinglees" class="liste">
		<h2 id="titre-epinglees">Épinglées</h2>
		{#each data.epinglees as p (p.id)}<Publication {p} equipes={data.equipes} retour={retour(p.id)} {agir} lectureSeule={data.mur.lectureSeule} messagerie={data.messagerie} animer={p.id === premierBravo} />{/each}
	</section>
{/if}

<section aria-labelledby="titre-publications" class="liste">
	<h2 id="titre-publications">{suite ? 'Publications plus anciennes' : 'Publications'}</h2>
	{#each data.publications as p (p.id)}
		<Publication {p} equipes={data.equipes} retour={retour(p.id)} {agir} lectureSeule={data.mur.lectureSeule} messagerie={data.messagerie} animer={p.id === premierBravo} />
	{:else}
		<Vide texte={suite ? 'Aucune publication plus ancienne.' : 'Rien n’a encore été publié ici.'} />
	{/each}
	<p class="pages" class:sous-le-lien={data.mur.peutPublier}>
		{#if data.suite !== null}<a href="?avant={data.suite}">Voir plus</a>{/if}
		{#if suite}<a href="/echanges/{data.mur.cle}">Revenir aux plus récentes</a>{/if}
	</p>
</section>

{#if data.mur.peutPublier}
	<a class="aller-publier" href="/echanges/publier?mur={encodeURIComponent(data.mur.cle)}">
		<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
		<span class="libelle">Publier dans {data.mur.nom}</span>
	</a>
{:else if data.mur.lectureSeule}
	<p class="aide">Ce mur est en lecture seule : on n’y publie plus.</p>
{:else}
	<p class="aide">Vous lisez ce mur ; seuls ses modérateurs y publient.</p>
{/if}

<style>
	/* La bande du mur, à sa couleur. Au téléphone, elle va d'un bord à l'autre. */
	.bande {
		--retour-couleur: currentColor;
		display: flex;
		flex-direction: column;
		gap: var(--espace-12);
		margin: -1rem -1rem var(--espace-16);
		padding: var(--espace-8) var(--espace-16) var(--espace-16);
		background: var(--bande-fond);
		color: var(--bande-encre);
	}
	.identite {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--espace-12);
	}
	/* Un cadre clair détache la pastille de la bande, qui est de la même teinte. */
	.embleme {
		display: inline-flex;
		padding: 2px;
		border-radius: var(--rayon-grand);
		background: color-mix(in srgb, var(--surface) 65%, transparent);
	}
	.centre .embleme {
		background: color-mix(in srgb, var(--sur-rouge) 22%, transparent);
	}
	.titres {
		flex: 1;
		min-width: 0;
	}
	h1 {
		margin: 0;
		font: 700 var(--texte-30)/1.1 var(--police-titre);
		overflow-wrap: anywhere;
	}
	.phrase {
		margin: 2px 0 0;
		font-size: var(--texte-15);
	}
	.audience {
		margin: 0;
		display: flex;
		align-items: center;
		gap: var(--espace-8);
		padding: var(--espace-8) var(--espace-12);
		border-radius: var(--rayon-bouton);
		background: color-mix(in srgb, var(--surface) 55%, transparent);
		font-size: var(--texte-14);
		font-weight: 500;
	}
	.audience svg {
		flex: none;
	}
	.centre .audience {
		background: rgba(0, 0, 0, 0.18);
	}
	h2 {
		margin: 0;
		font: 700 var(--texte-18)/1.2 var(--police-titre);
		color: var(--encre);
	}
	.liste {
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
		margin-bottom: var(--espace-20);
	}
	.pages {
		display: flex;
		flex-wrap: wrap;
		gap: var(--espace-16);
		margin: 0;
	}
	.pages a {
		display: inline-flex;
		align-items: center;
		min-height: var(--cible);
		color: var(--encre);
		font-weight: 600;
	}
	/* Laisse « Voir plus » et la dernière publication dégagés du lien flottant. */
	.sous-le-lien {
		padding-bottom: 4rem;
	}
	.aide {
		color: var(--doux);
	}
	.anniversaires {
		margin: 0 0 var(--espace-16);
		padding: var(--espace-12) var(--espace-16);
		border-radius: var(--rayon-grand);
		border: 1px solid var(--statut-alerte-trait);
		background: var(--statut-alerte-fond);
		color: var(--statut-alerte-texte);
		font-weight: 600;
	}
	.annonce {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	/* « Publier » à portée de pouce, au-dessus de la barre d'onglets. */
	.aller-publier {
		position: fixed;
		right: 1rem;
		bottom: calc(4.5rem + env(safe-area-inset-bottom));
		z-index: 5;
		max-width: calc(100vw - 2rem);
		min-height: 48px;
		display: inline-flex;
		align-items: center;
		gap: var(--espace-6);
		padding: 0 var(--espace-20) 0 var(--espace-16);
		border-radius: var(--rayon-bouton);
		background: var(--rouge);
		color: var(--sur-rouge);
		font-weight: 700;
		text-decoration: none;
	}
	@media (hover: hover) and (pointer: fine) {
		.aller-publier:hover {
			background: var(--rouge-survol);
		}
	}
	.aller-publier svg {
		flex: none;
	}
	.libelle {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	@media (min-width: 640px) {
		.bande {
			margin: 0 0 var(--espace-20);
			border-radius: var(--rayon-grand);
			padding: var(--espace-12) var(--espace-20) var(--espace-20);
		}
	}
	@media (min-width: 1024px) {
		.bande :global(.retour) {
			display: none;
		}
		.bande {
			padding-top: var(--espace-20);
		}
		.aller-publier {
			bottom: 1.5rem;
			right: 1.5rem;
		}
	}
</style>
