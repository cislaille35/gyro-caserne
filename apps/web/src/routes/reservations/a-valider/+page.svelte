<script lang="ts">
	import { periodeCourte, type VueReservation } from '@gyro-caserne/socle';
	import { enhance } from '$app/forms';
	import CarteReservation from '#lib/ui/CarteReservation.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import Vide from '#lib/ui/Vide.svelte';

	let { data, form }: { data: { demandes: { demande: VueReservation; conflits: VueReservation[] }[]; acceptees: VueReservation[] }; form?: { message?: string; succes?: string } | null } = $props();
</script>

<svelte:head>
	<title>À valider · Réservations · Gyro Caserne</title>
</svelte:head>

{#snippet refuser(r: VueReservation)}
	<details class="plus">
		<summary class="bouton secondaire">Refuser<span class="masque">{` la demande de ${r.demandeur}`}</span></summary>
		<form method="POST" action="?/refuser" use:enhance>
			<input type="hidden" name="id" value={r.id} />
			<label for="motif-{r.id}">Motif (facultatif), envoyé au demandeur</label>
			<textarea id="motif-{r.id}" name="motif" maxlength="200" rows="2"></textarea>
			<button type="submit" class="bouton danger">Refuser la demande</button>
		</form>
	</details>
{/snippet}

<div class="page">
	<EnTetePage titre="À valider" phrase="Les demandes de réservation des ressources que vous gérez. Le demandeur est prévenu de votre réponse." retour={{ href: '/reservations', libelle: 'Réservations' }} />
	<p class="reussite" class:masque={!form?.succes} role="status">{form?.succes ?? ''}</p>
	<p class="erreur" class:masque={!form?.message} role="alert">{form?.message ?? ''}</p>

	{#if data.demandes.length === 0}
		<Vide titre="Aucune demande en attente." texte="Les demandes de réservation à trancher arriveront ici, et dans votre cloche." action={{ href: '/reservations', libelle: 'Voir les réservations' }} />
	{:else}
		<section aria-labelledby="t-demandes">
			<h2 id="t-demandes" class="rubrique">Demandes <span class="doux">({data.demandes.length})</span></h2>
			<ul role="list">
				{#each data.demandes as { demande: r, conflits } (r.id)}
					<li>
						<CarteReservation {r} demandeur>
							{#if conflits.length > 0}
								<div class="conflit">
									<p><strong>Déjà réservée sur ce créneau :</strong></p>
									<ul role="list">
										{#each conflits as c (c.id)}
											<li>{c.demandeur} · {periodeCourte(c.forme, c.debut, c.fin)}{#if c.telephone} · <a href="tel:{c.telephone}">{c.telephone}</a>{/if}</li>
										{/each}
									</ul>
									<p>Garder cette demande annule l’autre réservation ; son demandeur est prévenu.</p>
								</div>
								<form method="POST" action="?/accepter" use:enhance>
									<input type="hidden" name="id" value={r.id} />
									<button type="submit" class="bouton principal">Garder cette demande<span class="masque">{` de ${r.demandeur}`}</span></button>
								</form>
								<form method="POST" action="?/refuser" use:enhance>
									<input type="hidden" name="id" value={r.id} />
									<input type="hidden" name="motif" value="Créneau déjà réservé" />
									<button type="submit" class="bouton secondaire">Garder l’autre<span class="masque">{` et refuser la demande de ${r.demandeur}`}</span></button>
								</form>
							{:else}
								<form method="POST" action="?/accepter" use:enhance>
									<input type="hidden" name="id" value={r.id} />
									<button type="submit" class="bouton principal">Accepter<span class="masque">{` la demande de ${r.demandeur}`}</span></button>
								</form>
								{@render refuser(r)}
							{/if}
						</CarteReservation>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if data.acceptees.length > 0}
		<section aria-labelledby="t-acceptees">
			<h2 id="t-acceptees" class="rubrique">Acceptées à venir</h2>
			<ul role="list">
				{#each data.acceptees as r (r.id)}
					<li>
						<CarteReservation {r} demandeur>
							<details class="plus">
								<summary class="bouton secondaire">Annuler<span class="masque">{` la réservation de ${r.demandeur}`}</span></summary>
								<form method="POST" action="?/annuler" use:enhance>
									<input type="hidden" name="id" value={r.id} />
									<label for="mot-{r.id}">Un mot pour le demandeur (facultatif)</label>
									<textarea id="mot-{r.id}" name="mot" maxlength="200" rows="2"></textarea>
									<button type="submit" class="bouton danger">Annuler la réservation</button>
								</form>
							</details>
						</CarteReservation>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>

<style>
	.page,
	section {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.page {
		gap: 20px;
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 10px;
	}
	p {
		margin: 0;
	}
	.reussite,
	.erreur {
		padding: 12px 14px;
		border-radius: var(--rayon-grand);
		font-weight: 600;
	}
	.reussite {
		background: var(--statut-ok-fond);
		color: var(--statut-ok-texte);
		border: 1px solid var(--statut-ok-trait);
	}
	.erreur {
		background: var(--statut-danger-fond);
		color: var(--statut-danger-texte);
		border: 1px solid var(--statut-danger-trait);
	}
	.conflit {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 10px 12px;
		border-radius: 12px;
		background: var(--statut-alerte-fond);
		color: var(--statut-alerte-texte);
		border: 1px solid var(--statut-alerte-trait);
	}
	.conflit ul {
		gap: 2px;
	}
	.plus {
		width: 100%;
	}
	.plus summary {
		list-style: none;
		display: inline-flex;
	}
	.plus summary::-webkit-details-marker {
		display: none;
	}
	.plus form {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-top: 10px;
	}
	.plus form button {
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
		resize: vertical;
	}
	.bouton {
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		padding: 0 18px;
		border-radius: 999px;
		font: inherit;
		font-weight: 600;
		text-decoration: none;
		cursor: pointer;
	}
	.principal {
		border: 2px solid var(--encre);
		background: var(--rouge);
		color: var(--sur-rouge);
	}
	.secondaire {
		border: 1px solid var(--trait);
		background: var(--surface);
		color: var(--encre);
	}
	.danger {
		border: 0;
		background: var(--rouge);
		color: var(--sur-rouge);
	}
	@media (min-width: 1024px) {
		.page {
			max-width: 56rem;
		}
		section > ul {
			grid-template-columns: 1fr 1fr;
			align-items: start;
		}
	}
</style>
