<script lang="ts">
	import { pluriel } from '#lib/pluriel.ts';
	import type { ANePasManquer, ApercuMur, ItemANePasManquer } from '@gyro-caserne/socle';
	import { enhance, type SubmitFunction } from '$app/forms';
	import { regrouper } from '../a-faire.ts';
	import ListeRangees from './ListeRangees.svelte';
	import Pastille from './Pastille.svelte';
	import PastilleMur from './PastilleMur.svelte';
	import Rangee from './Rangee.svelte';
	import TuileDate from './TuileDate.svelte';

	// Les nouveautés portent, si on les a, l'identité de leur mur (icône, couleur, numéro d'équipe).
	type Identite = Partial<Pick<ApercuMur, 'icone' | 'couleur' | 'numero'>>;
	let { a, casquette, form = null }: { a: ANePasManquer & { nouveautes: (ANePasManquer['nouveautes'][number] & Identite)[] }; casquette: string; form?: { cible: string; message?: string } | null } = $props();

	const REPONSES = [
		['present', 'Présent'],
		['absent', 'Absent'],
		['incertain', 'Incertain']
	] as const;
	const DESSINS = {
		annonce: 'M3 10v4h3l7 5V5l-7 5z M16.5 8.5a5 5 0 0 1 0 7',
		sondage: 'M5 20V11 M12 20V4 M19 20v-6',
		epinglee: 'M9 3h6l-1 6 4 4H6l4-4z M12 13v8',
		ok: 'M5 12.5l4.5 4.5L19 7'
	};
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

{#snippet echec(id: number)}
	{#if refus(id)}<p class="echec">{refus(id)}</p>{/if}
{/snippet}

{#if rien}
	<Rangee icone="croix" dessin={DESSINS.ok} titre="Tout est à jour" sous="Aucune annonce, aucun événement ni sondage ne vous attend." />
{:else}
	<ListeRangees titre="À ne pas manquer" ancre="a-ne-pas-manquer">
		{#each r.evenements as e (e.id)}
			<li>
				<Rangee href={lien(e)} titre={e.titre} sous="{debut(e.debut)} · {e.nomMur}">
					{#snippet tete()}<TuileDate iso={e.debut} />{/snippet}
					{#if e.demain}<span class="demain"><Pastille ton="alerte">Demain</Pastille></span>{/if}
					<form method="POST" action={action('repondre')} use:enhance={garderFocus}>
						<input type="hidden" name="id" value={e.id} />
						<p id="reponse-{e.id}" class="masque">Votre réponse{` : ${e.titre}`}</p>
						<div role="group" aria-labelledby="reponse-{e.id}" class="boutons">
							{#each REPONSES as [valeur, libelle] (valeur)}
								<button type="submit" class="bascule" name="reponse" value={valeur} aria-pressed={e.reponse === valeur}>{libelle}</button>
							{/each}
						</div>
					</form>
					{#if e.sondage}<a class="lien" href={lien(e)}
							><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d={DESSINS.sondage} /></svg>Sondage ouvert : votez sur la publication<span class="masque">{` : ${e.titre}`}</span></a>{/if}
					{@render echec(e.id)}
				</Rangee>
			</li>
		{/each}

		{#each r.annonces as i (i.id)}
			<li>
				<Rangee href={lien(i)} titre={i.titre} sous="Annonce à prendre en compte · {i.nomMur}" icone="etoile" dessin={DESSINS.annonce}>
					<form method="POST" action={action('prendreConnaissance')} use:enhance={garderFocus}>
						<input type="hidden" name="id" value={i.id} />
						<button type="submit" class="geste">Pris connaissance<span class="masque">{` : ${i.titre}`}</span></button>
					</form>
					{@render echec(i.id)}
				</Rangee>
			</li>
		{/each}

		{#each r.sondages as i (i.id)}
			<li><Rangee href={lien(i)} titre={i.titre} sous="Sondage ouvert · {i.nomMur}" icone="camion" dessin={DESSINS.sondage} /></li>
		{/each}

		{#each r.epinglees as i (i.id)}
			<li><Rangee href={lien(i)} titre={i.titre} sous="Épinglée · {i.nomMur}" icone="livre" dessin={DESSINS.epinglee} /></li>
		{/each}

		{#each a.nouveautes as n (n.cle)}
			<li>
				<Rangee href="/echanges/{n.cle}" titre={n.nom} sous={pluriel(n.nombre, 'nouveauté')}>
					{#snippet tete()}<PastilleMur icone={n.icone ?? null} couleur={n.couleur ?? null} numero={n.numero ?? null} taille={48} />{/snippet}
					{#snippet droite()}<span class="compte" aria-hidden="true">{n.nombre}</span>{/snippet}
				</Rangee>
			</li>
		{/each}
	</ListeRangees>
{/if}

<style>
	form {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 6px;
		margin-top: 6px;
	}
	.demain {
		margin-top: 4px;
	}
	.boutons {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.bascule,
	.geste {
		min-height: var(--cible);
		min-width: var(--cible);
		padding: 0 12px;
		border: 1px solid var(--trait);
		border-radius: 999px;
		background: var(--surface);
		color: var(--encre);
		font: 600 0.9375rem var(--police);
		cursor: pointer;
	}
	.bascule:hover,
	.geste:hover {
		border-color: var(--encre);
	}
	/* Bouton à bascule : l'état appuyé se lit aussi par la coche, pas seulement par la couleur. */
	.bascule[aria-pressed='true'] {
		border: 2px solid var(--encre);
		background: var(--fond);
		font-weight: 700;
	}
	.bascule[aria-pressed='true']::before {
		content: '✓ ';
		content: '✓ ' / '';
	}
	.lien {
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		align-self: flex-start;
		gap: 6px;
		color: var(--statut-info-texte);
		font-weight: 600;
		font-size: 0.9375rem;
		text-decoration: none;
	}
	.lien:hover {
		text-decoration: underline;
	}
	.echec {
		margin: 4px 0 0;
		font-weight: 600;
		color: var(--statut-danger-texte);
	}
	.compte {
		min-width: 24px;
		height: 24px;
		padding: 0 7px;
		border-radius: 12px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--rouge);
		color: var(--sur-rouge);
		font-size: 0.8125rem;
		font-weight: 700;
	}
</style>
