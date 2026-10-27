<script lang="ts">
	import type { Apercu } from '@gyro-caserne/socle';
	import Bouton from '#lib/ui/Bouton.svelte';
	import Carte from '#lib/ui/Carte.svelte';
	import { compter } from './textes.ts';

	// `apres` : la validation est faite, seul reste ce qui n'a pas été appliqué.
	let { apercu, apres = false, onvalider, onabandonner }: { apercu: Apercu; apres?: boolean; onvalider?: () => void; onabandonner?: () => void } = $props();

	const erreur = (e: Apercu['erreurs'][number]) => (e.ligne === 0 ? e.message : `Ligne ${e.ligne}${e.colonne ? `, ${e.colonne}` : ''} : ${e.message}`);
	const restes = $derived(apercu.erreurs.length + apercu.perimees.length + apercu.colonnesIgnorees.length);
</script>

{#if !apres || restes > 0}
	<Carte titre={apres ? 'Non appliqué' : "Aperçu de l'import"}>
		<div class="apercu">
			{#if !apres}
				<section>
					<h3>{apercu.departs.length === 0 ? 'Aucun départ' : compter(apercu.departs.length, 'départ', 'départs')}</h3>
					{#if apercu.departs.length > 0}
						<p class="note">Ces agents passent au statut « Parti ».</p>
						<ul>
							{#each apercu.departs as d (d.personneId)}<li>{d.nom}</li>{/each}
						</ul>
					{/if}
				</section>

				{#if apercu.arrivees.length > 0}
					<section>
						<h3>{compter(apercu.arrivees.length, 'arrivée', 'arrivées')}</h3>
						<ul>
							{#each apercu.arrivees as a (a.ligne)}<li>Ligne {a.ligne} : {a.nom}</li>{/each}
						</ul>
					</section>
				{/if}

				{#if apercu.modifications.length > 0}
					<section>
						<h3>{compter(apercu.modifications.length, 'modification', 'modifications')}</h3>
						<ul>
							{#each apercu.modifications as m (m.ligne)}
								<li>
									<strong>Ligne {m.ligne} : {m.nom}</strong>
									<ul>
										{#each m.changements as c (c.colonne)}
											<li>
												{c.colonne} : {c.avant || '(vide)'} <span aria-hidden="true">→</span><span class="cache">devient</span>
												{c.apres || '(vide)'}
											</li>
										{/each}
									</ul>
								</li>
							{/each}
						</ul>
					</section>
				{/if}
			{/if}

			{#if apercu.erreurs.length > 0}
				<section>
					<h3>{compter(apercu.erreurs.length, 'erreur', 'erreurs')}</h3>
					<p class="note">Ces lignes ne sont pas appliquées : corrigez-les dans le fichier ou à l'écran.</p>
					<ul class="erreurs">
						{#each apercu.erreurs as e, i (i)}<li>{erreur(e)}</li>{/each}
					</ul>
				</section>
			{/if}

			{#if apercu.perimees.length > 0}
				<section>
					<h3>{compter(apercu.perimees.length, 'ligne périmée', 'lignes périmées')}</h3>
					<p class="note">Agents modifiés dans l'appli depuis l'export : non appliqués. Réexportez pour les modifier par fichier.</p>
					<ul>
						{#each apercu.perimees as p, i (i)}<li>{p.ligne === 0 ? `${p.nom} (absent du fichier)` : `Ligne ${p.ligne} : ${p.nom}`}</li>{/each}
					</ul>
				</section>
			{/if}

			{#if apercu.colonnesIgnorees.length > 0}
				<section>
					<h3>{compter(apercu.colonnesIgnorees.length, 'colonne ignorée', 'colonnes ignorées')}</h3>
					<p class="note">Créez d'abord la responsabilité ou le comité dans les réglages.</p>
					<ul>
						{#each apercu.colonnesIgnorees as c (c)}<li>{c}</li>{/each}
					</ul>
				</section>
			{/if}

			{#if !apres}
				{#if apercu.operations.length === 0}
					<p>Rien à appliquer.</p>
				{:else}
					<p class="note">Rien n'est écrit avant la validation.</p>
				{/if}
				<div class="actions">
					{#if apercu.operations.length > 0}
						<Bouton onclick={onvalider}>Valider<span class="cache"> l'import</span></Bouton>
					{/if}
					<Bouton variante="secondaire" onclick={onabandonner}>Abandonner<span class="cache"> l'import</span></Bouton>
				</div>
			{/if}
		</div>
	</Carte>
{/if}

<style>
	.apercu {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}
	h3 {
		margin: 0 0 8px;
		font: 700 1.25rem var(--police-titre);
	}
	p {
		margin: 0 0 8px;
	}
	ul {
		margin: 0;
		padding-left: 20px;
		overflow-wrap: anywhere;
	}
	li + li {
		margin-top: 4px;
	}
	.note {
		color: var(--doux);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
	}
	.cache {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
</style>
