<script lang="ts">
	import { formatDeDate } from '@gyro-caserne/socle/dates';
	import { pluriel } from '#lib/pluriel.ts';
	import type { PublicationVue } from '@gyro-caserne/socle';
	import { enhance, type SubmitFunction } from '$app/forms';
	import GyroDuMoment from '#lib/gyro/GyroDuMoment.svelte';
	import { lireAffichageContexte } from '#lib/gyro/niveau.ts';
	import { heure, quand as quandBref } from '#lib/murs/quand.ts';
	import Bouton from './Bouton.svelte';
	import Pastille from './Pastille.svelte';
	import Sondage from './Sondage.svelte';
	import TuileDate from './TuileDate.svelte';
	import Visage from './Visage.svelte';

	let {
		p,
		equipes = [],
		retour,
		agir = false,
		lectureSeule = false,
		seule = false,
		animer = false,
		messagerie = false
	}: {
		p: PublicationVue;
		equipes?: { id: number; nom: string }[];
		retour?: { succes?: string; message?: string };
		// `agir` : la personne peut aimer, répondre, voter (elle a une fiche et le mur n'est pas en lecture seule).
		agir?: boolean;
		lectureSeule?: boolean;
		// Sur la page de la publication : ses commentaires y sont en entier, la modération reste sur le mur.
		seule?: boolean;
		// Gyro du bravo s'anime à l'arrivée : un seul par page.
		animer?: boolean;
		// La personne a la messagerie : « Répondre en privé » à l'auteur.
		messagerie?: boolean;
	} = $props();

	const affichage = lireAffichageContexte();
	const REPONSES = [
		['present', 'Présent'],
		['absent', 'Absent'],
		['incertain', 'Incertain']
	] as const;
	// Les dates sont enregistrées à l'heure de Paris : on les lit telles quelles.
	const date = (iso: string, options: Intl.DateTimeFormatOptions) => formatDeDate({ ...options, timeZone: 'UTC' }).format(new Date(`${iso.slice(0, 16)}:00Z`));
	const quand = (iso: string) => date(iso, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
	const nom = (a: { prenom: string; nom: string }) => `${a.prenom} ${a.nom}`.trim();
	const auteur = $derived(nom(p.auteur));
	const convoques = $derived(
		!p.evenement || p.evenement.convoques === 'tous' ? 'tout le mur' : p.evenement.convoques.map((id) => equipes.find((e) => e.id === id)?.nom ?? 'équipe archivée').join(', ')
	);
	const lien = $derived(`/echanges/${p.cle}/${p.id}`);
	const prive = $derived(messagerie && p.auteur.ecrireA !== null ? `/echanges/messages/a/${p.auteur.ecrireA}?publication=${p.id}` : null);
	const auteurDeLAnnonce = $derived(p.droits.modifier);
	const bravo = $derived(p.type === 'bravo');
	const prise = $derived(p.priseDeConnaissance);
	// « J'aime » devient « Applaudir » sur un bravo : même donnée.
	const aimer = $derived(bravo ? 'Applaudir' : 'J’aime');
	const aimes = $derived(bravo ? pluriel(p.jaime, 'applaudissement') : `${p.jaime} j’aime`);
	const commentaires = $derived(`${pluriel(p.commentaires, 'commentaire')}${p.commentairesFermes ? ' · commentaires fermés' : ''}`);

	// Après un geste, SvelteKit remet le focus en haut de la page : on le rend à son bouton ; si le bouton a disparu
	// (vote, prise de connaissance), à la publication.
	let carte = $state<HTMLElement>();
	const garderFocus: SubmitFunction = ({ submitter }) => async ({ update }) => {
		await update();
		if (submitter?.isConnected) submitter.focus();
		else carte?.focus();
	};
</script>

{#snippet signature()}
	<span class="doux">{p.auteur.role ? `${p.auteur.role} · ` : ''}<time datetime={p.creeLe}>{quandBref(p.creeLe)}</time>{p.modifieeLe ? ' · modifiée' : ''}</span>
{/snippet}

<article id="publication-{p.id}" class="publication {p.type}" class:a-confirmer={prise} aria-labelledby="auteur-{p.id}" tabindex="-1" bind:this={carte}>
	{#if prise}
		<p class="bandeau">
			<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16 3l5 5-4 1-4 4 1 5-2 2-4-4-5 5-1-1 5-5-4-4 2-2 5 1 4-4z" /></svg>
			{p.epinglee ? 'Épinglée · ' : ''}Annonce à lire et confirmer
		</p>
	{/if}
	{#if bravo && affichage.niveau !== 'sobre'}
		<svg class="confettis" aria-hidden="true" width="100%" height="120" viewBox="0 0 390 120" preserveAspectRatio="xMinYMin slice">
			<circle cx="30" cy="20" r="4" fill="#e3262b" /><rect x="300" y="14" width="10" height="5" rx="2" fill="#1d9bd8" transform="rotate(30 305 16)" />
			<circle cx="250" cy="30" r="3" fill="#62ad3f" /><rect x="120" y="8" width="10" height="5" rx="2" fill="#ec5fa6" transform="rotate(-20 125 10)" />
			<circle cx="360" cy="52" r="3" fill="#f4c400" /><rect x="190" y="40" width="9" height="4" rx="2" fill="#f4c400" transform="rotate(15 194 42)" />
		</svg>
	{/if}

	<div class="contenu">
		{#if bravo}
			<div class="tete-bravo">
				<GyroDuMoment tenue="victoire" taille={72} decoratif enMouvement={animer} />
				<span class="colonne">
					<span class="bravo-titre">Bravo !</span>
					<span><strong id="auteur-{p.id}">{auteur}</strong> {@render signature()}</span>
				</span>
				{#if p.epinglee}<Pastille ton="info">Épinglée</Pastille>{/if}
			</div>
		{:else}
			<p class="entete">
				<Visage prenom={p.auteur.prenom} nom={p.auteur.nom} couleur={p.auteur.couleur} />
				<span class="colonne">
					<strong id="auteur-{p.id}">{auteur}</strong>
					{@render signature()}
				</span>
				{#if p.epinglee && !prise}<Pastille ton="info">Épinglée</Pastille>{/if}
				{#if p.annulee}<Pastille ton="danger">Annulée</Pastille>{:else if p.type === 'evenement'}<Pastille ton="info">Événement</Pastille>{:else if p.type === 'annonce' && !prise}<Pastille ton="alerte">Annonce</Pastille>{/if}
			</p>
		{/if}

		{#if p.evenement}
			{@const e = p.evenement}
			<div class="rdv">
				<TuileDate iso={e.debut} />
				<span class="colonne">
					<strong class="texte titre-evenement">{p.texte}</strong>
					<span class="doux">{heure(e.debut)} · {e.lieu}</span>
					<span class="doux petit">Convoqués : {convoques}{e.convoque ? ' (vous l’êtes)' : ''}</span>
					{#if e.moment === 'enCours' && !p.annulee}<span><Pastille ton="ok">En cours</Pastille></span>{/if}
				</span>
			</div>
			<p class="presents">
				{#if e.presents.length > 0}
					<span class="visages">{#each e.presents as v, i (i)}<Visage prenom={v.prenom} nom={v.nom} couleur={v.couleur} taille={30} />{/each}</span>
				{/if}
				<span class="doux">{pluriel(e.compte.present, 'présent')}, {pluriel(e.compte.absent, 'absent')}, {pluriel(e.compte.incertain, 'incertain')}</span>
			</p>
			<!-- Commencé, on n'y répond plus (le serveur refuse). -->
			{#if agir && e.convoque && !p.annulee && e.moment === 'avenir'}
				<form method="POST" action="?/repondre" use:enhance={garderFocus}>
					<input type="hidden" name="id" value={p.id} />
					<div role="group" aria-label="Votre réponse" class="segments reponses">
						{#each REPONSES as [valeur, libelle] (valeur)}
							<button type="submit" name="reponse" value={valeur} aria-pressed={e.reponse === valeur}>{libelle}</button>
						{/each}
					</div>
				</form>
			{/if}
		{:else}
			<p class="texte">{p.texte}</p>
		{/if}

		{#if p.sondage}<Sondage id={p.id} sondage={p.sondage} {agir} {garderFocus} />{/if}

		{#if prise}
			{#if prise.attendues > 0}
				<p class="lecture">
					<span class="jauge" aria-hidden="true"><span style:width="{Math.round((prise.faites * 100) / prise.attendues)}%"></span></span>
					<span class="doux">{prise.faites} sur {prise.attendues} {prise.attendues === 1 ? 'a' : 'ont'} confirmé</span>
				</p>
			{/if}
			{#if prise.le}
				<p class="fait">Vous avez pris connaissance le {quand(prise.le)}.</p>
			{:else if agir && !auteurDeLAnnonce}
				<form method="POST" action="?/prendreConnaissance" use:enhance={garderFocus}>
					<input type="hidden" name="id" value={p.id} />
					<button type="submit" class="confirmer">J’ai pris connaissance</button>
				</form>
			{:else}
				<p class="doux">Prise de connaissance demandée.</p>
			{/if}
		{/if}
	</div>

	{#if p.photos.length > 0}
		<ul class="photos" class:une={p.photos.length === 1}>
			{#each p.photos as id, i (id)}
				<li><img src="/echanges/photo/{id}" alt="Photo {i + 1} sur {p.photos.length}, publiée par {auteur}" loading="lazy" /></li>
			{/each}
		</ul>
	{/if}

	<div class="pied">
		<div class="reactions">
			{#if agir}
				<form method="POST" action="?/aimer" use:enhance={garderFocus}>
					<input type="hidden" name="id" value={p.id} />
					<input type="hidden" name="oui" value={p.jaimeParMoi ? '0' : '1'} />
					<button type="submit" class="pilule aimer" aria-pressed={p.jaimeParMoi}>{aimer} · <span class="nombre">{p.jaime}</span></button>
				</form>
			{/if}
			{#if !seule}
				{#if p.commentaires > 2}
					<a class="pilule" href={lien}>Voir les {p.commentaires} commentaires</a>
				{:else if !p.commentairesFermes && !lectureSeule}
					<a class="pilule" href="{lien}#commenter">Commenter</a>
				{/if}
			{/if}
			{#if !agir || p.commentaires > 0 || p.commentairesFermes}<span class="doux">{agir ? commentaires : `${aimes} · ${commentaires}`}</span>{/if}
		</div>

		{#if !seule && p.derniersCommentaires.length > 0}
			<ul class="commentaires" aria-label="Derniers commentaires">
				{#each p.derniersCommentaires as c (c.id)}
					<li><span class="auteur">{nom(c.auteur)}</span> <span class="doux">· le {quand(c.creeLe)}</span><p class="texte">{c.texte}</p></li>
				{/each}
			</ul>
		{/if}

		<!-- Annoncé par la zone unique de la page ; ici, seulement visible. -->
		{#if retour?.succes}<p class="succes">{retour.succes}</p>{/if}
		{#if retour?.message}<p class="echec">{retour.message}</p>{/if}

		{#if prive || (!seule && p.droits.supprimer && (p.priseDeConnaissance || p.evenement)) || p.droits.fermer || (!seule && (p.droits.epingler || p.droits.modifier || p.droits.supprimer))}
			<details class="plus">
				<summary>Plus<span class="masque"> : gestes sur la publication</span></summary>
			<div class="gestes">
				{#if !seule && p.droits.supprimer && (p.priseDeConnaissance || p.evenement)}<a class="pilule" href="{lien}#suivi">Voir le suivi</a>{/if}
				{#if prive}<a class="pilule" href={prive} aria-label="Répondre en privé à {auteur}">Répondre en privé</a>{/if}
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
					<details class="repli">
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
					<details class="repli">
						<summary>Supprimer</summary>
						<form method="POST" action="?/supprimer" class="formulaire">
							<input type="hidden" name="id" value={p.id} />
							<p>La publication, ses photos et ses commentaires seront supprimés.</p>
							<Bouton type="submit" variante="grave">Confirmer la suppression</Bouton>
						</form>
					</details>
				{/if}
			</div>
			</details>
		{/if}
	</div>
</article>

<style>
	/* Les trois réponses, à parts égales, sur une ligne à 390 px. */
	.reponses {
		width: 100%;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}
	.reponses button {
		padding: 0 var(--espace-4);
	}
	.publication {
		position: relative;
		overflow: hidden;
		background: var(--surface);
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
		border-radius: var(--rayon-grand);
	}
	.contenu,
	.pied {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: var(--espace-12);
		padding: var(--espace-16);
	}
	.pied {
		padding-top: 0;
	}
	.photos + .pied {
		padding-top: var(--espace-12);
	}
	p,
	ul {
		margin: 0;
	}
	.colonne {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.entete {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--espace-6) var(--espace-12);
	}
	.entete .colonne {
		flex: 1;
	}
	.auteur {
		font-weight: 700;
	}
	.doux {
		color: var(--doux);
		font-size: var(--texte-14);
	}
	.entete .doux,
	.tete-bravo .doux {
		font-size: var(--texte-14);
	}
	/* Le texte reste du texte : ses retours à la ligne sont gardés, rien n'est interprété. */
	.texte {
		white-space: pre-line;
		overflow-wrap: anywhere;
		font-size: var(--texte-16);
		line-height: 1.45;
	}

	/* Annonce à lire et confirmer */
	.a-confirmer {
		border: 2px solid var(--statut-alerte-trait);
	}
	.bandeau {
		display: flex;
		align-items: center;
		gap: var(--espace-8);
		padding: var(--espace-8) var(--espace-16);
		background: var(--statut-alerte-fond);
		color: var(--statut-alerte-texte);
		font-size: var(--texte-14);
		font-weight: 700;
	}
	.lecture {
		display: flex;
		align-items: center;
		gap: var(--espace-12);
	}
	/* La jauge double le texte, qui porte les nombres. */
	.jauge {
		flex: 1;
		height: 8px;
		border-radius: 4px;
		background: var(--fond);
		overflow: hidden;
	}
	.jauge > span {
		display: block;
		height: 100%;
		background: var(--ok);
	}
	.confirmer {
		width: 100%;
		min-height: 48px;
		border: 0;
		border-radius: var(--rayon-bouton);
		background: var(--encre);
		color: var(--surface);
		font: 600 var(--texte-16) var(--police);
		cursor: pointer;
	}
	.fait {
		font-weight: 600;
	}

	/* Événement */
	.rdv {
		display: flex;
		align-items: center;
		gap: var(--espace-12);
	}
	.titre-evenement {
		font-size: var(--texte-18);
		line-height: 1.3;
	}
	.rdv .doux {
		font-size: var(--texte-15);
	}
	.rdv .petit {
		font-size: var(--texte-14);
	}
	.presents {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--espace-8);
	}
	.visages {
		display: flex;
	}
	.visages > :global(* + *) {
		margin-left: -8px;
	}

	/* Bravo */
	.bravo {
		border-color: var(--statut-alerte-trait);
		background: var(--surface);
	}
	.confettis {
		position: absolute;
		left: 0;
		top: 0;
	}
	.tete-bravo {
		display: flex;
		align-items: center;
		gap: var(--espace-12);
	}
	.tete-bravo .colonne {
		flex: 1;
	}
	.bravo-titre {
		font: 700 var(--texte-24)/1.1 var(--police-titre);
		color: var(--statut-alerte-texte);
	}

	/* Réactions */
	.reactions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--espace-8);
	}
	.pilule {
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		padding: 0 var(--espace-16);
		border: 1px solid var(--trait-doux);
		border-radius: var(--rayon-bouton);
		background: var(--surface);
		color: var(--encre);
		font: 600 var(--texte-15) var(--police);
		text-decoration: none;
		cursor: pointer;
	}
	@media (hover: hover) and (pointer: fine) {
		.pilule:hover {
			border-color: var(--encre);
		}
	}
	.bravo .pilule {
		background: color-mix(in srgb, var(--surface) 70%, transparent);
	}
	/* Les morceaux du bouton sont des éléments flexibles : l'espace avant le nombre vient de l'écart. */
	.aimer {
		gap: 0.3em;
	}
	.bravo .aimer {
		border: 2px solid var(--statut-alerte-trait);
		color: var(--statut-alerte-texte);
	}
	/* L'état appuyé se lit aussi par la coche, pas seulement par la couleur. */
	.aimer[aria-pressed='true'] {
		border: 2px solid currentColor;
	}
	.aimer[aria-pressed='true']::before {
		content: '✓ ';
		content: '✓ ' / '';
	}
	.commentaires {
		list-style: none;
		padding: 0 0 0 var(--espace-12);
		border-left: 3px solid var(--trait);
		display: flex;
		flex-direction: column;
		gap: var(--espace-8);
	}
	.commentaires .texte {
		font-size: var(--texte-16);
	}
	.publication:focus-visible {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}

	/* Photos en grand : une seule prend toute la largeur. */
	.photos {
		list-style: none;
		padding: 0 var(--espace-16) 0;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--espace-4);
	}
	.photos.une {
		padding: 0;
		grid-template-columns: 1fr;
	}
	.photos img {
		display: block;
		width: 100%;
		aspect-ratio: 4 / 3;
		object-fit: cover;
		border-radius: var(--rayon-bouton);
		background: var(--fond);
	}
	.photos.une img {
		border-radius: 0;
		max-height: 28rem;
	}

	.gestes {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: var(--espace-8);
	}
	details:not(.plus) > summary {
		min-height: var(--cible);
		display: flex;
		align-items: center;
		padding: 0 var(--espace-16);
		border: 1px solid var(--trait);
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
		gap: var(--espace-8);
		padding-top: var(--espace-8);
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
	.echec,
	.succes {
		padding: var(--espace-8) var(--espace-12);
		border-radius: var(--rayon-petit);
		border: 2px solid var(--accent);
		font-weight: 600;
	}
	.succes {
		border-color: var(--ok);
	}
</style>
