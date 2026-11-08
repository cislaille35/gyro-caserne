<script lang="ts">
	import { formatDeDate } from '@gyro-caserne/socle/dates';
	import { DESSINS } from './icones-roles.ts';
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
	const lien = (i: ItemANePasManquer) => `/echanges/${i.cle}/${i.id}`;
	// Les dates sont enregistrées à l'heure de Paris : on les lit telles quelles.
	const debut = (iso: string) =>
		formatDeDate({ weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }).format(new Date(`${iso.slice(0, 16)}:00Z`));
	const refus = (id: number) => (form?.cible === `publication:${id}` ? form.message : undefined);

	const r = $derived(regrouper(a));
	const rien = $derived(r.annonces.length + r.evenements.length + r.sondages.length + r.epinglees.length + r.nouveautes.length + (a.remplacements?.length ?? 0) === 0);
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
	<ListeRangees>
		<li><Rangee icone="croix" dessin={DESSINS.ok} titre="Tout est à jour" sous="Aucune annonce, aucun événement ni sondage ne vous attend." /></li>
	</ListeRangees>
{:else}
	<ListeRangees titre="À ne pas manquer" ancre="a-ne-pas-manquer">
		{#each a.remplacements ?? [] as d (d.id)}
			<li>
				<Rangee href="/remplacements/{d.id}" titre={d.titre} sous="{d.sous} · Accepter ou refuser" alerte>
					{#snippet tete()}<TuileDate iso={d.debut} />{/snippet}
				</Rangee>
			</li>
		{/each}
		{#each r.evenements as e (e.id)}
			<li>
				<Rangee href={lien(e)} titre={e.titre} sous="{debut(e.debut)} · {e.nomMur}">
					{#snippet tete()}<TuileDate iso={e.debut} />{/snippet}
					{#if e.enCours}<span class="demain"><Pastille ton="ok">En cours</Pastille></span>
					{:else if e.demain}<span class="demain"><Pastille ton="alerte">Demain</Pastille></span>{/if}
					<!-- Commencé, on n'y répond plus (le serveur refuse). -->
					{#if !e.enCours}
						<form method="POST" action={action('repondre')} use:enhance={garderFocus}>
							<input type="hidden" name="id" value={e.id} />
							<p id="reponse-{e.id}" class="masque">Votre réponse{` : ${e.titre}`}</p>
							<div role="group" aria-labelledby="reponse-{e.id}" class="segments boutons">
								{#each REPONSES as [valeur, libelle] (valeur)}
									<button type="submit" name="reponse" value={valeur} aria-pressed={e.reponse === valeur}>{libelle}</button>
								{/each}
							</div>
						</form>
					{/if}
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
	/* Les trois réponses, à parts égales, sur une ligne à 390 px. */
	.boutons {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}
	.boutons button {
		padding: 0 var(--espace-4);
	}
	form {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--espace-6);
		margin-top: var(--espace-6);
	}
	.demain {
		margin-top: var(--espace-4);
	}
	.geste {
		min-height: var(--cible);
		min-width: var(--cible);
		padding: 0 var(--espace-12);
		border: 1px solid var(--trait);
		border-radius: var(--rayon-bouton);
		background: var(--surface);
		color: var(--encre);
		font: 600 var(--texte-15) var(--police);
		cursor: pointer;
	}
	.geste:hover {
		border-color: var(--encre);
	}
	.lien {
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		align-self: flex-start;
		gap: var(--espace-6);
		color: var(--statut-info-texte);
		font-weight: 600;
		font-size: var(--texte-15);
		text-decoration: none;
	}
	.lien:hover {
		text-decoration: underline;
	}
	.echec {
		margin: var(--espace-4) 0 0;
		font-weight: 600;
		color: var(--statut-danger-texte);
	}
	.compte {
		min-width: 24px;
		height: 24px;
		padding: 0 var(--espace-8);
		border-radius: var(--rayon-bouton);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--rouge);
		color: var(--sur-rouge);
		font-size: var(--texte-14);
		font-weight: 700;
	}
</style>
