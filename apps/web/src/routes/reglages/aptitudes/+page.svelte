<script lang="ts">
	import { enhance } from '$app/forms';
	import Bouton from '#lib/ui/Bouton.svelte';
	import Champ from '#lib/ui/Champ.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';

	let { data, form } = $props();
	const pour = (cible: string) => (form?.cible === cible ? form : null);
	const erreurNom = (cible: string) => pour(cible)?.erreurs?.nom;
</script>

<svelte:head>
	<title>Aptitudes · Réglages · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<EnTetePage titre="Aptitudes" phrase="Les aptitudes du centre. Une aptitude contrôlée est vérifiée quand un agent se fait remplacer : s’il manque au remplaçant, le chef de garde valide." />

	<div role="status" class="masque">{form?.succes ?? ''}</div>
	{#if form?.succes}<p class="succes">{form.succes}</p>{/if}

	<ul class="liste" role="list">
		{#each data.aptitudes as a (a.id)}
			{@const cible = `aptitude:${a.id}`}
			<li class="rangee">
				<form method="POST" action="?/enregistrer" use:enhance class="compacte">
					<input type="hidden" name="id" value={a.id} />
					<label class="masque" for="nom-{a.id}">Nom de l’aptitude {a.nom}</label>
					<input id="nom-{a.id}" class="nom" name="nom" required maxlength="20" value={pour(cible)?.valeurs?.nom ?? a.nom} aria-invalid={erreurNom(cible) ? 'true' : undefined} aria-describedby={erreurNom(cible) ? `erreur-${a.id}` : undefined} />
					<label class="case"><input type="checkbox" name="controlee" value="oui" checked={a.controlee} /> Contrôlée<span class="masque"> en remplacement : {a.nom}</span></label>
					<span class="gestes">
						<button type="submit" class="petit">Enregistrer<span class="masque"> {a.nom}</span></button>
						<button type="submit" class="petit" formaction="?/retirer">Retirer<span class="masque"> {a.nom}</span></button>
					</span>
				</form>
				{#if erreurNom(cible)}<p id="erreur-{a.id}" class="echec" role="alert">{erreurNom(cible)}</p>{/if}
				{#if pour(cible)?.message}<p class="echec" role="alert">{pour(cible)?.message}</p>{/if}
			</li>
		{/each}
	</ul>

	<section class="carte" aria-labelledby="ajouter">
		<h2 id="ajouter">Ajouter une aptitude</h2>
		<form method="POST" action="?/enregistrer" use:enhance class="ligne">
			<Champ id="nom-nouvelle" name="nom" libelle="Nom" aide="Court, comme sur la fiche : « FDF3 », « SR »." requis maxlength={20} valeur={pour('nouvelle')?.valeurs?.nom ?? ''} erreur={erreurNom('nouvelle')} />
			<label class="case"><input type="checkbox" name="controlee" value="oui" /> Contrôlée en remplacement</label>
			<div class="gestes"><Bouton type="submit">Ajouter</Bouton></div>
		</form>
		{#if pour('nouvelle')?.message}<p class="echec" role="alert">{pour('nouvelle')?.message}</p>{/if}
	</section>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 16px;
		max-width: 44rem;
	}
	p,
	h2 {
		margin: 0;
	}
	h2 {
		font: 700 1.25rem var(--police-titre);
	}
	.liste {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		background: var(--surface);
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
		border-radius: var(--rayon-grand);
	}
	.rangee {
		padding: 10px 14px;
	}
	.rangee + .rangee {
		border-top: 1px solid var(--trait-doux);
	}
	.compacte {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 14px;
	}
	.nom {
		width: 7.5em;
		min-height: var(--cible);
		padding: 0 12px;
		border: 2px solid var(--doux);
		border-radius: var(--rayon-petit);
		background: var(--surface);
		color: var(--encre);
		font: 700 1rem var(--police);
	}
	.petit {
		min-height: var(--cible);
		padding: 0 14px;
		border: 1px solid var(--trait);
		border-radius: var(--rayon-bouton);
		background: var(--surface);
		color: var(--encre);
		font: 600 0.9375rem var(--police);
		cursor: pointer;
	}
	.compacte .gestes {
		margin-left: auto;
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
	.ligne {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.case {
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		gap: 10px;
		font-weight: 600;
	}
	.case input {
		width: 22px;
		height: 22px;
		accent-color: var(--encre);
	}
	.gestes {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}
	.succes {
		padding: 12px 16px;
		border-radius: var(--rayon-petit);
		background: var(--statut-ok-fond);
		color: var(--statut-ok-texte);
		border: 1px solid var(--statut-ok-trait);
		font-weight: 600;
	}
	.echec {
		padding: 10px 14px;
		border-radius: var(--rayon-petit);
		border: 2px solid var(--accent);
		font-weight: 600;
	}
	@media (min-width: 720px) {
		.ligne {
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto;
			align-items: end;
		}
		.gestes {
			grid-column: 1 / -1;
		}
	}
</style>
