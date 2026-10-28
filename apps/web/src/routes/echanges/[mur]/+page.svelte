<script lang="ts">
	import { onMount } from 'svelte';
	import FormulairePublication from '#lib/ui/FormulairePublication.svelte';
	import Pastille from '#lib/ui/Pastille.svelte';
	import Publication from '#lib/ui/Publication.svelte';
	import Vide from '#lib/ui/Vide.svelte';

	let { data, form } = $props();

	// Le lien flottant « Publier » s'efface quand le formulaire est à l'écran.
	let formulaireVisible = $state(false);
	onMount(() => {
		const cible = document.getElementById('publier');
		if (!cible || typeof IntersectionObserver !== 'function') return;
		const observateur = new IntersectionObserver(([e]) => (formulaireVisible = e!.isIntersecting));
		observateur.observe(cible);
		return () => observateur.disconnect();
	});
	// Une seule zone annoncée par page, pour toutes les réponses des formulaires.
	const annonceSucces = $derived(form?.succes ?? '');
	const annonceEchec = $derived(form && !form.succes ? (form.message ?? 'La publication contient des erreurs.') : '');

	const agir = $derived(data.estPersonne === true && !data.mur.lectureSeule);
	const retour = (id: number) => (form?.cible === `publication:${id}` ? form : undefined);
	const suite = $derived(data.plusAnciennes);
	// « Alice Martin, Bruno Petit et Chloé Roux »
	const fetes = $derived(new Intl.ListFormat('fr', { type: 'conjunction' }).format(data.anniversaires.map((a) => `${a.prenom} ${a.nom}`.trim())));
</script>

<svelte:head>
	<title>{data.mur.nom} · Échanges · Gyro Caserne</title>
</svelte:head>

<p class="retour"><a href="/echanges">‹ Tous les murs</a></p>
<header class="titre">
	<h1>{data.mur.nom}</h1>
	{#if data.mur.lectureSeule}<Pastille ton="neutre">Lecture seule</Pastille>{/if}
</header>

{#if data.anniversaires.length > 0}<p class="anniversaires">Bon anniversaire à {fetes} !</p>{/if}

<div class="annonce" role="status">{annonceSucces}</div>
<div class="annonce" role="alert">{annonceEchec}</div>
{#if form?.cible === 'publication' && form.message}<p class="echec">{form.message}</p>{/if}

{#if data.epinglees.length > 0}
	<section aria-labelledby="titre-epinglees" class="liste">
		<h2 id="titre-epinglees">Épinglées</h2>
		{#each data.epinglees as p (p.id)}<Publication {p} equipes={data.equipes} retour={retour(p.id)} {agir} lectureSeule={data.mur.lectureSeule} />{/each}
	</section>
{/if}

<section aria-labelledby="titre-publications" class="liste">
	<h2 id="titre-publications">{suite ? 'Publications plus anciennes' : 'Publications'}</h2>
	{#each data.publications as p (p.id)}
		<Publication {p} equipes={data.equipes} retour={retour(p.id)} {agir} lectureSeule={data.mur.lectureSeule} />
	{:else}
		<Vide texte={suite ? 'Aucune publication plus ancienne.' : 'Rien n’a encore été publié ici.'} />
	{/each}
	<p class="pages" class:sous-le-lien={data.mur.peutPublier}>
		{#if data.suite !== null}<a href="?avant={data.suite}">Voir plus</a>{/if}
		{#if suite}<a href="/echanges/{data.mur.cle}">Revenir aux plus récentes</a>{/if}
	</p>
</section>

{#if data.mur.peutPublier}
	<FormulairePublication mur={data.mur} equipes={data.equipes} {form} />
	<a class="aller-publier" href="#publier" hidden={formulaireVisible}>Publier</a>
{:else if data.mur.lectureSeule}
	<p class="aide">Ce mur est en lecture seule : on n’y publie plus.</p>
{:else}
	<p class="aide">Vous lisez ce mur ; seuls ses modérateurs y publient.</p>
{/if}

<style>
	.retour {
		margin: 0 0 8px;
	}
	.retour a,
	.pages a {
		display: inline-flex;
		align-items: center;
		min-height: var(--cible);
		color: var(--encre);
		font-weight: 600;
	}
	.titre {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
		margin-bottom: 16px;
	}
	h1 {
		margin: 0;
		font: 700 1.75rem var(--police-titre);
	}
	h2 {
		margin: 0;
		font: 700 1.25rem var(--police-titre);
	}
	.liste {
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin-bottom: 20px;
	}
	.pages {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		margin: 0;
	}
	/* Laisse « Voir plus » et la dernière publication dégagés du lien flottant. */
	.sous-le-lien {
		padding-bottom: 4rem;
	}
	.aide {
		color: var(--doux);
	}
	.anniversaires {
		margin: 0 0 16px;
		padding: 12px 16px;
		border-radius: var(--rayon-petit);
		border: 1px solid var(--trait-doux);
		background: var(--surface);
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
	.aller-publier[hidden] {
		display: none;
	}
	.echec {
		padding: 12px 16px;
		border-radius: var(--rayon-petit);
		border: 2px solid var(--accent);
		font-weight: 600;
	}
	/* « Publier » à portée de pouce, au-dessus de la barre d'onglets. */
	.aller-publier {
		position: fixed;
		right: 1rem;
		bottom: calc(4.5rem + env(safe-area-inset-bottom));
		z-index: 5;
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		padding: 0 22px;
		border-radius: 999px;
		border: 2px solid var(--encre);
		background: var(--rouge);
		color: var(--sur-rouge);
		font-weight: 700;
		text-decoration: none;
	}
	@media (min-width: 1024px) {
		.retour {
			display: none;
		}
		.aller-publier {
			bottom: 1.5rem;
			right: 1.5rem;
		}
	}
</style>
