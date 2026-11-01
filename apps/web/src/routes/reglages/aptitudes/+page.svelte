<script lang="ts">
	import { enhance } from '$app/forms';
	import Bouton from '#lib/ui/Bouton.svelte';
	import Champ from '#lib/ui/Champ.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import Pastille from '#lib/ui/Pastille.svelte';

	let { data, form } = $props();
	const pour = (cible: string) => (form?.cible === cible ? form : null);
	const erreurNom = (cible: string) => pour(cible)?.erreurs?.nom;
</script>

<svelte:head>
	<title>Aptitudes · Réglages · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<EnTetePage titre="Aptitudes" phrase="Les aptitudes du centre. Une aptitude contrôlée est vérifiée quand un agent se fait remplacer : s’il manque au remplaçant, le chef d’équipe valide." />

	<div role="status" class="masque">{form?.succes ?? ''}</div>
	{#if form?.succes}<p class="succes">{form.succes}</p>{/if}

	<ul class="liste" role="list">
		{#each data.aptitudes as a (a.id)}
			{@const cible = `aptitude:${a.id}`}
			<li class="carte">
				<form method="POST" action="?/enregistrer" use:enhance class="ligne">
					<input type="hidden" name="id" value={a.id} />
					<Champ id="nom-{a.id}" name="nom" libelle="Nom" requis maxlength={20} valeur={pour(cible)?.valeurs?.nom ?? a.nom} erreur={erreurNom(cible)} />
					<label class="case"><input type="checkbox" name="controlee" value="oui" checked={a.controlee} /> Contrôlée en remplacement</label>
					<div class="gestes">
						<Bouton type="submit" variante="secondaire">Enregistrer<span class="masque"> {a.nom}</span></Bouton>
						<button type="submit" class="retirer" formaction="?/retirer">Retirer<span class="masque"> {a.nom}</span></button>
					</div>
				</form>
				{#if a.controlee}<p class="etat"><Pastille ton="info">Contrôlée</Pastille></p>{/if}
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
		gap: 10px;
	}
	.carte {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 14px 16px;
		background: var(--surface);
		border: 1px solid var(--trait-doux);
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
	.retirer {
		min-height: var(--cible);
		padding: 0 16px;
		border: 1px solid var(--trait);
		border-radius: var(--rayon-petit);
		background: transparent;
		color: var(--encre);
		font: 600 1rem var(--police);
		cursor: pointer;
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
