<script lang="ts">
	import { pluriel } from '#lib/pluriel.ts';
	import type { PublicationVue } from '@gyro-caserne/socle';
	import { enhance, type SubmitFunction } from '$app/forms';
	import { jourEtHeure, periodeSondage } from '#lib/murs/quand.ts';

	let {
		id,
		sondage,
		agir = false,
		garderFocus = () => {}
	}: { id: number; sondage: NonNullable<PublicationVue['sondage']>; agir?: boolean; garderFocus?: SubmitFunction } = $props();

	const s = $derived(sondage);
	const etat = $derived(s.etat === 'ferme' ? 'Fermé' : s.etat === 'avenir' && s.ouverture ? `Ouvre le ${jourEtHeure(s.ouverture)}` : 'Ouvert');
	const total = $derived(s.resultats ? s.resultats.reduce((a, b) => a + b, 0) : 0);
	const pourcent = (n: number) => (total === 0 ? 0 : Math.round((n * 100) / total));
	const ouvert = $derived(s.etat === 'ouvert');
</script>

<div class="sondage">
	<p class="tete">
		<strong id="question-{id}">{s.question}</strong>
		<span class="etat {s.etat}">{etat}</span>
	</p>
	{#if s.ouverture && s.cloture}<p class="doux">{periodeSondage(s.ouverture, s.cloture)}</p>{/if}

	{#if ouvert && agir && s.vote === null}
		<form method="POST" action="?/voter" use:enhance={garderFocus}>
			<input type="hidden" name="id" value={id} />
			<div role="group" aria-labelledby="question-{id}" class="choix">
				{#each s.reponses as reponse, i (i)}
					<button type="submit" class="reponse" name="reponse" value={i}>{reponse}</button>
				{/each}
			</div>
		</form>
		{#if !s.resultats}<p class="doux">Résultats visibles après votre vote.</p>{/if}
	{:else if s.resultats}
		<ul class="resultats">
			{#each s.reponses as reponse, i (i)}
				{@const n = s.resultats[i] ?? 0}
				<li>
					<span>{reponse} : {n} voix, {pourcent(n)} %{s.vote === i ? ' (votre choix)' : ''}</span>
					<span class="barre" class:choisie={s.vote === i} aria-hidden="true"><span style="width: {pourcent(n)}%"></span></span>
				</li>
			{/each}
		</ul>
		{#if ouvert && agir}
			<details>
				<summary>Changer mon vote</summary>
				<form method="POST" action="?/voter" use:enhance={garderFocus}>
					<input type="hidden" name="id" value={id} />
					<div role="group" aria-labelledby="question-{id}" class="choix">
						{#each s.reponses as reponse, i (i)}
							<button type="submit" class="reponse" name="reponse" value={i} aria-pressed={s.vote === i}>{reponse}</button>
						{/each}
					</div>
				</form>
			</details>
		{/if}
	{:else if ouvert}
		<p class="doux">Les résultats sont réservés à ceux qui ont voté.</p>
	{/if}
	{#if s.resultats}<p class="doux">{pluriel(total, 'réponse')}</p>{/if}
</div>

<style>
	.sondage {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px;
		border-radius: 14px;
		background: var(--fond);
	}
	p,
	ul {
		margin: 0;
	}
	.tete {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: baseline;
		gap: 4px 8px;
	}
	.etat {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--statut-ok-texte);
	}
	.etat.avenir {
		color: var(--statut-info-texte);
	}
	.etat.ferme {
		color: var(--doux);
	}
	.doux {
		color: var(--doux);
		font-size: 0.8125rem;
	}
	.choix {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.reponse {
		min-height: var(--cible);
		padding: 0 14px;
		text-align: left;
		border: 1px solid var(--statut-neutre-trait);
		border-radius: 12px;
		background: var(--surface);
		color: var(--encre);
		font: 500 0.9375rem var(--police);
		cursor: pointer;
	}
	.reponse:hover {
		border-color: var(--encre);
	}
	/* L'état appuyé se lit aussi par la coche, pas seulement par la couleur. */
	.reponse[aria-pressed='true'] {
		border: 2px solid var(--encre);
		font-weight: 700;
	}
	.reponse[aria-pressed='true']::before {
		content: '✓ ';
		content: '✓ ' / '';
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
		background: var(--surface);
		border: 1px solid var(--trait);
		overflow: hidden;
	}
	.barre > span {
		display: block;
		height: 100%;
		background: var(--doux);
	}
	.barre.choisie > span {
		background: var(--ok);
	}
	summary {
		min-height: var(--cible);
		display: flex;
		align-items: center;
		font-weight: 600;
		cursor: pointer;
	}
	details form {
		padding-top: 4px;
	}
</style>
