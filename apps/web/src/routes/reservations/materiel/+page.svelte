<script lang="ts">
	import type { Ressource } from '@gyro-caserne/socle';
	import { enhance } from '$app/forms';
	import Bouton from '#lib/ui/Bouton.svelte';
	import Champ from '#lib/ui/Champ.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import IconeRole from '#lib/ui/IconeRole.svelte';
	import Vide from '#lib/ui/Vide.svelte';
	import ChoixIcone from '../../reglages/ChoixIcone.svelte';

	let { data, form }: { data: { ressources: Ressource[]; comites: { id: number; nom: string }[]; confirmer: number | null }; form?: { message?: string; succes?: string; valeurs?: Record<string, string> } | null } = $props();
	const valeur = (nom: string, sinon = '') => form?.valeurs?.[nom] ?? sinon;
</script>

<svelte:head>
	<title>Gérer le matériel · Réservations · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<EnTetePage titre="Gérer le matériel" phrase="Ce que vous gérez : ajoutez du matériel, changez le stock, retirez ce qui ne sert plus." retour={{ href: '/reservations', libelle: 'Réservations' }} />
	<p class="reussite" class:masque={!form?.succes} role="status">{form?.succes ?? ''}</p>
	<p class="erreur" class:masque={!form?.message} role="alert">{form?.message ?? ''}</p>

	{#if data.ressources.length === 0 && data.comites.length === 0}
		<Vide titre="Rien à gérer pour vous." texte="Les membres d’un comité, comme l’amicale, gèrent ici leur matériel." action={{ href: '/reservations', libelle: 'Voir les réservations' }} />
	{/if}

	<div class="colonnes">
		{#if data.ressources.length > 0}
			<section aria-labelledby="t-gere">
				<h2 id="t-gere" class="rubrique">Ce que vous gérez</h2>
				<ul role="list">
					{#each data.ressources as r (r.id)}
						<li class="carte">
							<div class="haut">
								<IconeRole icone={r.icone} taille={40} />
								<div>
									<h3>{r.nom}</h3>
									<p class="doux">{r.forme === 'jours' ? `${r.stock} en stock · ${r.gestionnaire.nom}` : `Par créneau · ${r.gestionnaire.nom}`}</p>
								</div>
							</div>
							{#if data.confirmer === r.id && r.forme === 'jours'}
								<div class="confirmer">
									<p><strong>Retirer {r.nom} ?</strong></p>
									<p>Les réservations à venir sont annulées et leurs demandeurs prévenus.</p>
									<div class="choix">
										<a class="bouton secondaire" href="/reservations/materiel">Garder</a>
										<form method="POST" action="?/retirer" use:enhance>
											<input type="hidden" name="id" value={r.id} />
											<button type="submit" class="bouton danger">Retirer</button>
										</form>
									</div>
								</div>
							{/if}
							<div class="gestes">
								<details>
									<summary class="bouton secondaire">Modifier<span class="masque">{` ${r.nom}`}</span></summary>
									<form method="POST" action="?/modifier" class="formulaire" use:enhance>
										<input type="hidden" name="id" value={r.id} />
										<Champ id="nom-{r.id}" name="nom" libelle="Nom" requis maxlength={60} valeur={r.nom} />
										{#if r.forme === 'jours'}<Champ id="stock-{r.id}" name="stock" type="number" libelle="Stock" requis valeur={String(r.stock)} />{/if}
										<ChoixIcone valeur={r.icone} />
										<Bouton type="submit">Enregistrer</Bouton>
									</form>
								</details>
								{#if r.forme === 'jours' && data.confirmer !== r.id}
									<a class="bouton secondaire retirer" href="?retirer={r.id}">Retirer<span class="masque">{` ${r.nom}`}</span></a>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if data.comites.length > 0}
			<section aria-labelledby="t-ajouter">
				<h2 id="t-ajouter" class="rubrique">Ajouter du matériel</h2>
				<form method="POST" action="?/ajouter" class="formulaire carte" use:enhance>
					<Champ id="ajouter-nom" name="nom" libelle="Nom" requis maxlength={60} valeur={valeur('nom')} aide="Par exemple : Bancs, Tables, Barnum." />
					<Champ id="ajouter-stock" name="stock" type="number" libelle="Stock" requis valeur={valeur('stock', '1')} aide="Combien en a-t-on ?" />
					{#if data.comites.length === 1}
						<input type="hidden" name="comite" value={data.comites[0]!.id} />
					{:else}
						<div class="champ">
							<label for="ajouter-comite">Géré par</label>
							<select id="ajouter-comite" name="comite">
								{#each data.comites as c (c.id)}<option value={c.id} selected={String(c.id) === valeur('comite')}>{c.nom}</option>{/each}
							</select>
						</div>
					{/if}
					<ChoixIcone valeur={(valeur('icone') || 'groupe') as never} />
					<Bouton type="submit">Ajouter</Bouton>
				</form>
			</section>
		{/if}
	</div>
</div>

<style>
	.page,
	.colonnes,
	section {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.page,
	.colonnes {
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
	.carte {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 14px 16px;
		background: var(--surface);
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
		border-radius: var(--rayon-grand);
	}
	.haut {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	h3 {
		margin: 0;
		font: 700 1.1875rem var(--police-titre);
	}
	.formulaire {
		display: flex;
		flex-direction: column;
		gap: 14px;
		margin-top: 10px;
	}
	.formulaire > :global(button) {
		align-self: flex-start;
	}
	details summary {
		list-style: none;
		display: inline-flex;
	}
	details summary::-webkit-details-marker {
		display: none;
	}
	.gestes {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.gestes details[open] {
		flex-basis: 100%;
	}
	.champ {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	label {
		font-weight: 600;
	}
	select {
		min-height: var(--cible);
		padding: 0 12px;
		border: 2px solid var(--doux);
		border-radius: var(--rayon-petit);
		background: var(--surface);
		color: var(--encre);
		font: 400 1rem var(--police);
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
		border-radius: var(--rayon-bouton);
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
		.colonnes {
			display: grid;
			grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
			align-items: start;
			gap: 28px;
		}
	}
</style>
