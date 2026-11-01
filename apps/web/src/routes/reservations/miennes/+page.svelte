<script lang="ts">
	import Celebration from '#lib/animations/Celebration.svelte';
	import { momentPremiereReservation } from '#lib/animations/celebration.ts';
	import type { VueReservation } from '@gyro-caserne/socle';
	import { enhance } from '$app/forms';
	import CarteReservation from '#lib/ui/CarteReservation.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import Vide from '#lib/ui/Vide.svelte';

	let { data, form }: { data: { aVenir: VueReservation[]; passees: VueReservation[]; reservee: 'attente' | 'acceptee' | null; confirmer: number | null; aujourdhui: string; qui: string }; form?: { message?: string; succes?: string } | null } = $props();

	const REUSSITE = { attente: 'Demande envoyée : vous serez prévenu de la réponse.', acceptee: 'Réservation acceptée : elle est à vous.' };
	const succes = $derived(form?.succes ?? (data.reservee ? REUSSITE[data.reservee] : ''));
</script>

<svelte:head>
	<title>Mes réservations · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<EnTetePage titre="Mes réservations" phrase="Vos demandes et réservations, à venir et passées." retour={{ href: '/reservations', libelle: 'Réservations' }} />
	<p class="reussite" class:masque={!succes} role="status">{succes}</p>
	<p class="erreur" class:masque={!form?.message} role="alert">{form?.message ?? ''}</p>

	{#if data.aVenir.length === 0 && data.passees.length === 0}
		<Vide titre="Aucune réservation pour le moment." texte="Vos demandes de VL ou de matériel apparaîtront ici, avec leur réponse." action={{ href: '/reservations', libelle: 'Réserver' }} />
	{/if}

	{#if data.aVenir.length > 0}
		<section aria-labelledby="t-a-venir">
			<h2 id="t-a-venir" class="rubrique">À venir</h2>
			<ul role="list">
				{#each data.aVenir as r (r.id)}
					<li>
						<CarteReservation {r} aujourdhui={data.aujourdhui}>
							{#if r.annulable}
								{#if data.confirmer === r.id}
									<div class="confirmer">
										<p><strong>Annuler cette réservation ?</strong></p>
										<div class="choix">
											<a class="bouton secondaire" href="/reservations/miennes">Garder</a>
											<form method="POST" action="?/annuler" use:enhance>
												<input type="hidden" name="id" value={r.id} />
												<button type="submit" class="bouton danger">Annuler la réservation</button>
											</form>
										</div>
									</div>
								{:else}
									<a class="bouton secondaire" href="?annuler={r.id}">Annuler<span class="masque">{` la réservation ${r.ressource}`}</span></a>
								{/if}
							{/if}
						</CarteReservation>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if data.passees.length > 0}
		<section aria-labelledby="t-passees">
			<h2 id="t-passees" class="rubrique">Passées</h2>
			<ul role="list">
				{#each data.passees as r (r.id)}
					<li><CarteReservation {r} aujourdhui={data.aujourdhui} /></li>
				{/each}
			</ul>
		</section>
	{/if}
</div>
<!-- La page dit déjà la réussite : la fête ne la répète pas aux lecteurs d’écran. -->
<Celebration moment={momentPremiereReservation(data.aVenir, data.passees)} qui={data.qui} annoncer={false} />

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
	.confirmer {
		display: flex;
		flex-direction: column;
		gap: 8px;
		width: 100%;
		padding: 12px 14px;
		border-radius: 12px;
		background: var(--statut-danger-fond);
		color: var(--statut-danger-texte);
	}
	.choix {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
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
			max-width: 48rem;
		}
		ul {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
