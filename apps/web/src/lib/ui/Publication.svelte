<script lang="ts">
	import type { PublicationVue } from '@gyro-caserne/socle';
	import Bouton from './Bouton.svelte';
	import Pastille from './Pastille.svelte';

	let {
		p,
		equipes = [],
		retour
	}: { p: PublicationVue; equipes?: { id: number; nom: string }[]; retour?: { succes?: string; message?: string } } = $props();

	const TYPES = { message: null, annonce: 'Annonce', evenement: 'Événement', bravo: 'Bravo' } as const;
	// Les dates sont enregistrées à l'heure de Paris : on les lit telles quelles.
	const date = (iso: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fr-FR', { ...options, timeZone: 'UTC' }).format(new Date(`${iso.slice(0, 16)}:00Z`));
	const quand = (iso: string) => date(iso, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
	const debut = (iso: string) => date(iso, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
	const auteur = $derived(`${p.auteur.prenom} ${p.auteur.nom}`.trim());
	const convoques = $derived(
		!p.evenement || p.evenement.convoques === 'tous' ? 'tout le mur' : p.evenement.convoques.map((id) => equipes.find((e) => e.id === id)?.nom ?? 'équipe archivée').join(', ')
	);
	const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;
	const total = $derived(p.sondage ? p.sondage.resultats.reduce((a, b) => a + b, 0) : 0);
</script>

<article class="publication" aria-labelledby="auteur-{p.id}">
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
	{/if}

	{#if p.sondage}
		<div class="sondage">
			<p class="question">Sondage : {p.sondage.question}</p>
			<ul>
				{#each p.sondage.reponses as reponse, i (i)}
					<li>{reponse} : {p.sondage.resultats[i] ?? 0} voix{p.sondage.vote === i ? ' (votre choix)' : ''}</li>
				{/each}
			</ul>
			<p class="doux">{pluriel(total, 'réponse')}</p>
		</div>
	{/if}

	{#if p.priseDeConnaissance}
		<p class="doux">Prise de connaissance demandée{p.priseDeConnaissance.le ? ' : vous l’avez faite' : ''}.</p>
	{/if}

	{#if p.photos.length > 0}
		<ul class="photos">
			{#each p.photos as id, i (id)}
				<li><img src="/echanges/photo/{id}" alt="Photo {i + 1} sur {p.photos.length}, publiée par {auteur}" loading="lazy" /></li>
			{/each}
		</ul>
	{/if}

	<p class="doux">{p.jaime} j’aime · {pluriel(p.commentaires, 'commentaire')}{p.commentairesFermes ? ' · commentaires fermés' : ''}</p>

	<!-- Annoncé par la zone unique de la page ; ici, seulement visible. -->
	{#if retour?.succes}<p class="succes">{retour.succes}</p>{/if}
	{#if retour?.message}<p class="echec">{retour.message}</p>{/if}

	{#if p.droits.epingler || p.droits.modifier || p.droits.supprimer}
		<div class="gestes">
			{#if p.droits.epingler}
				<form method="POST" action="?/epingler">
					<input type="hidden" name="id" value={p.id} />
					<input type="hidden" name="oui" value={p.epinglee ? '0' : '1'} />
					<Bouton type="submit" variante="secondaire">{p.epinglee ? 'Retirer l’épingle' : 'Épingler'}</Bouton>
				</form>
			{/if}
			{#if p.droits.modifier}
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
			{#if p.droits.supprimer}
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
	.sondage ul {
		padding-left: 1.25rem;
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
