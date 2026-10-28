<script lang="ts">
	import type { ANePasManquer, ItemANePasManquer } from '@gyro-caserne/socle';
	import { enhance, type SubmitFunction } from '$app/forms';
	import { regrouper } from '../a-faire.ts';
	import Bouton from './Bouton.svelte';
	import Carte from './Carte.svelte';
	import Pastille from './Pastille.svelte';

	let { a, casquette, form = null }: { a: ANePasManquer; casquette: string; form?: { cible: string; message?: string } | null } = $props();

	const REPONSES = [
		['present', 'Présent'],
		['absent', 'Absent'],
		['incertain', 'Incertain']
	] as const;
	const lien = (i: ItemANePasManquer) => `/echanges/${i.cle}/${i.id}`;
	// Les dates sont enregistrées à l'heure de Paris : on les lit telles quelles.
	const debut = (iso: string) =>
		new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }).format(new Date(`${iso.slice(0, 16)}:00Z`));
	const refus = (id: number) => (form?.cible === `publication:${id}` ? form.message : undefined);

	const r = $derived(regrouper(a));
	const rien = $derived(r.annonces.length + r.evenements.length + r.sondages.length + r.epinglees.length + r.nouveautes.length === 0);
	// Sans JavaScript, la page revient sur la casquette choisie.
	const action = (nom: string) => `?casquette=${encodeURIComponent(casquette)}&/${nom}`;

	// Après un geste, SvelteKit remet le focus en haut de la page : on le rend à son bouton ; s'il a disparu, au titre de la section,
	// ou au contenu si elle a disparu.
	const garderFocus: SubmitFunction = ({ submitter }) => async ({ update }) => {
		await update();
		if (submitter?.isConnected) submitter.focus();
		else (document.getElementById('a-ne-pas-manquer') ?? document.getElementById('contenu'))?.focus();
	};
</script>

{#snippet titreDe(i: ItemANePasManquer)}
	<a class="titre" href={lien(i)}>{i.titre}</a>
	<span class="doux">{i.nomMur}</span>
{/snippet}

{#if !rien}
	<Carte titre="À ne pas manquer" ancre="a-ne-pas-manquer">
		<div class="groupes">
			{#if r.annonces.length > 0}
				<section aria-labelledby="anm-annonces">
					<h3 id="anm-annonces">Annonces à prendre en compte</h3>
					<ul role="list">
						{#each r.annonces as i (i.id)}
							<li class="element">
								{@render titreDe(i)}
								<form method="POST" action={action('prendreConnaissance')} use:enhance={garderFocus}>
									<input type="hidden" name="id" value={i.id} />
									<Bouton type="submit">Pris connaissance<span class="masque">{` : ${i.titre}`}</span></Bouton>
								</form>
								{#if refus(i.id)}<p class="echec">{refus(i.id)}</p>{/if}
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			{#if r.evenements.length > 0}
				<section aria-labelledby="anm-evenements">
					<h3 id="anm-evenements">Événements</h3>
					<ul role="list">
						{#each r.evenements as e (e.id)}
							<li class="element">
								{@render titreDe(e)}
								<span class="quand">{#if e.demain}<Pastille ton="alerte">Demain</Pastille>{/if}<span>{debut(e.debut)}</span></span>
								<form method="POST" action={action('repondre')} use:enhance={garderFocus}>
									<input type="hidden" name="id" value={e.id} />
									<p id="reponse-{e.id}" class="question">Votre réponse<span class="masque">{` : ${e.titre}`}</span></p>
									<div role="group" aria-labelledby="reponse-{e.id}" class="boutons">
										{#each REPONSES as [valeur, libelle] (valeur)}
											<button type="submit" class="bascule" name="reponse" value={valeur} aria-pressed={e.reponse === valeur}>{libelle}</button>
										{/each}
									</div>
								</form>
								{#if e.sondage}<a class="lien" href={lien(e)}>Sondage ouvert : votez sur la publication<span class="masque">{` : ${e.titre}`}</span></a>{/if}
								{#if refus(e.id)}<p class="echec">{refus(e.id)}</p>{/if}
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			{#if r.sondages.length > 0}
				<section aria-labelledby="anm-sondages">
					<h3 id="anm-sondages">Sondages ouverts</h3>
					<ul role="list">
						{#each r.sondages as i (i.id)}<li class="element">{@render titreDe(i)}</li>{/each}
					</ul>
				</section>
			{/if}

			{#if r.epinglees.length > 0}
				<section aria-labelledby="anm-epinglees">
					<h3 id="anm-epinglees">Épinglées</h3>
					<ul role="list">
						{#each r.epinglees as i (i.id)}<li class="element">{@render titreDe(i)}</li>{/each}
					</ul>
				</section>
			{/if}

			{#if r.nouveautes.length > 0}
				<section aria-labelledby="anm-nouveautes">
					<h3 id="anm-nouveautes">Nouveautés</h3>
					<ul role="list">
						{#each r.nouveautes as n (n.cle)}
							<li><a class="ligne" href="/echanges/{n.cle}">{n.nom} : {n.nombre} {n.nombre > 1 ? 'nouveautés' : 'nouveauté'}</a></li>
						{/each}
					</ul>
				</section>
			{/if}
		</div>
	</Carte>
{/if}

<style>
	.groupes,
	section,
	ul {
		display: flex;
		flex-direction: column;
	}
	.groupes {
		gap: 20px;
	}
	section {
		gap: 8px;
	}
	h3 {
		margin: 0;
		font: 700 1.125rem var(--police-titre);
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
		gap: 8px;
	}
	.element {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 10px 14px;
		border: 1px solid var(--trait-doux);
		border-radius: 12px;
	}
	.titre,
	.ligne {
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		color: var(--encre);
		font-weight: 700;
		overflow-wrap: anywhere;
	}
	.doux {
		color: var(--doux);
	}
	.lien {
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		color: var(--encre);
		font-weight: 600;
	}
	.quand {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	form {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 6px;
	}
	.question {
		margin: 0;
		font-weight: 600;
	}
	.boutons {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
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
	.bascule[aria-pressed='true']::before {
		content: '✓ ';
		content: '✓ ' / '';
	}
	.echec {
		margin: 0;
		font-weight: 600;
		color: var(--statut-danger-texte);
	}
	.masque {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
