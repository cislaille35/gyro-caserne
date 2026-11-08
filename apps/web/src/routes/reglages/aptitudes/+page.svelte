<script lang="ts">
	import Pastille from '#lib/ui/Pastille.svelte';
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

	<ul class="pile" role="list">
		{#each data.aptitudes as a (a.id)}
			{@const cible = `aptitude:${a.id}`}
			<li>
				<details class="aptitude" open={erreurNom(cible) !== undefined || pour(cible)?.message !== undefined}>
					<summary>
						<strong>{a.nom}</strong>
						{#if a.controlee}<Pastille ton="info">Contrôlée</Pastille>{/if}
						<span class="modifier">Modifier<span class="masque"> {a.nom}</span></span>
					</summary>
					<form method="POST" action="?/enregistrer" use:enhance class="compacte">
						<input type="hidden" name="id" value={a.id} />
						<label class="masque" for="nom-{a.id}">Nom de l’aptitude {a.nom}</label>
						<input id="nom-{a.id}" class="nom" name="nom" required maxlength="20" value={pour(cible)?.valeurs?.nom ?? a.nom} aria-invalid={erreurNom(cible) ? 'true' : undefined} aria-describedby={erreurNom(cible) ? `erreur-${a.id}` : undefined} />
						<label class="case"><input type="checkbox" name="controlee" value="oui" checked={a.controlee} /> Contrôlée<span class="masque"> en remplacement : {a.nom}</span></label>
						<span class="gestes">
							<button type="submit" class="petit">Enregistrer<span class="masque"> {a.nom}</span></button>
							<button type="submit" class="petit retirer" formaction="?/retirer">Retirer<span class="masque"> {a.nom}</span></button>
						</span>
					</form>
					{#if erreurNom(cible)}<p id="erreur-{a.id}" class="echec" role="alert">{erreurNom(cible)}</p>{/if}
					{#if pour(cible)?.message}<p class="echec" role="alert">{pour(cible)?.message}</p>{/if}
				</details>
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
	.aptitude summary {
		min-height: var(--cible);
		display: flex;
		align-items: center;
		gap: var(--espace-8);
		padding: var(--espace-8) var(--espace-16);
		list-style: none;
		cursor: pointer;
	}
	.aptitude summary::-webkit-details-marker {
		display: none;
	}
	.aptitude summary:focus-visible {
		outline-offset: -3px;
	}
	.modifier {
		margin-left: auto;
		color: var(--doux);
		font-size: var(--texte-14);
		text-decoration: underline;
	}
	.aptitude[open] .compacte,
	.aptitude[open] .echec {
		margin: 0 var(--espace-16) var(--espace-12);
	}
	.retirer {
		color: var(--accent);
		border-color: var(--accent);
	}
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
		max-width: 44rem;
	}
	p,
	h2 {
		margin: 0;
	}
	h2 {
		font: 700 var(--texte-20) var(--police-titre);
	}
	.compacte {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--espace-8) var(--espace-16);
	}
	.nom {
		width: 7.5em;
		min-height: var(--cible);
		padding: 0 var(--espace-12);
		border: 2px solid var(--doux);
		border-radius: var(--rayon-petit);
		background: var(--surface);
		color: var(--encre);
		font: 700 var(--texte-16) var(--police);
	}
	.petit {
		min-height: var(--cible);
		padding: 0 var(--espace-16);
		border: 1px solid var(--trait);
		border-radius: var(--rayon-bouton);
		background: var(--surface);
		color: var(--encre);
		font: 600 var(--texte-15) var(--police);
		cursor: pointer;
	}
	.compacte .gestes {
		margin-left: auto;
	}
	.carte {
		display: flex;
		flex-direction: column;
		gap: var(--espace-12);
		padding: var(--espace-16) var(--espace-16);
		background: var(--surface);
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
		border-radius: var(--rayon-grand);
	}
	.ligne {
		display: flex;
		flex-direction: column;
		gap: var(--espace-12);
	}
	.case {
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		gap: var(--espace-12);
		font-weight: 600;
	}
	.gestes {
		display: flex;
		flex-wrap: wrap;
		gap: var(--espace-12);
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
