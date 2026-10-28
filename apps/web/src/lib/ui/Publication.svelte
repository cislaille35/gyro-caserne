<script lang="ts">
	import type { PublicationVue } from '@gyro-caserne/socle';
	import { enhance, type SubmitFunction } from '$app/forms';
	import Bouton from './Bouton.svelte';
	import Pastille from './Pastille.svelte';

	let {
		p,
		equipes = [],
		retour,
		agir = false,
		lectureSeule = false,
		seule = false
	}: {
		p: PublicationVue;
		equipes?: { id: number; nom: string }[];
		retour?: { succes?: string; message?: string };
		// `agir` : la personne peut aimer, répondre, voter (elle a une fiche et le mur n'est pas en lecture seule).
		agir?: boolean;
		lectureSeule?: boolean;
		// Sur la page de la publication : ses commentaires y sont en entier, la modération reste sur le mur.
		seule?: boolean;
	} = $props();

	const TYPES = { message: null, annonce: 'Annonce', evenement: 'Événement', bravo: 'Bravo' } as const;
	const REPONSES = [
		['present', 'Présent'],
		['absent', 'Absent'],
		['incertain', 'Incertain']
	] as const;
	// Les dates sont enregistrées à l'heure de Paris : on les lit telles quelles.
	const date = (iso: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fr-FR', { ...options, timeZone: 'UTC' }).format(new Date(`${iso.slice(0, 16)}:00Z`));
	const quand = (iso: string) => date(iso, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
	const debut = (iso: string) => date(iso, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
	const nom = (a: { prenom: string; nom: string }) => `${a.prenom} ${a.nom}`.trim();
	const auteur = $derived(nom(p.auteur));
	const convoques = $derived(
		!p.evenement || p.evenement.convoques === 'tous' ? 'tout le mur' : p.evenement.convoques.map((id) => equipes.find((e) => e.id === id)?.nom ?? 'équipe archivée').join(', ')
	);
	const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;
	const total = $derived(p.sondage ? p.sondage.resultats.reduce((a, b) => a + b, 0) : 0);
	const pourcent = (n: number) => (total === 0 ? 0 : Math.round((n * 100) / total));
	const lien = $derived(`/echanges/${p.cle}/${p.id}`);
	const auteurDeLAnnonce = $derived(p.droits.modifier);

	// Après un geste, le focus reste sur son bouton ; si le bouton a disparu (vote, prise de connaissance), il revient à la publication.
	let carte = $state<HTMLElement>();
	const garderFocus: SubmitFunction = () => async ({ update }) => {
		await update();
		if (document.activeElement === document.body || !document.activeElement?.isConnected) carte?.focus();
	};
</script>

<article class="publication" aria-labelledby="auteur-{p.id}" tabindex="-1" bind:this={carte}>
	<p class="entete">
		<span id="auteur-{p.id}" class="auteur">{auteur}</span>
		<span class="doux">· le {quand(p.creeLe)}{p.modifieeLe ? ' · modifiée' : ''}</span>
		{#if p.epinglee}<Pastille ton="info">Épinglée</Pastille>{/if}
		{#if TYPES[p.type]}<Pastille ton={p.type === 'bravo' ? 'ok' : p.type === 'annonce' ? 'alerte' : 'neutre'}>{TYPES[p.type]}</Pastille>{/if}
	</p>

	<p class="texte">{p.texte}</p>

	{#if p.evenement}
		<dl class="evenement">
			<div><dt>Quand</dt><dd>{debut(p.evenement.debut)}</dd></div>
			<div><dt>Où</dt><dd>{p.evenement.lieu}</dd></div>
			<div><dt>Convoqués</dt><dd>{convoques}{p.evenement.convoque ? ' (vous l’êtes)' : ''}</dd></div>
		</dl>
		<p class="doux">
			Réponses : {pluriel(p.evenement.compte.present, 'présent')}, {pluriel(p.evenement.compte.absent, 'absent')}, {pluriel(p.evenement.compte.incertain, 'incertain')}
		</p>
		{#if agir && p.evenement.convoque}
			<form method="POST" action="?/repondre" class="choix" use:enhance={garderFocus}>
				<input type="hidden" name="id" value={p.id} />
				<p id="reponse-{p.id}" class="question">Votre réponse</p>
				<div role="group" aria-labelledby="reponse-{p.id}" class="boutons">
					{#each REPONSES as [valeur, libelle] (valeur)}
						<button type="submit" class="bascule" name="reponse" value={valeur} aria-pressed={p.evenement.reponse === valeur}>{libelle}</button>
					{/each}
				</div>
			</form>
		{/if}
	{/if}

	{#if p.sondage}
		<div class="sondage">
			<p class="question" id="question-{p.id}">Sondage : {p.sondage.question}</p>
			{#if agir && p.sondage.vote === null}
				<form method="POST" action="?/voter" use:enhance={garderFocus}>
					<input type="hidden" name="id" value={p.id} />
					<div role="group" aria-labelledby="question-{p.id}" class="boutons">
						{#each p.sondage.reponses as reponse, i (i)}
							<button type="submit" class="bascule" name="reponse" value={i}>{reponse}</button>
						{/each}
					</div>
				</form>
			{:else}
				<ul class="resultats">
					{#each p.sondage.reponses as reponse, i (i)}
						{@const n = p.sondage.resultats[i] ?? 0}
						<li>
							<span>{reponse} : {n} voix, {pourcent(n)} %{p.sondage.vote === i ? ' (votre choix)' : ''}</span>
							<span class="barre" class:choisie={p.sondage.vote === i} aria-hidden="true"><span style="width: {pourcent(n)}%"></span></span>
						</li>
					{/each}
				</ul>
				{#if agir}
					<details>
						<summary>Changer mon vote</summary>
						<form method="POST" action="?/voter" use:enhance={garderFocus}>
							<input type="hidden" name="id" value={p.id} />
							<div role="group" aria-labelledby="question-{p.id}" class="boutons">
								{#each p.sondage.reponses as reponse, i (i)}
									<button type="submit" class="bascule" name="reponse" value={i} aria-pressed={p.sondage.vote === i}>{reponse}</button>
								{/each}
							</div>
						</form>
					</details>
				{/if}
			{/if}
			<p class="doux">{pluriel(total, 'réponse')}</p>
		</div>
	{/if}

	{#if p.priseDeConnaissance}
		{#if p.priseDeConnaissance.le}
			<p class="fait">Vous avez pris connaissance le {quand(p.priseDeConnaissance.le)}.</p>
		{:else if agir && !auteurDeLAnnonce}
			<form method="POST" action="?/prendreConnaissance" class="choix" use:enhance={garderFocus}>
				<input type="hidden" name="id" value={p.id} />
				<p class="doux">Votre prise de connaissance est demandée.</p>
				<Bouton type="submit">Pris connaissance</Bouton>
			</form>
		{:else}
			<p class="doux">Prise de connaissance demandée.</p>
		{/if}
	{/if}

	{#if p.photos.length > 0}
		<ul class="photos">
			{#each p.photos as id, i (id)}
				<li><img src="/echanges/photo/{id}" alt="Photo {i + 1} sur {p.photos.length}, publiée par {auteur}" loading="lazy" /></li>
			{/each}
		</ul>
	{/if}

	<div class="reactions">
		{#if agir}
			<form method="POST" action="?/aimer" use:enhance={garderFocus}>
				<input type="hidden" name="id" value={p.id} />
				<input type="hidden" name="oui" value={p.jaimeParMoi ? '0' : '1'} />
				<button type="submit" class="bascule" aria-pressed={p.jaimeParMoi}>J’aime <span class="nombre">{p.jaime}</span></button>
			</form>
			<p class="doux">{pluriel(p.commentaires, 'commentaire')}{p.commentairesFermes ? ' · commentaires fermés' : ''}</p>
		{:else}
			<p class="doux">{p.jaime} j’aime · {pluriel(p.commentaires, 'commentaire')}{p.commentairesFermes ? ' · commentaires fermés' : ''}</p>
		{/if}
	</div>

	{#if !seule}
		{#if p.derniersCommentaires.length > 0}
			<ul class="commentaires" aria-label="Derniers commentaires">
				{#each p.derniersCommentaires as c (c.id)}
					<li><span class="auteur">{nom(c.auteur)}</span> <span class="doux">· le {quand(c.creeLe)}</span><p class="texte">{c.texte}</p></li>
				{/each}
			</ul>
		{/if}
		<p class="liens">
			{#if p.commentaires > 2}
				<a href={lien}>Voir les {p.commentaires} commentaires</a>
			{:else if !p.commentairesFermes && !lectureSeule}
				<a href="{lien}#commenter">Commenter</a>
			{/if}
			{#if p.droits.supprimer && (p.priseDeConnaissance || p.evenement)}<a href="{lien}#suivi">Voir le suivi</a>{/if}
		</p>
	{/if}

	<!-- Annoncé par la zone unique de la page ; ici, seulement visible. -->
	{#if retour?.succes}<p class="succes">{retour.succes}</p>{/if}
	{#if retour?.message}<p class="echec">{retour.message}</p>{/if}

	{#if p.droits.fermer || (!seule && (p.droits.epingler || p.droits.modifier || p.droits.supprimer))}
		<div class="gestes">
			{#if p.droits.fermer}
				<form method="POST" action="?/fermerCommentaires" use:enhance={garderFocus}>
					<input type="hidden" name="id" value={p.id} />
					<input type="hidden" name="oui" value={p.commentairesFermes ? '0' : '1'} />
					<Bouton type="submit" variante="secondaire">{p.commentairesFermes ? 'Rouvrir les commentaires' : 'Fermer les commentaires'}</Bouton>
				</form>
			{/if}
			{#if !seule && p.droits.epingler}
				<form method="POST" action="?/epingler">
					<input type="hidden" name="id" value={p.id} />
					<input type="hidden" name="oui" value={p.epinglee ? '0' : '1'} />
					<Bouton type="submit" variante="secondaire">{p.epinglee ? 'Retirer l’épingle' : 'Épingler'}</Bouton>
				</form>
			{/if}
			{#if !seule && p.droits.modifier}
				<details>
					<summary>Modifier</summary>
					<form method="POST" action="?/modifier" class="formulaire">
						<input type="hidden" name="id" value={p.id} />
						<label for="modifier-{p.id}">Texte</label>
						<textarea id="modifier-{p.id}" name="texte" rows="4" maxlength="4000" required value={p.texte}></textarea>
						<Bouton type="submit">Enregistrer</Bouton>
					</form>
				</details>
			{/if}
			{#if !seule && p.droits.supprimer}
				<details>
					<summary>Supprimer</summary>
					<form method="POST" action="?/supprimer" class="formulaire">
						<input type="hidden" name="id" value={p.id} />
						<p>La publication, ses photos et ses commentaires seront supprimés.</p>
						<Bouton type="submit" variante="secondaire">Confirmer la suppression</Bouton>
					</form>
				</details>
			{/if}
		</div>
	{/if}
</article>

<style>
	.publication {
		background: var(--surface);
		border: 1px solid var(--trait-doux);
		border-radius: var(--rayon-grand);
		padding: 14px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	p,
	dl,
	ul {
		margin: 0;
	}
	.entete {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		font-size: 0.9375rem;
	}
	.auteur {
		font-weight: 700;
	}
	.doux {
		color: var(--doux);
		font-size: 0.9375rem;
	}
	/* Le texte reste du texte : ses retours à la ligne sont gardés, rien n'est interprété. */
	.texte {
		white-space: pre-line;
		overflow-wrap: anywhere;
		font-size: 1.0625rem;
	}
	.evenement {
		display: grid;
		gap: 4px;
		padding: 10px 12px;
		border-left: 4px solid var(--trait);
		background: var(--fond);
		border-radius: var(--rayon-petit);
	}
	.evenement div {
		display: flex;
		gap: 8px;
	}
	dt {
		font-weight: 700;
		min-width: 6rem;
	}
	dd {
		margin: 0;
	}
	.question {
		font-weight: 600;
	}
	.sondage {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.resultats {
		list-style: none;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	/* La barre double le texte, qui porte les nombres. */
	.barre {
		display: block;
		height: 8px;
		margin-top: 2px;
		border-radius: 4px;
		background: var(--fond);
		border: 1px solid var(--trait);
		overflow: hidden;
	}
	.barre > span {
		display: block;
		height: 100%;
		background: var(--doux);
	}
	.barre.choisie > span {
		background: var(--encre);
	}
	.choix {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.choix > :global(button) {
		align-self: flex-start;
	}
	.boutons,
	.reactions,
	.liens {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 12px;
	}
	/* Bouton à bascule : l'état appuyé se lit aussi par la coche, pas seulement par la couleur. */
	.bascule {
		min-height: var(--cible);
		min-width: var(--cible);
		padding: 0 16px;
		border: 2px solid var(--trait);
		border-radius: var(--rayon-petit);
		background: transparent;
		color: var(--encre);
		font: 600 1rem var(--police);
		cursor: pointer;
	}
	.bascule[aria-pressed='true'] {
		border-color: var(--encre);
		background: var(--fond);
		font-weight: 700;
	}
	/* La coche n'est pas lue : l'état « appuyé » l'est déjà. */
	.bascule[aria-pressed='true']::before {
		content: '✓ ';
		content: '✓ ' / '';
	}
	.nombre {
		margin-left: 4px;
	}
	.liens a {
		display: inline-flex;
		align-items: center;
		min-height: var(--cible);
		color: var(--encre);
		font-weight: 600;
	}
	.commentaires {
		list-style: none;
		padding: 0 0 0 12px;
		border-left: 3px solid var(--trait);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.commentaires .texte {
		font-size: 1rem;
	}
	.fait {
		font-weight: 600;
	}
	.publication:focus-visible {
		outline: 3px solid var(--encre);
		outline-offset: 2px;
	}
	.photos {
		list-style: none;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 6px;
	}
	.photos img {
		display: block;
		width: 100%;
		aspect-ratio: 4 / 3;
		object-fit: cover;
		border-radius: var(--rayon-petit);
		background: var(--fond);
	}
	.gestes {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 8px;
	}
	summary {
		min-height: var(--cible);
		display: flex;
		align-items: center;
		padding: 0 14px;
		border: 2px solid var(--trait);
		border-radius: var(--rayon-petit);
		font-weight: 600;
		cursor: pointer;
	}
	details[open] {
		flex-basis: 100%;
	}
	.formulaire {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding-top: 8px;
	}
	.formulaire > :global(button) {
		align-self: flex-start;
	}
	label {
		font-weight: 600;
	}
	textarea {
		padding: 10px 14px;
		border: 2px solid var(--doux);
		border-radius: var(--rayon-petit);
		background: var(--surface);
		color: var(--encre);
		font: 400 1rem var(--police);
	}
	.echec,
	.succes {
		padding: 8px 12px;
		border-radius: var(--rayon-petit);
		border: 2px solid var(--accent);
		font-weight: 600;
	}
	.succes {
		border-color: var(--ok);
	}
</style>
