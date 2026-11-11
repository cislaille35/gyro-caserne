<script lang="ts">
	import { deNom, heure } from '#lib/murs/quand.ts';
	import Retour from '#lib/ui/Retour.svelte';
	import { formatDeDate } from '@gyro-caserne/socle/dates';
	import { enhance, type SubmitFunction } from '$app/forms';
	import { tick } from 'svelte';
	import type { Personne } from '@gyro-caserne/socle';
	import Bouton from '#lib/ui/Bouton.svelte';
	import Publication from '#lib/ui/Publication.svelte';

	let { data, form } = $props();

	const p = $derived(data.publication);
	const nom = (a: { prenom: string; nom: string }) => `${a.prenom} ${a.nom}`.trim();
	const quand = (iso: string) => `${formatDeDate({ day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${iso.slice(0, 16)}:00Z`))}, ${heure(iso)}`;
	const agir = $derived(data.estPersonne === true && !data.mur.lectureSeule);
	// Une seule zone annoncée par page, pour toutes les réponses des formulaires.
	const annonceSucces = $derived(form?.succes ?? '');
	const annonceEchec = $derived(form && !form.succes ? (form.message ?? '') : '');
	const retour = $derived(form?.cible === `publication:${p.id}` ? form : undefined);
	const prise = $derived(data.suivi?.priseDeConnaissance);
	// « 31 ont pris connaissance, 4 pas encore. »
	const bilan = $derived(
		prise
			? `${prise.faite.length} ${prise.faite.length > 1 ? 'ont' : 'a'} pris connaissance, ${prise.manquante.length > 0 ? `${prise.manquante.length} pas encore.` : 'personne d’autre n’est attendu.'}`
			: ''
	);
	const CATEGORIES = [
		['present', 'Présents'],
		['absent', 'Absents'],
		['incertain', 'Incertains'],
		['sans_reponse', 'Sans réponse']
	] as const;

	// Commentaire refusé : le champ reprend le focus pour corriger. Publié : le nouveau commentaire, sinon le titre de la liste,
	// sinon le contenu (publication supprimée entre-temps).
	let champ = $state<HTMLTextAreaElement>();
	const surCommentaire: SubmitFunction = () => async ({ result, update }) => {
		await update();
		await tick();
		if (result.type === 'failure') champ?.focus();
		else if (result.type === 'success') (document.getElementById(`commentaire-${result.data?.id}`) ?? document.getElementById('titre-commentaires') ?? document.getElementById('contenu'))?.focus();
	};
	// Commentaire supprimé : son bouton a disparu, le focus revient au titre de la liste.
	let titre = $state<HTMLElement>();
	const surSuppression: SubmitFunction = () => async ({ update }) => {
		await update();
		if (!document.activeElement?.isConnected || document.activeElement === document.body) titre?.focus();
	};
</script>

<svelte:head>
	<title>Publication {deNom(nom(p.auteur))} · {data.mur.nom} · Gyro Caserne</title>
</svelte:head>

<div class="vers-mur"><Retour href="/echanges/{data.mur.cle}" libelle={data.mur.nom} /></div>
<h1>Publication {deNom(nom(p.auteur))}</h1>

<div class="annonce" role="status">{annonceSucces}</div>
<div class="annonce" role="alert">{annonceEchec}</div>

<Publication {p} equipes={data.equipes} {retour} {agir} lectureSeule={data.mur.lectureSeule} messagerie={data.messagerie} seule animer />

<section aria-labelledby="titre-commentaires" class="bloc">
	<h2 id="titre-commentaires" tabindex="-1" bind:this={titre}>Commentaires ({data.commentaires.length})</h2>
	{#if data.commentaires.length > 0}
		<ul class="commentaires">
			{#each data.commentaires as c (c.id)}
				<li id="commentaire-{c.id}" tabindex="-1">
					<p><span class="auteur">{nom(c.auteur)}</span> <span class="doux">· le {quand(c.creeLe)}</span></p>
					<p class="texte">{c.texte}</p>
					{#if c.supprimable}
						<form method="POST" action="?/supprimerCommentaire" use:enhance={surSuppression}>
							<input type="hidden" name="id" value={p.id} />
							<input type="hidden" name="commentaire" value={c.id} />
							<button type="submit" class="petit" aria-label="Supprimer le commentaire de {nom(c.auteur)}">Supprimer</button>
						</form>
					{/if}
				</li>
			{/each}
		</ul>
	{:else}
		<p class="doux">Aucun commentaire pour l’instant.</p>
	{/if}

	{#if data.mur.lectureSeule}
		<p class="doux">Ce mur est en lecture seule : on n’y commente plus.</p>
	{:else if p.commentairesFermes}
		<p class="doux">Les commentaires sont fermés.</p>
	{:else}
		<form method="POST" action="?/commenter" id="commenter" class="formulaire" use:enhance={surCommentaire}>
			<input type="hidden" name="id" value={p.id} />
			<label for="texte-commentaire">Votre commentaire</label>
			<textarea id="texte-commentaire" name="texte" rows="3" maxlength="2000" required bind:this={champ} value={retour?.valeurs?.texte ?? ''}></textarea>
			<Bouton type="submit">Commenter</Bouton>
		</form>
	{/if}
</section>

{#snippet listeNoms(liste: Personne[])}
	{#if liste.length === 0}<p>personne</p>{:else}<ul class="noms" role="list">{#each liste as x (x.id)}<li>{nom(x)}</li>{/each}</ul>{/if}
{/snippet}

{#if data.suivi}
	<section id="suivi" aria-labelledby="titre-suivi" class="bloc">
		<h2 id="titre-suivi">Suivi</h2>
		{#if prise}
			<p>{bilan}</p>
			{#if prise.faite.length > 0}
				<details class="repli">
					<summary>Qui a pris connaissance</summary>
					{@render listeNoms(prise.faite)}
				</details>
			{/if}
			{#if prise.manquante.length > 0}
				<details class="repli">
					<summary>Qui n’a pas encore pris connaissance</summary>
					{@render listeNoms(prise.manquante)}
				</details>
			{/if}
		{/if}
		{#if data.suivi.evenement}
			<dl class="categories">
				{#each CATEGORIES as [cle, libelle] (cle)}
					<div>
						<dt>{libelle} ({data.suivi.evenement[cle].length})</dt>
						<dd>{@render listeNoms(data.suivi.evenement[cle])}</dd>
					</div>
				{/each}
			</dl>
		{/if}
	</section>
{/if}

<style>
	.noms {
		margin: 0;
		padding: 0;
		list-style: none;
		columns: 12rem auto;
		column-gap: var(--espace-16);
	}
	.noms li {
		break-inside: avoid;
		padding-block: 2px;
	}
	.vers-mur {
		display: flex;
		margin-bottom: var(--espace-8);
	}
	h1 {
		margin: 0 0 var(--espace-16);
		font: 700 var(--texte-24) var(--police-titre);
	}
	h2 {
		margin: 0;
		font: 700 var(--texte-20) var(--police-titre);
	}
	.bloc {
		display: flex;
		flex-direction: column;
		gap: var(--espace-12);
		margin-top: var(--espace-20);
	}
	p,
	dl,
	ul {
		margin: 0;
	}
	.commentaires {
		list-style: none;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--espace-12);
	}
	.commentaires li {
		padding: var(--espace-12) var(--espace-12);
		border: 1px solid var(--trait-doux);
		border-radius: var(--rayon-petit);
		background: var(--surface);
		display: flex;
		flex-direction: column;
		gap: var(--espace-4);
	}
	.auteur {
		font-weight: 700;
	}
	.doux {
		color: var(--doux);
	}
	.texte {
		white-space: pre-line;
		overflow-wrap: anywhere;
	}
	.petit {
		align-self: flex-start;
		min-height: var(--cible);
		padding: 0 var(--espace-16);
		border: 1px solid var(--trait);
		border-radius: var(--rayon-petit);
		background: transparent;
		color: var(--encre);
		font: 600 var(--texte-15) var(--police);
		cursor: pointer;
	}
	.formulaire {
		display: flex;
		flex-direction: column;
		gap: var(--espace-8);
	}
	.formulaire > :global(button) {
		align-self: flex-start;
	}
	label {
		font-weight: 600;
	}
	textarea {
		padding: var(--espace-12) var(--espace-16);
		background: var(--surface);
		color: var(--encre);
		font: 400 var(--texte-16) var(--police);
	}
	summary {
		min-height: var(--cible);
		display: flex;
		align-items: center;
		font-weight: 600;
		cursor: pointer;
	}
	.categories {
		display: grid;
		gap: var(--espace-8);
	}
	dt {
		font-weight: 700;
	}
	dd {
		margin: 0;
	}
	.annonce {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
