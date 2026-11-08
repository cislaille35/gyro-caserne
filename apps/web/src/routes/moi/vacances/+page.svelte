<script lang="ts">
	import { enhance } from '$app/forms';
	import { duAu, jourLong } from '#lib/planning/dates.ts';
	import { pluriel } from '#lib/pluriel.ts';
	import Bouton from '#lib/ui/Bouton.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';

	let { data, form } = $props();
	const v = $derived(data.vacances);
	const e = $derived(v?.ete ?? null);
	const garder = () => async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => update({ reset: false });
	// La veille du jour de relève qui suit la dernière semaine : le dernier jour de l'été.
	const dernierJour = (fin: string) => new Date(Date.parse(`${fin}T00:00:00Z`) - 864e5).toISOString().slice(0, 10);
	const etat = $derived(
		!v?.reponse ? 'Vous n’avez encore rien donné.' : v.reponse.toutEte ? 'Vous êtes disponible tout l’été.' : v.periodes.length ? `Vous avez donné ${pluriel(v.periodes.length, 'période', 'périodes')} de vacances.` : 'Vous n’avez plus de vacances données : ajoutez-en, ou dites que vous êtes disponible tout l’été.'
	);
</script>

<svelte:head>
	<title>Mes vacances · Moi · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<EnTetePage titre="Mes vacances" phrase={e ? `Été ${e.annee} : ${duAu(e.debut, dernierJour(e.fin))} ; à donner avant le ${jourLong(e.dateLimite)}.` : undefined} retour={{ href: '/moi', libelle: 'Moi' }} />

	{#if !v}
		<p class="encadre">Réservé aux agents ayant une fiche.</p>
	{:else if !e}
		<p class="encadre">La saisie des vacances d’été n’est pas encore ouverte : le chef vous préviendra.</p>
	{:else}
		<div class="retours">
			<div role="status">{#if form?.succes}<p class="succes">{form.succes}</p>{/if}</div>
			<div role="alert">{#if form?.message}<p class="echec">{form.message}</p>{/if}</div>
		</div>

		<section class="carte" aria-labelledby="titre-reponse">
			<h2 id="titre-reponse">Ma réponse</h2>
			<p class="etat"><strong>{etat}</strong></p>
			{#if e.publiee}<p class="doux">Le planning d’été est publié : un changement prévient le chef, qui revoit la répartition.</p>{/if}
			{#if !v.reponse?.toutEte}
				<form method="POST" action="?/toutLete" use:enhance>
					<input type="hidden" name="annee" value={e.annee} />
					<Bouton type="submit" variante={v.periodes.length ? 'secondaire' : 'principal'}>Je suis disponible tout l’été</Bouton>
				</form>
			{/if}
		</section>

		<section class="carte" aria-labelledby="titre-periodes">
			<h2 id="titre-periodes">Mes périodes de vacances</h2>
			{#if v.periodes.length}
				<ul class="periodes" role="list">
					{#each v.periodes as p (p.id)}
						<li>
							<span>{duAu(p.debut, p.fin)}</span>
							<form method="POST" action="?/retirer" use:enhance>
								<input type="hidden" name="id" value={p.id} />
								<button type="submit" class="retirer">Retirer<span class="masque">{' '}la période {duAu(p.debut, p.fin)}</span></button>
							</form>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="doux">Aucune période donnée.</p>
			{/if}
			<form method="POST" action="?/ajouter" use:enhance={garder} class="ajout">
				<input type="hidden" name="annee" value={e.annee} />
				<label>Du <input type="date" name="debut" required min={e.debut} max={dernierJour(e.fin)} value={form?.valeurs?.debut ?? ''} /></label>
				<label>Au <input type="date" name="fin" required min={e.debut} max={dernierJour(e.fin)} value={form?.valeurs?.fin ?? ''} /></label>
				<Bouton type="submit" variante="secondaire">Ajouter cette période</Bouton>
			</form>
		</section>
	{/if}
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
		max-width: 40rem;
	}
	p,
	h2 {
		margin: 0;
	}
	h2 {
		font: 700 var(--texte-20) var(--police-titre);
	}
	.carte {
		padding: var(--espace-16);
		background: var(--surface);
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
		border-radius: var(--rayon-grand);
		display: flex;
		flex-direction: column;
		gap: var(--espace-12);
	}
	.retours:has(p) {
		display: flex;
		flex-direction: column;
		gap: var(--espace-8);
	}
	.retours:not(:has(p)) {
		margin-bottom: -16px;
	}
	.doux {
		color: var(--doux);
	}
	.encadre {
		padding: var(--espace-12) var(--espace-16);
		border-radius: var(--rayon-petit);
		border: 1px solid var(--trait);
	}
	.periodes {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
	}
	.periodes li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--espace-12);
		min-height: var(--cible);
		font-weight: 600;
	}
	.periodes li + li {
		border-top: 1px solid var(--trait-doux);
	}
	.retirer {
		min-height: var(--cible);
		padding: 0 var(--espace-12);
		font: inherit;
		font-weight: 600;
		color: var(--texte);
		background: none;
		border: 1px solid var(--trait);
		border-radius: var(--rayon-petit);
		cursor: pointer;
	}
	.ajout {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		gap: var(--espace-12);
	}
	.ajout label {
		display: flex;
		flex-direction: column;
		gap: var(--espace-4);
		font-weight: 600;
	}
	input[type='date'] {
		min-height: var(--cible);
		font: inherit;
		color: var(--texte);
		background: var(--fond);
		padding: 0 var(--espace-12);
	}
	.succes {
		padding: var(--espace-12) var(--espace-16);
		border-radius: var(--rayon-petit);
		background: var(--statut-ok-fond);
		color: var(--statut-ok-texte);
		border: 1px solid var(--statut-ok-trait);
		font-weight: 600;
	}
	.echec {
		padding: var(--espace-12) var(--espace-16);
		border-radius: var(--rayon-petit);
		border: 2px solid var(--accent);
		font-weight: 600;
	}
	.masque {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
</style>
